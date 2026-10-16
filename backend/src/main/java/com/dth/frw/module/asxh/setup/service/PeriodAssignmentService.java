package com.dth.frw.module.asxh.setup.service;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.PeriodAssignment;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.module.asxh.setup.repo.PeriodAssignmentRepository;
import com.dth.frw.module.asxh.setup.repo.PeriodAssignmentSpecifications;
import com.dth.frw.module.asxh.template.service.TemplateService;
import com.dth.frw.module.asxh.unit.service.ReportUnitService;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.CurrentUser;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ma trận thiết lập Đơn vị × Biểu của một kỳ (UC-22), port
 * {@code PeriodTemplateAssignmentService} (phần ma trận dùng: {@code assignSheetPlanToPeriods},
 * {@code unassignOrganizations}, {@code assignSheetsForSupplement}, {@code refreshPeriodReadiness},
 * {@code assertNoOverlappingPeriods}).
 *
 * <p>Quy tắc:
 * <ul>
 *   <li>Kỳ Chưa thiết lập / Đã thiết lập: gán và gỡ. Kỳ tự chuyển DRAFT ⇄ READY theo việc có
 *       còn ô nào hay không.</li>
 *   <li>Kỳ Đang mở: chỉ gán thêm, và gán xong là phát ngay một đợt bổ sung trong CÙNG giao dịch
 *       (BR-26.1) — không có thiết lập "mồ côi".</li>
 *   <li>Kỳ khác: chỉ xem (gồm cả Quá hạn — chốt 19/09: kỳ quá hạn không thiết lập).</li>
 *   <li>Khoá cả kỳ (UC-31) chặn gán thêm; gỡ thiết lập thừa ở kỳ bị khoá vì trùng kỳ vẫn cho (1a).</li>
 *   <li>Chống chồng kỳ theo đơn vị (BR-22.2): một đơn vị không được thiết lập ở hai kỳ giao
 *       thời gian, không phụ thuộc biểu.</li>
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
    private final RowLevelSecurity rowLevel;

    public PeriodAssignmentService(PeriodAssignmentRepository repository,
                                   PeriodSetupLockService lockService,
                                   PublicationService publicationService,
                                   InputReportService inputReportService,
                                   ReportPeriodService periodService,
                                   ReportUnitService unitService,
                                   TemplateService templateService,
                                   RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.lockService = lockService;
        this.publicationService = publicationService;
        this.inputReportService = inputReportService;
        this.periodService = periodService;
        this.unitService = unitService;
        this.templateService = templateService;
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

    public long countForPeriod(Long periodId) {
        return repository.countByPeriodId(periodId);
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
            // Gỡ thiết lập thừa ở kỳ bị khoá vẫn cho; chỉ gán thêm mới bị chặn (UC-31 1a).
            lockService.assertSetupAllowed(period);
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
            assertNoOverlap(period, units);

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
            long count = repository.countByPeriodId(periodId);
            if (count > 0 && status == PeriodStatus.DRAFT) {
                period = periodService.transition(periodId, PeriodStatus.READY);
            } else if (count == 0 && status == PeriodStatus.READY) {
                period = periodService.transition(periodId, PeriodStatus.DRAFT);
            }
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

    private Map<Long, Template> resolveTemplates(List<Cell> cells) {
        Map<Long, Template> templates = new HashMap<>();
        for (Cell cell : cells) {
            templates.computeIfAbsent(cell.templateId(), templateService::get);
        }
        return templates;
    }

    /**
     * Chống chồng kỳ theo đơn vị (BR-22.2): đơn vị đã được thiết lập ở một kỳ khác giao thời
     * gian thì không gán được ở kỳ này, dù khác biểu. Báo tối đa ba tên đơn vị.
     */
    private void assertNoOverlap(ReportPeriod period, Map<Long, ReportUnit> units) {
        if (period.getFromDate() == null || period.getToDate() == null) {
            throw new ConflictException("Kỳ " + period.getName()
                    + " chưa có mốc thời gian hợp lệ để kiểm tra chồng kỳ.");
        }
        List<PeriodAssignment> clashes = repository.findOverlapping(
                units.keySet(), period.getId(), period.getFromDate(), period.getToDate());
        if (clashes.isEmpty()) {
            return;
        }
        // Gom theo kỳ trùng, giữ thứ tự gặp.
        Map<String, Set<String>> unitNamesByPeriod = new LinkedHashMap<>();
        for (PeriodAssignment clash : clashes) {
            unitNamesByPeriod
                    .computeIfAbsent(clash.getPeriod().getName(), key -> new LinkedHashSet<>())
                    .add(clash.getUnit().getName());
        }
        List<String> parts = new ArrayList<>();
        unitNamesByPeriod.forEach((periodName, unitNames) -> {
            List<String> names = new ArrayList<>(unitNames);
            String shown = names.stream().limit(3).collect(Collectors.joining(", "));
            if (names.size() > 3) {
                shown += " và " + (names.size() - 3) + " đơn vị khác";
            }
            parts.add(shown + " đã được thiết lập ở kỳ " + periodName + " (trùng thời gian).");
        });
        throw new ConflictException("Không thể thiết lập kỳ " + period.getName() + ". " + String.join(" ", parts));
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
