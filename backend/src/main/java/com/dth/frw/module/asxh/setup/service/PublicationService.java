package com.dth.frw.module.asxh.setup.service;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.PeriodAssignment;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.PublicationKind;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.module.asxh.setup.repo.PeriodAssignmentRepository;
import com.dth.frw.module.asxh.setup.repo.PublicationRepository;
import com.dth.frw.module.asxh.setup.repo.PublicationSpecifications;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.CurrentUser;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Đợt phát hành: mở đợt lần đầu (UC-24) và đợt bổ sung (UC-26). Port
 * {@code ReportPublicationService} + {@code ReportBatchPublicationService} của bản Jmix.
 *
 * <p>Bỏ bước "xem trước + mã xem trước" (preview token) của bản cũ: mở đợt ở đây tự tính lại từ
 * cấu hình ngay trong giao dịch ghi, nên không có khoảng hở giữa lúc xem và lúc ghi để chặn.
 *
 * <p>Không phụ thuộc {@link PeriodAssignmentService} (ngược lại thì có — đợt bổ sung từ ma trận
 * gọi vào đây) nên đọc thiết lập thẳng từ repository cùng slice.
 */
@Service
@Transactional(readOnly = true)
public class PublicationService {

    private static final Set<String> SORTABLE = Set.of("id", "publicationNo", "kind", "status", "createdAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    private final PublicationRepository repository;
    private final PeriodAssignmentRepository assignmentRepository;
    private final PeriodSetupLockService lockService;
    private final InputReportService inputReportService;
    private final ReportPeriodService periodService;
    private final TemplateVersionService templateVersionService;
    private final RowLevelSecurity rowLevel;

    public PublicationService(PublicationRepository repository,
                              PeriodAssignmentRepository assignmentRepository,
                              PeriodSetupLockService lockService,
                              InputReportService inputReportService,
                              ReportPeriodService periodService,
                              TemplateVersionService templateVersionService,
                              RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.assignmentRepository = assignmentRepository;
        this.lockService = lockService;
        this.inputReportService = inputReportService;
        this.periodService = periodService;
        this.templateVersionService = templateVersionService;
        this.rowLevel = rowLevel;
    }

    public Page<Publication> list(ListParams params) {
        return repository.findAll(
                rowLevel.scope(Publication.class, Action.READ).and(PublicationSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public Publication get(Long id) {
        return repository.findOne(rowLevel.byId(Publication.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException("Publication", id));
    }

    public List<Publication> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(Publication.class, Action.READ, ids));
    }

    /** Kỳ đã có đợt LẦN ĐẦU còn hiệu lực chưa (đợt đã thu hồi không tính — BR-29.2). */
    public boolean hasInitialPublication(Long periodId) {
        return repository.countByPeriodKindStatus(periodId, PublicationKind.LAN_DAU, PublicationStatus.PUBLISHED) > 0;
    }

    /**
     * {@code POST /api/report_periods/{id}/publish}: chưa mở lần đầu thì mở đợt lần đầu (kỳ
     * phải Đã thiết lập), đã mở rồi thì phát đợt bổ sung cho các ô chưa phát (kỳ phải Đang mở).
     */
    @Transactional
    public Publication publish(Long periodId) {
        ReportPeriod period = periodService.get(periodId);
        return hasInitialPublication(periodId)
                ? publishSupplemental(period)
                : publishInitial(period);
    }

    /**
     * Mở đợt lần đầu (UC-24): READY → phát phiếu cho mọi ô đã thiết lập → OPEN ngay (BR-24.4),
     * kể cả khi ngày nhận nhập liệu còn ở tương lai.
     */
    @Transactional
    public Publication publishInitial(ReportPeriod period) {
        lockService.assertSetupAllowed(period);
        if (hasInitialPublication(period.getId())) {
            throw new ConflictException("Kỳ đã được mở lần đầu; hãy dùng mở đợt bổ sung.");
        }
        if (period.getStatus() != PeriodStatus.READY) {
            throw new ConflictException(period.getStatus() == PeriodStatus.DRAFT
                    ? "Hãy gán biểu mẫu cho ít nhất một đơn vị rồi mới mở đợt được."
                    : "Chỉ mở đợt được cho kỳ đã thiết lập; kỳ " + period.getName() + " đang ở trạng thái "
                            + statusLabel(period.getStatus()) + ".");
        }
        Publication publication = issue(period, PublicationKind.LAN_DAU);
        // Cùng thực thể đã nạp trong giao dịch này, nên publication.getPeriod() thấy ngay OPEN.
        periodService.transition(period.getId(), PeriodStatus.OPEN);
        return publication;
    }

    /**
     * Đợt bổ sung (UC-26): phát các ô đã thiết lập mà chưa từng phát. Kỳ giữ OPEN.
     *
     * <p>Không có ô mới thì từ chối thay vì ghi một đợt rỗng vào lịch sử mở đợt.
     */
    @Transactional
    public Publication publishSupplemental(ReportPeriod period) {
        lockService.assertSetupAllowed(period);
        if (!hasInitialPublication(period.getId())) {
            throw new ConflictException("Kỳ chưa được mở lần đầu nên không thể mở đợt bổ sung.");
        }
        if (period.getStatus() != PeriodStatus.OPEN) {
            throw new ConflictException("Chỉ mở đợt bổ sung được cho kỳ đang mở; kỳ " + period.getName()
                    + " đang ở trạng thái " + statusLabel(period.getStatus()) + ".");
        }
        Publication publication = issue(period, PublicationKind.BO_SUNG);
        if (publication.getSheetCount() == 0) {
            throw new ConflictException("Không có biểu mới nào cần phát thêm cho kỳ " + period.getName() + ".");
        }
        return publication;
    }

    /**
     * Thu hồi kỳ (UC-29): vô hiệu mọi đợt còn hiệu lực để lần mở sau được tính là lần đầu.
     *
     * @return số đợt đã thu hồi
     */
    @Transactional
    public int cancelAll(Long periodId) {
        List<Publication> active = repository.findByPeriodAndStatus(periodId, PublicationStatus.PUBLISHED);
        for (Publication publication : active) {
            publication.cancel();
            repository.persist(publication);
        }
        return active.size();
    }

    // ------------------------------------------------------------- nội bộ

    /**
     * Ghi bản ghi đợt rồi phát phiếu cho mọi ô đã thiết lập của kỳ. Phiên bản mẫu của từng biểu
     * được chọn theo NGÀY MỞ ĐỢT (hôm nay), không theo ngày đầu kỳ: bản có hiệu lực trong tương
     * lai không được lọt vào phiếu hôm nay (BR-24.1).
     */
    private Publication issue(ReportPeriod period, PublicationKind kind) {
        List<PeriodAssignment> assignments = assignmentRepository.findByPeriodId(period.getId());
        if (assignments.isEmpty()) {
            throw new ConflictException("Hãy gán biểu mẫu cho ít nhất một đơn vị rồi mới mở đợt được.");
        }

        LocalDate today = LocalDate.now();
        Map<Long, TemplateVersion> versions = new LinkedHashMap<>();
        Set<String> missing = new LinkedHashSet<>();
        for (PeriodAssignment assignment : assignments) {
            Template template = assignment.getTemplate();
            if (versions.containsKey(template.getId()) || missing.contains(template.getShortName())) {
                continue;
            }
            Optional<TemplateVersion> version = templateVersionService.findEffective(template.getId(), today);
            if (version.isPresent()) {
                versions.put(template.getId(), version.get());
            } else {
                missing.add(template.getShortName());
            }
        }
        if (!missing.isEmpty()) {
            throw new ConflictException("Chưa mở đợt được: biểu " + String.join(", ", missing)
                    + " chưa có phiên bản đã ban hành áp dụng tới hôm nay.");
        }

        Publication publication = repository.persist(new Publication(
                period, kind, repository.maxPublicationNo(period.getId()) + 1, CurrentUser.username().orElse(null)));
        repository.flush();

        List<InputReportService.IssueRequest> requests = new ArrayList<>(assignments.size());
        for (PeriodAssignment assignment : assignments) {
            requests.add(new InputReportService.IssueRequest(
                    assignment.getUnit(), assignment.getTemplate(), versions.get(assignment.getTemplate().getId())));
        }
        InputReportService.IssueResult result = inputReportService.issue(publication, requests);

        publication.setUnitCount(result.unitCount());
        publication.setReportCount(result.reportCount());
        publication.setSheetCount(result.sheetCount());
        return repository.persist(publication);
    }

    /** Nhãn trạng thái kỳ cho câu báo — người dùng không đọc mã trạng thái tiếng Anh. */
    static String statusLabel(PeriodStatus status) {
        return status == null ? "chưa xác định" : status.label();
    }
}
