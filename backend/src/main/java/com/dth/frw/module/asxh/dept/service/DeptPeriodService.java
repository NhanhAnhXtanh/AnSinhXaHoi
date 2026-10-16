package com.dth.frw.module.asxh.dept.service;

import com.dth.frw.domain.asxh.dept.DeptChange;
import com.dth.frw.domain.asxh.dept.DeptChangeAction;
import com.dth.frw.domain.asxh.dept.DeptLedgerLine;
import com.dth.frw.domain.asxh.dept.DeptLedgerSlot;
import com.dth.frw.domain.asxh.dept.DeptReport;
import com.dth.frw.domain.asxh.dept.DeptReportSheet;
import com.dth.frw.domain.asxh.dept.DeptReportSource;
import com.dth.frw.domain.asxh.dept.MeasureKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.dept.query.DeptHistoryEntry;
import com.dth.frw.module.asxh.dept.repo.DeptChangeRepository;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerLineRepository;
import com.dth.frw.module.asxh.dept.repo.DeptReportRepository;
import com.dth.frw.module.asxh.dept.repo.DeptReportSheetRepository;
import com.dth.frw.module.asxh.dept.repo.DeptReportSourceRepository;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.module.asxh.summary.query.SummaryRow;
import com.dth.frw.module.asxh.summary.repo.SummaryQueries;
import com.dth.frw.module.asxh.summary.repo.SummaryQueries.ReportRow;
import com.dth.frw.module.asxh.summary.service.SummaryAggregationService;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.CurrentUser;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Số liệu tổng hợp Sở theo KỲ: lưu kỳ đã chốt (UC-54 / chốt đợt BR-27.1), tra cứu, nguồn đã đổi,
 * lịch sử (UC-56) — port phần kỳ của {@code DeptReportService} bản Jmix.
 *
 * <p><b>Lưu kỳ</b> = lập {@link DeptReport} + đóng băng tập phiếu đơn vị còn hiệu lực
 * ({@link DeptReportSource}) + chụp số tổng hợp của MỌI biểu đã thiết lập cho kỳ, THEO TỪNG ĐƠN VỊ
 * (đã gộp qua kỳ lá theo bản chất chỉ tiêu), thành MỘT phiên bản kế tiếp của năm. Chỉ một lần cho mỗi
 * kỳ (BR-54.1); sau đó Sở sửa số ở {@link DeptSheetService}.
 *
 * <p>Phiên bản biểu của kỳ chọn theo NGÀY ĐẦU KỲ (BR-50.5); kỳ đứng trước mọi phiên bản thì mượn bản
 * ban hành sớm nhất (UC-19 1a).
 */
@Service
public class DeptPeriodService {

    private static final Logger log = LoggerFactory.getLogger(DeptPeriodService.class);

    private final DeptReportRepository reportRepository;
    private final DeptReportSheetRepository sheetRepository;
    private final DeptLedgerLineRepository lineRepository;
    private final DeptReportSourceRepository sourceRepository;
    private final DeptChangeRepository changeRepository;
    private final DeptLedgerVersionService versionService;
    private final DeptYearLockService yearLockService;
    private final SummaryAggregationService aggregation;
    private final SummaryQueries queries;
    private final ReportPeriodService periodService;
    private final TemplateVersionService templateVersionService;
    private final EntityManager entityManager;

    public DeptPeriodService(DeptReportRepository reportRepository,
                             DeptReportSheetRepository sheetRepository,
                             DeptLedgerLineRepository lineRepository,
                             DeptReportSourceRepository sourceRepository,
                             DeptChangeRepository changeRepository,
                             DeptLedgerVersionService versionService,
                             DeptYearLockService yearLockService,
                             SummaryAggregationService aggregation,
                             SummaryQueries queries,
                             ReportPeriodService periodService,
                             TemplateVersionService templateVersionService,
                             EntityManager entityManager) {
        this.reportRepository = reportRepository;
        this.sheetRepository = sheetRepository;
        this.lineRepository = lineRepository;
        this.sourceRepository = sourceRepository;
        this.changeRepository = changeRepository;
        this.versionService = versionService;
        this.yearLockService = yearLockService;
        this.aggregation = aggregation;
        this.queries = queries;
        this.periodService = periodService;
        this.templateVersionService = templateVersionService;
        this.entityManager = entityManager;
    }

    // ------------------------------------------------------------------ tra cứu

