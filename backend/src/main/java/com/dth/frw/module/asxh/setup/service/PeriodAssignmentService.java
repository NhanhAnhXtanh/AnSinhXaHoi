package com.dth.frw.module.asxh.setup.service;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.PeriodAssignment;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.module.asxh.setup.repo.PeriodAssignmentRepository;
import com.dth.frw.module.asxh.setup.repo.PeriodAssignmentSpecifications;
import com.dth.frw.module.asxh.template.service.TemplateDates;
import com.dth.frw.module.asxh.template.service.TemplateService;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import com.dth.frw.module.asxh.unit.service.ReportUnitService;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.CurrentUser;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ma trận thiết lập Đơn vị × Biểu của một kỳ (UC-22), port
 * {@code PeriodTemplateAssignmentService} (phần ma trận dùng: {@code assignSheetPlanToPeriods},
 * {@code unassignOrganizations}, {@code assignSheetsForSupplement}, {@code refreshPeriodReadiness},
 * {@code copyConfigurations}).
 *
 * <p>Quy tắc:
 * <ul>
 *   <li>Kỳ Chưa thiết lập / Đã thiết lập: gán và gỡ. Kỳ tự chuyển DRAFT ⇄ READY theo việc có
 *       còn ô nào hay không.</li>
 *   <li>Kỳ Đang mở: chỉ gán thêm, và gán xong là phát ngay một đợt bổ sung trong CÙNG giao dịch
 *       (BR-26.1) — không có thiết lập "mồ côi".</li>
 *   <li>Kỳ khác: chỉ xem (gồm cả Quá hạn — chốt 19/09: kỳ quá hạn không thiết lập).</li>
 *   <li>Khoá cả kỳ (UC-31) chặn gán thêm; gỡ thiết lập thừa ở kỳ bị khoá vì trùng kỳ vẫn cho (1a).</li>
 *   <li>Trùng thời gian chỉ xét THEO CẢ KỲ (luật user chốt 16/10): kỳ trùng với kỳ khác đã mở
 *       đợt thì khoá cả kỳ; KHÔNG còn khoá từng đơn vị như BR-22.2 / UC-22 4a của bản Jmix.
 *       Hai kỳ trùng nhau mà chưa kỳ nào mở đợt thì đều thiết lập được; kỳ nào mở đợt trước
 *       thì kỳ kia bị khoá cả kỳ.</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class PeriodAssignmentService {

    private static final Set<String> SORTABLE = Set.of("id", "createdAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("id"));

    private static final Set<PeriodStatus> CONFIGURABLE = EnumSet.of(PeriodStatus.DRAFT, PeriodStatus.READY);

    /** Một ô (đơn vị, biểu). */
    public record Cell(Long unitId, Long templateId) {
    }

    /**
     * Kết quả áp dụng thiết lập sang kỳ khác (UC-23): số ô thêm mới, số ô đã có sẵn ở kỳ đích,
     * số ô bỏ qua vì biểu không còn ban hành / đơn vị không còn nhận báo cáo (BR-23.2).
     */
    public record CopyResult(int added, int unchanged, int skipped, List<ReportPeriod> targets, String message) {
    }

    /** Kết quả lưu ma trận; {@code publication} khác {@code null} khi đã mở đợt bổ sung. */
    public record MatrixResult(
            ReportPeriod period, int added, int removed, int unchanged, Publication publication, String message) {
    }

    private final PeriodAssignmentRepository repository;
    private final PeriodSetupLockService lockService;
    private final PublicationService publicationService;
    private final InputReportService inputReportService;
    private final ReportPeriodService periodService;
    private final ReportUnitService unitService;
    private final TemplateService templateService;
    private final TemplateVersionService templateVersionService;
    private final RowLevelSecurity rowLevel;

    public PeriodAssignmentService(PeriodAssignmentRepository repository,
                                   PeriodSetupLockService lockService,
                                   PublicationService publicationService,
                                   InputReportService inputReportService,
                                   ReportPeriodService periodService,
                                   ReportUnitService unitService,
                                   TemplateService templateService,
                                   TemplateVersionService templateVersionService,
                                   RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.lockService = lockService;
        this.publicationService = publicationService;
        this.inputReportService = inputReportService;
        this.periodService = periodService;
        this.unitService = unitService;
        this.templateService = templateService;
        this.templateVersionService = templateVersionService;
        this.rowLevel = rowLevel;
    }

    public Page<PeriodAssignment> list(ListParams params) {
        return repository.findAll(
                rowLevel.scope(PeriodAssignment.class, Action.READ).and(PeriodAssignmentSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public PeriodAssignment get(Long id) {
        return repository.findOne(rowLevel.byId(PeriodAssignment.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException("PeriodAssignment", id));
    }

    public List<PeriodAssignment> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(PeriodAssignment.class, Action.READ, ids));
    }

    /** Số ô dùng được của kỳ — không tính ô của biểu đang khoá (để sửa). */
    public long countForPeriod(Long periodId) {
        return repository.countUsableByPeriodId(periodId);
    }

    /**
     * Tự chuyển Chưa thiết lập ⇄ Đã thiết lập theo số ô DÙNG ĐƯỢC (UC-22 bước 7): kỳ chưa mở đợt
     * mà chỉ còn ô của biểu đang khoá thì coi như chưa chọn biểu nào. Kỳ đã mở đợt trở đi giữ
     * nguyên.
     *
     * @return kỳ sau khi tính lại
     */
    @Transactional
    public ReportPeriod syncSetupStatus(Long periodId) {
        ReportPeriod period = periodService.get(periodId);
        if (!CONFIGURABLE.contains(period.getStatus())) {
            return period;
        }
        long usable = repository.countUsableByPeriodId(periodId);
        if (usable > 0 && period.getStatus() == PeriodStatus.DRAFT) {
            return periodService.transition(periodId, PeriodStatus.READY);
        }
        if (usable == 0 && period.getStatus() == PeriodStatus.READY) {
            return periodService.transition(periodId, PeriodStatus.DRAFT);
        }
        return period;
    }

    /** Biểu vừa khoá / mở khoá: tính lại trạng thái thiết lập của mọi kỳ có ô của biểu đó. */
    @Transactional
    public void syncSetupStatusOfTemplate(Long templateId) {
        for (Long periodId : repository.findPeriodIdsByTemplateId(templateId)) {
            syncSetupStatus(periodId);
        }
    }

    /**
     * Lưu thay đổi của ma trận (nút "Lưu thay đổi" / "Mở đợt bổ sung"): gỡ các ô chờ gỡ trước,
     * rồi gán các ô mới, trong một giao dịch. Ô gán đã có sẵn và ô gỡ không tồn tại được bỏ qua
     * (gán thêm không bao giờ xoá cấu hình của đơn vị khác — BR-22.3).
     */
    @Transactional
    public MatrixResult applyMatrix(Long periodId, List<Cell> add, List<Cell> remove) {
        List<Cell> toAdd = distinct(add);
        List<Cell> toRemove = distinct(remove);
        ReportPeriod period = periodService.get(periodId);
        PeriodStatus status = period.getStatus();
        boolean open = status == PeriodStatus.OPEN;

        if (!CONFIGURABLE.contains(status) && !open) {
            throw new ConflictException("Kỳ " + period.getName() + " đã chốt hoặc đã khoá nên chỉ xem được, "
                    + "không thay đổi thiết lập được.");
        }
        if (toAdd.isEmpty() && toRemove.isEmpty()) {
            throw new ConflictException("Không có thay đổi nào để lưu.");
        }
        if (!toRemove.isEmpty() && open) {
            throw new ConflictException("Chỉ gỡ thiết lập khi kỳ chưa mở; kỳ " + period.getName()
                    + " đang ở trạng thái " + PublicationService.statusLabel(status) + ".");
        }
        if (!toAdd.isEmpty()) {
            // Gỡ thiết lập thừa ở kỳ bị khoá vì trùng kỳ vẫn cho; chỉ gán thêm mới bị chặn (UC-31 1a).
            lockService.assertSetupAllowed(period);
        } else {
            // ...nhưng khoá NĂM (năm đã nộp UBND) chặn hẳn, kể cả gỡ (UC-31 1a; bản Jmix
            // unassignOrganizations gọi assertYearOpen).
            lockService.lock(period)
                    .filter(found -> found.kind() == PeriodSetupLockService.LockKind.YEAR)
                    .ifPresent(found -> {
                        throw new ConflictException(found.reason());
                    });
        }

        // Ô đang có của kỳ, nạp một lần cho cả hai bước.
        Map<String, PeriodAssignment> current = new HashMap<>();
        for (PeriodAssignment assignment : repository.findByPeriodId(periodId)) {
            current.put(key(assignment.getUnit().getId(), assignment.getTemplate().getId()), assignment);
        }

        // ---- gỡ
        int removed = 0;
        if (!toRemove.isEmpty()) {
            Set<String> issued = inputReportService.issuedPairs(periodId);
            for (Cell cell : toRemove) {
                String cellKey = key(cell.unitId(), cell.templateId());
                if (issued.contains(cellKey)) {
                    throw new ConflictException("Biểu mẫu đã được tạo phiếu nên không thể thay đổi cấu hình.");
                }
                PeriodAssignment existing = current.remove(cellKey);
                if (existing != null) {
                    repository.remove(existing);
                    removed++;
                }
            }
            repository.flush();
        }

        // ---- gán
        int added = 0;
        int unchanged = 0;
        if (!toAdd.isEmpty()) {
            Map<Long, ReportUnit> units = resolveUnits(toAdd);
            Map<Long, Template> templates = resolveTemplates(toAdd);

            String user = CurrentUser.username().orElse(null);
            for (Cell cell : toAdd) {
                String cellKey = key(cell.unitId(), cell.templateId());
                if (current.containsKey(cellKey)) {
                    unchanged++;
                    continue;
                }
                current.put(cellKey, repository.persist(new PeriodAssignment(
                        period, units.get(cell.unitId()), templates.get(cell.templateId()), user)));
                added++;
            }
            repository.flush();
        }

        // ---- trạng thái kỳ: tự chuyển DRAFT ⇄ READY (UC-22 bước 7)
        if (!open) {
            period = syncSetupStatus(periodId);
        }

        // ---- kỳ đang mở: phát ngay đợt bổ sung (UC-26)
        Publication publication = null;
        if (open && added > 0) {
            publication = publicationService.publishSupplemental(period);
        }

        String message = open && publication != null
                ? "Đã mở đợt bổ sung cho kỳ %s: thêm %d ô, %d tờ biểu mới.".formatted(
                        period.getName(), added, publication.getSheetCount())
                : "Đã lưu %d ô, gỡ %d ô cho kỳ %s.".formatted(added, removed, period.getName());
        return new MatrixResult(period, added, removed, unchanged, publication, message);
    }

    /**
     * Áp dụng thiết lập của kỳ {@code fromPeriodId} cho các kỳ {@code toPeriodIds} (UC-23,
     * {@code POST /api/period_assignments/copy}), một giao dịch cho mọi kỳ đích.
     *
     * <ul>
     *   <li>Chỉ CỘNG THÊM vào kỳ đích, không gỡ ô sẵn có (BR-23.1).</li>
     *   <li>Chỉ sao biểu còn phiên bản đã ban hành áp dụng tới hôm nay và đơn vị còn hoạt động,
     *       còn nhận báo cáo; ô khác bỏ qua và được đếm (BR-23.2).</li>
     *   <li>Kỳ đích phải cùng năm với kỳ nguồn và đang ở bước thiết lập (Chưa thiết lập / Đã
     *       thiết lập) — kỳ đang mở thêm ô phải đi đường đợt bổ sung trên ma trận.</li>
     *   <li>Luật trùng thời gian chỉ xét CẢ KỲ: kỳ đích bị khoá vì trùng kỳ khác đã mở đợt
     *       thì từ chối cả lượt, không ghi gì (4a); không còn kiểm trùng theo từng đơn vị.</li>
     *   <li>Kỳ đích DRAFT có ô thì sang READY (UC-22 bước 7).</li>
     * </ul>
     */
    @Transactional
    public CopyResult copy(Long fromPeriodId, Collection<Long> toPeriodIds) {
        ReportPeriod source = periodService.get(fromPeriodId);
        Set<Long> targetIds = new LinkedHashSet<>();
        if (toPeriodIds != null) {
            for (Long id : toPeriodIds) {
                if (id != null && !id.equals(fromPeriodId)) {
                    targetIds.add(id);
                }
            }
        }
        if (targetIds.isEmpty()) {
            throw new ConflictException("Chưa chọn kỳ nào để áp dụng thiết lập.");
        }

        List<PeriodAssignment> sourceCells = repository.findByPeriodId(fromPeriodId);
        if (sourceCells.isEmpty()) {
            throw new ConflictException("Kỳ " + source.getName() + " chưa có thiết lập nào để áp dụng.");
        }

        List<ReportPeriod> targets = new ArrayList<>(targetIds.size());
        for (Long id : targetIds) {
            ReportPeriod target = periodService.get(id);
            if (source.getYear() != null && !source.getYear().equals(target.getYear())) {
                throw new ConflictException("Chỉ áp dụng được cho các kỳ cùng năm " + source.getYear()
                        + "; kỳ " + target.getName() + " thuộc năm khác.");
            }
            if (!CONFIGURABLE.contains(target.getStatus())) {
                throw new ConflictException("Chỉ áp dụng được cho kỳ chưa mở đợt; kỳ " + target.getName()
                        + " đang ở trạng thái " + PublicationService.statusLabel(target.getStatus()) + ".");
            }
            targets.add(target);
        }
        Map<Long, PeriodSetupLockService.PeriodLock> locks = lockService.locks(targets);
        if (!locks.isEmpty()) {
            throw new ConflictException("Chưa áp dụng được. " + PeriodSetupLockService.joinReasons(locks.values()));
        }

        // Lọc ô của kỳ nguồn theo BR-23.2 một lần cho mọi kỳ đích.
        LocalDate today = TemplateDates.today();
        Map<Long, Boolean> templateUsable = new HashMap<>();
        List<PeriodAssignment> usable = new ArrayList<>(sourceCells.size());
        int skippedPerTarget = 0;
        for (PeriodAssignment cell : sourceCells) {
            ReportUnit unit = cell.getUnit();
            Template template = cell.getTemplate();
            boolean templateOk = templateUsable.computeIfAbsent(template.getId(),
                    id -> template.getKind() == TemplateKind.CHI_TIET
                            && templateVersionService.findEffective(id, today).isPresent());
            if (templateOk && unit.isActive() && unit.isReceivesReports()) {
                usable.add(cell);
            } else {
                skippedPerTarget++;
            }
        }
        if (usable.isEmpty()) {
            throw new ConflictException("Kỳ " + source.getName() + " không còn ô nào áp dụng được: các biểu đã "
                    + "ngừng ban hành hoặc các đơn vị không còn nhận báo cáo.");
        }

        String user = CurrentUser.username().orElse(null);
        int added = 0;
        int unchanged = 0;
        for (ReportPeriod target : targets) {
            Set<String> existing = new HashSet<>();
            for (PeriodAssignment assignment : repository.findByPeriodId(target.getId())) {
                existing.add(key(assignment.getUnit().getId(), assignment.getTemplate().getId()));
            }
            for (PeriodAssignment cell : usable) {
                if (!existing.add(key(cell.getUnit().getId(), cell.getTemplate().getId()))) {
                    unchanged++;
                    continue;
                }
                repository.persist(new PeriodAssignment(target, cell.getUnit(), cell.getTemplate(), user));
                added++;
            }
            repository.flush();
            syncSetupStatus(target.getId());
        }

        String message = "Đã áp dụng %d ô cho %d kỳ.".formatted(added, targets.size());
        if (skippedPerTarget > 0) {
            message += " Bỏ qua %d ô vì biểu đã ngừng ban hành hoặc đơn vị không còn nhận báo cáo."
                    .formatted(skippedPerTarget);
        }
        return new CopyResult(added, unchanged, skippedPerTarget * targets.size(), targets, message);
    }

    // ------------------------------------------------------------- nội bộ

    /**
     * Đơn vị phải đang hoạt động và được nhận báo cáo (UC-22 6b). Mỗi đơn vị chỉ nạp một lần
     * dù xuất hiện ở nhiều ô; id lạ ra đúng 404 của {@code /api/report_units}.
     */
    private Map<Long, ReportUnit> resolveUnits(List<Cell> cells) {
        Map<Long, ReportUnit> units = new LinkedHashMap<>();
        for (Cell cell : cells) {
            units.computeIfAbsent(cell.unitId(), unitService::get);
        }
        boolean invalid = units.values().stream().anyMatch(unit -> !unit.isActive() || !unit.isReceivesReports());
        if (invalid) {
            throw new ConflictException("Danh sách có đơn vị không hoạt động hoặc không được nhận báo cáo.");
        }
        return units;
    }

    /**
     * Chỉ biểu chi tiết mới giao cho đơn vị nhập; biểu tổng hợp chỉ dùng ở màn Tổng hợp
     * (BR-22.1). Biểu đang khoá không gán được. Màn ma trận đã lọc cột theo loại và bỏ biểu
     * đang khoá, máy chủ chặn lại cho lời gọi thẳng API.
     */
    private Map<Long, Template> resolveTemplates(List<Cell> cells) {
        Map<Long, Template> templates = new HashMap<>();
        for (Cell cell : cells) {
            templates.computeIfAbsent(cell.templateId(), templateService::get);
        }
        templates.values().stream()
                .filter(template -> template.getKind() != TemplateKind.CHI_TIET)
                .findFirst()
                .ifPresent(template -> {
                    throw new ConflictException("Biểu " + template.getShortName()
                            + " là biểu tổng hợp, không giao cho đơn vị nhập được.");
                });
        templates.values().stream()
                .filter(Template::isLocked)
                .findFirst()
                .ifPresent(template -> {
                    throw new ConflictException("Biểu " + template.getShortName()
                            + " đang khoá để sửa nên không gán được. Hãy mở khoá biểu trước.");
                });
        return templates;
    }

    private static String key(Long unitId, Long templateId) {
        return unitId + ":" + templateId;
    }

    private static List<Cell> distinct(List<Cell> cells) {
        if (cells == null) {
            return List.of();
        }
        return cells.stream()
                .filter(cell -> cell != null && cell.unitId() != null && cell.templateId() != null)
                .distinct()
                .toList();
    }
}