    @Transactional(readOnly = true)
    public DeptReport get(Long id) {
        return reportRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Số liệu tổng hợp đã lưu của kỳ", id));
    }

    @Transactional(readOnly = true)
    public Optional<DeptReport> findByPeriod(Long periodId) {
        return reportRepository.findByPeriodId(periodId);
    }

    @Transactional(readOnly = true)
    public Map<Long, DeptReport> byPeriods(Collection<Long> periodIds) {
        Map<Long, DeptReport> result = new HashMap<>();
        if (periodIds.isEmpty()) {
            return result;
        }
        for (DeptReport report : reportRepository.findByPeriodIdIn(periodIds)) {
            result.put(report.getPeriod().getId(), report);
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<DeptReport> ofYear(int year) {
        return reportRepository.findByYear(year);
    }

    @Transactional(readOnly = true)
    public List<DeptReportSheet> sheets(Long reportId) {
        return sheetRepository.findByReport(reportId);
    }

    /**
     * Kỳ có đang là nguồn số liệu Sở không — số liệu của chính nó, hoặc của kỳ tổng chứa nó. Thu hồi kỳ
     * (xoá hẳn số liệu đơn vị) phải bị chặn khi còn như vậy — {@code PeriodLifecycleService.withdraw} gọi.
     */
    @Transactional(readOnly = true)
    public boolean isUsedBy(ReportPeriod period) {
        if (reportRepository.findByPeriodId(period.getId()).isPresent()) {
            return true;
        }
        return reportRepository.findOverlapping(period.getId(), period.getFromDate(), period.getToDate()).stream()
                .anyMatch(other -> !other.getPeriod().getFromDate().isAfter(period.getFromDate())
                        && !other.getPeriod().getToDate().isBefore(period.getToDate()));
    }

    /**
     * Vì sao chưa lưu được kỳ này; {@code null} = lưu được. Kỳ phải đã chốt đợt, không còn phiếu chờ
     * duyệt, không chồng thời gian với kỳ KHÁC đã có số liệu Sở (năm cộng các kỳ — chồng nhau là cộng
     * trùng).
     */
    @Transactional(readOnly = true)
    public String blockReason(ReportPeriod period) {
        if (period.getStatus() != PeriodStatus.CLOSED && period.getStatus() != PeriodStatus.LOCKED) {
            return "Kỳ " + period.getName() + " chưa chốt đợt nên chưa lưu được số liệu tổng hợp.";
        }
        String pending = pendingReason(period);
        return pending != null ? pending : overlapReason(period);
    }

    /** Tập phiếu đơn vị còn hiệu lực HIỆN TẠI đã khác tập đóng băng lúc lưu chưa (BR-55.4). */
    @Transactional(readOnly = true)
    public boolean isSourceStale(DeptReport report) {
        List<Long> leaves = aggregation.resolveLeafPeriodIds(report.getPeriod().getId());
        String now = fingerprint(effectiveReports(leaves));
        return !now.equals(report.getSourceFingerprint());
    }

    // ------------------------------------------------------------------ lưu kỳ

    /**
     * "Lưu số liệu" cho kỳ đã chốt đợt mà chưa lưu (UC-54).
     *
     * @throws ConflictException đã lưu / chưa chốt đợt / còn phiếu chờ duyệt / chồng thời gian / không có
     *                           biểu / năm đang khoá
     */
    @Transactional
    public DeptReport saveClosedPeriod(Long periodId) {
        ReportPeriod period = periodService.get(periodId);
        if (reportRepository.findByPeriodId(periodId).isPresent()) {
            throw new ConflictException("Kỳ " + period.getName() + " đã lưu số liệu tổng hợp rồi.");
        }
        String blocked = blockReason(period);
        if (blocked != null) {
            throw new ConflictException(blocked);
        }
        yearLockService.assertOpen(period.getYear());
        DeptReport report = snapshot(period);
        if (report == null) {
            throw new ConflictException("Kỳ " + period.getName() + " chưa thiết lập biểu nào nên không có số liệu để lưu.");
        }
        return report;
    }

    /**
     * Gọi trong giao dịch CHỐT ĐỢT (kỳ vừa sang Đã đóng, BR-27.1): lưu số liệu tổng hợp của kỳ. Không lưu
     * (trả {@code null}) khi kỳ đã có số liệu Sở, chồng thời gian với kỳ đã lưu, năm đang khoá, hoặc kỳ
     * không có biểu. Quyền đã kiểm ở bước chốt đợt — {@code PeriodLifecycleService.close} gọi.
     */
    @Transactional
    public DeptReport snapshotClosedPeriod(ReportPeriod period) {
        if (reportRepository.findByPeriodId(period.getId()).isPresent() || overlapReason(period) != null
                || yearLockService.lockReason(period.getYear()).isPresent()) {
            return null;
        }
        return snapshot(period);
    }

    private DeptReport snapshot(ReportPeriod period) {
        record Form(Template template, TemplateVersion version) {
        }
        List<Form> forms = new ArrayList<>();
        for (Template template : queries.assignedTemplates(period.getId())) {
            if (template.getKind() != TemplateKind.CHI_TIET) {
                continue;
            }
            Optional<TemplateVersion> version = templateVersionService.resolveOrEarliest(template.getId(),
                    period.getFromDate());
            if (version.isEmpty()) {
                log.warn("Bỏ qua biểu {} khi lưu số liệu kỳ {}: chưa có phiên bản đã ban hành.",
                        template.getShortName(), period.getName());
                continue;
            }
            forms.add(new Form(template, version.get()));
        }
        if (forms.isEmpty()) {
            return null;
        }

        int year = period.getYear();
        // Khoá bộ đếm của năm trước khi ghi: mọi lượt ghi số liệu Sở của năm xếp hàng tại đây.
        int version = versionService.nextVersion(year);
        String actor = CurrentUser.username().orElse("hệ thống");
        Instant now = Instant.now();
        List<Long> leaves = aggregation.resolveLeafPeriodIds(period.getId());
        List<ReportRow> sources = effectiveReports(leaves);
        Set<Long> sourceIds = sources.stream().map(ReportRow::reportId).collect(Collectors.toSet());

        Map<Form, List<SummaryRow>> rowsByForm = new LinkedHashMap<>();
        int rowCount = 0;
        for (Form form : forms) {
            List<SummaryRow> rows = aggregation.aggregateRows(leaves, null, form.template().getId(), sourceIds);
            rowsByForm.put(form, rows);
            rowCount += rows.size();
        }

        DeptReport report = new DeptReport(period, year);
        report.setLedgerVersion(version);
        report.setSourceCount(sources.size());
        report.setSourceFingerprint(fingerprint(sources));
        report.setCreatedBy(actor);
        report = reportRepository.save(report);
        for (ReportRow source : sources) {
            sourceRepository.save(new DeptReportSource(report, source.reportId(), source.unitId(), source.periodId(),
                    source.revisionNo(), source.approvedAt()));
        }

        DeptChange change = changeRepository.save(new DeptChange(year, report.getId(), null,
                DeptChangeAction.PERIOD_SAVED, version, rowCount,
                "Lưu số liệu tổng hợp " + period.getName(), actor, now));

        Map<Long, ReportUnit> units = new HashMap<>();
        int order = 0;
        for (Map.Entry<Form, List<SummaryRow>> entry : rowsByForm.entrySet()) {
            Form form = entry.getKey();
            DeptReportSheet sheet = sheetRepository.save(new DeptReportSheet(report, form.template(), form.version(),
                    order++));
            int rowOrder = 0;
            for (SummaryRow row : entry.getValue()) {
                ReportUnit unit = row.unitId() == null ? null
                        : units.computeIfAbsent(row.unitId(), id -> entityManager.getReference(ReportUnit.class, id));
                DeptLedgerLine line = new DeptLedgerLine(report, sheet, row.organizationCode(), unit,
                        row.indicatorCode(), DeptLedgerSlot.ALL, version);
                line.setIndicatorName(row.indicatorName() == null ? row.indicatorCode() : row.indicatorName());
                line.setMeasureKind(MeasureKind.parse(row.measureKind()));
                line.setSourceQuantity(DeptLedgerPlanner.exact(row.quantity()));
                line.setSourceAmount(DeptLedgerPlanner.exact(row.amount()));
                line.setQuantity(DeptLedgerPlanner.exact(row.quantity()));
                line.setAmount(DeptLedgerPlanner.exact(row.amount()));
                line.setOrderNo(rowOrder++);
                line.setChangeId(change.getId());
                lineRepository.save(line);
            }
        }
        return report;
    }

    // ------------------------------------------------------------------ lịch sử

    /** Lịch sử số liệu Sở của MỘT kỳ, mới trước. */
    @Transactional(readOnly = true)
    public List<DeptHistoryEntry> periodHistory(Long reportId) {
        DeptReport report = get(reportId);
        return history(changeRepository.findByReport(reportId), Map.of(report.getId(), report));
    }

    /** Lịch sử số liệu Sở của năm (mọi kỳ + mốc báo cáo năm), mới trước. */
    @Transactional(readOnly = true)
    public List<DeptHistoryEntry> yearHistory(int year) {
        Map<Long, DeptReport> reports = reportRepository.findByYear(year).stream()
                .collect(Collectors.toMap(DeptReport::getId, report -> report));
        return history(changeRepository.findByYear(year), reports);
    }

    private List<DeptHistoryEntry> history(List<DeptChange> changes, Map<Long, DeptReport> reports) {
        Map<Long, String> labels = new HashMap<>();
        for (DeptReport report : reports.values()) {
            for (DeptReportSheet sheet : sheetRepository.findByReport(report.getId())) {
                labels.putIfAbsent(sheet.getTemplate().getId(), sheet.getTemplate().getShortName());
            }
        }
        List<DeptHistoryEntry> result = new ArrayList<>(changes.size());
        for (DeptChange change : changes) {
            DeptReport report = change.getReportId() == null ? null : reports.get(change.getReportId());
            String scope = report != null ? report.getPeriod().getName() : "Báo cáo năm " + change.getReportYear();
            String sheetLabel = change.getTemplateId() == null ? ""
                    : labels.getOrDefault(change.getTemplateId(), "");
            result.add(new DeptHistoryEntry(change.getOccurredAt(), change.getAction(), actionLabel(change.getAction()),
                    scope, report == null ? null : report.getPeriod().getId(), change.getReportId(),
                    change.getAnnualRef(), change.getTemplateId(), sheetLabel, change.getVersionNo(),
                    change.getRowCount(), change.getActor(), change.getNote()));
        }
        return result;
    }

    /** Chữ người dùng thấy cho từng loại mốc. */
    public static String actionLabel(DeptChangeAction action) {
        if (action == null) {
            return "";
        }
        return switch (action) {
            case PERIOD_SAVED -> "Lưu số liệu kỳ";
            case SHEET_SAVED -> "Sửa số liệu";
            case RESTORED -> "Khôi phục phiên bản";
            case YEAR_SUBMITTED -> "Nộp báo cáo năm";
            case YEAR_APPROVED -> "UBND duyệt";
            case YEAR_RETURNED -> "UBND trả lại";
            case YEAR_REOPENED -> "UBND mở lại";
        };
    }

    // ------------------------------------------------------------------ nội bộ

    private String pendingReason(ReportPeriod period) {
        List<Long> leaves = aggregation.resolveLeafPeriodIds(period.getId());
        List<String> pending = queries.currentReports(leaves).stream()
                .filter(row -> row.status() == ReportStatus.SUBMITTED)
                .map(ReportRow::unitName)
                .distinct()
                .toList();
        if (pending.isEmpty()) {
            return null;
        }
        String names = String.join(", ", pending.stream().limit(5).toList());
        if (pending.size() > 5) {
            names += " và " + (pending.size() - 5) + " đơn vị khác";
        }
        return "Còn " + pending.size() + " đơn vị đã nộp nhưng chưa được duyệt hoặc trả lại: " + names
                + ". Duyệt hoặc trả lại hết rồi mới lưu được số liệu tổng hợp.";
    }

    private String overlapReason(ReportPeriod period) {
        List<DeptReport> overlapping = reportRepository.findOverlapping(period.getId(), period.getFromDate(),
                period.getToDate());
        if (overlapping.isEmpty()) {
            return null;
        }
        String names = overlapping.stream().map(report -> report.getPeriod().getName())
                .collect(Collectors.joining(", "));
        return "Kỳ " + period.getName() + " trùng thời gian với kỳ đã lưu số liệu (" + names
                + ") — lưu cả hai sẽ cộng trùng số liệu trong năm.";
    }

    private List<ReportRow> effectiveReports(List<Long> periodIds) {
        return queries.currentReports(periodIds).stream().filter(ReportRow::effective).toList();
    }

    /** SHA-256 của tập "id:revisionNo" đã sắp xếp — không phụ thuộc thứ tự nạp. */
    static String fingerprint(List<ReportRow> reports) {
        String canonical = reports.stream()
                .map(row -> row.reportId() + ":" + row.revisionNo())
                .sorted()
                .collect(Collectors.joining("\n"));
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
