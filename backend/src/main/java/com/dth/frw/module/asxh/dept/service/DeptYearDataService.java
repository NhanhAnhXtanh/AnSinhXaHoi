package com.dth.frw.module.asxh.dept.service;

import com.dth.frw.domain.asxh.dept.DeptLedgerLine;
import com.dth.frw.domain.asxh.dept.DeptReport;
import com.dth.frw.domain.asxh.dept.DeptReportSheet;
import com.dth.frw.domain.asxh.dept.DeptSheetCompletion;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.module.asxh.dept.query.DeptDataRow;
import com.dth.frw.module.asxh.dept.query.DeptHistoryEntry;
import com.dth.frw.module.asxh.dept.query.DeptYearDataQuery;
import com.dth.frw.module.asxh.dept.query.DeptYearPeriod;
import com.dth.frw.module.asxh.dept.repo.DeptChangeRepository;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerLineRepository;
import com.dth.frw.module.asxh.dept.repo.DeptReportSheetRepository;
import com.dth.frw.module.asxh.summary.query.PeriodCell;
import com.dth.frw.module.asxh.summary.query.SummaryRow;
import com.dth.frw.module.asxh.summary.repo.SummaryQueries;
import com.dth.frw.module.asxh.summary.service.SummaryAggregationService;
import com.dth.frw.module.asxh.summary.service.SummaryAggregator;
import com.dth.frw.module.asxh.template.service.TemplateScriptService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cài đặt {@link DeptYearDataQuery} — port {@code DeptYearSourceService} của bản Jmix: số của năm đọc
 * từ số liệu Sở các kỳ ở MỘT phiên bản, gộp qua kỳ theo bản chất chỉ tiêu bằng ĐÚNG phép gộp của tổng
 * hợp sống ({@link SummaryAggregator}).
 */
@Service
@Transactional(readOnly = true)
public class DeptYearDataService implements DeptYearDataQuery {

    private static final Predicate<String> DELTA_ROW = DeptLedgerLine.MERGED_UNIT_KEY::equals;

    private final DeptPeriodService periodService;
    private final DeptReportSheetRepository sheetRepository;
    private final DeptLedgerLineRepository lineRepository;
    private final DeptChangeRepository changeRepository;
    private final DeptLedgerVersionService versionService;
    private final DeptYearLockService yearLockService;
    private final SummaryAggregationService aggregation;
    private final SummaryQueries queries;

    private final TemplateScriptService scriptService;

    public DeptYearDataService(DeptPeriodService periodService,
                               DeptReportSheetRepository sheetRepository,
                               DeptLedgerLineRepository lineRepository,
                               DeptChangeRepository changeRepository,
                               DeptLedgerVersionService versionService,
                               DeptYearLockService yearLockService,
                               SummaryAggregationService aggregation,
                               SummaryQueries queries,
                               TemplateScriptService scriptService) {
        this.scriptService = scriptService;
        this.periodService = periodService;
        this.sheetRepository = sheetRepository;
        this.lineRepository = lineRepository;
        this.changeRepository = changeRepository;
        this.versionService = versionService;
        this.yearLockService = yearLockService;
        this.aggregation = aggregation;
        this.queries = queries;
    }

    @Override
    public int currentVersion(int year) {
        return versionService.currentVersion(year);
    }

    @Override
    public List<DeptYearPeriod> periods(int year) {
        List<DeptReport> reports = periodService.ofYear(year);
        Map<Long, DeptReport> reportByPeriod = new HashMap<>();
        for (DeptReport report : reports) {
            reportByPeriod.put(report.getPeriod().getId(), report);
        }
        Map<Long, List<DeptReportSheet>> sheetsByReport = new HashMap<>();
        if (!reports.isEmpty()) {
            for (DeptReportSheet sheet : sheetRepository.findByReports(reports.stream().map(DeptReport::getId).toList())) {
                sheetsByReport.computeIfAbsent(sheet.getReport().getId(), key -> new ArrayList<>()).add(sheet);
            }
        }
        Map<Long, Instant> lastChange = new HashMap<>();
        if (!reports.isEmpty()) {
            for (Object[] row : changeRepository.lastChanges(reports.stream().map(DeptReport::getId).toList())) {
                lastChange.put((Long) row[0], (Instant) row[1]);
            }
        }
        List<DeptYearPeriod> result = new ArrayList<>();
        for (ReportPeriod period : queries.periodsOfYear(year)) {
            if (period.getStatus() == PeriodStatus.CANCELLED) {
                continue;
            }
            List<Template> forms = queries.assignedTemplates(period.getId()).stream()
                    .filter(template -> template.getKind() == TemplateKind.CHI_TIET)
                    .toList();
            DeptReport report = reportByPeriod.get(period.getId());
            if (forms.isEmpty() && report == null) {
                continue;
            }
            if (report == null && overlapsSaved(period, reports)) {
                continue;
            }
            List<DeptReportSheet> sheets = report == null ? List.of()
                    : sheetsByReport.getOrDefault(report.getId(), List.of());
            List<String> saved = sheets.stream().map(sheet -> sheet.getTemplate().getShortName()).toList();
            List<String> unsaved = forms.stream()
                    .filter(template -> sheets.stream().noneMatch(sheet -> sheet.getTemplate().getId().equals(template.getId())))
                    .map(Template::getShortName)
                    .toList();
            List<String> open = sheets.stream()
                    .filter(sheet -> sheet.getCompletion() != DeptSheetCompletion.COMPLETED
                            && scriptService.hasSummaryHook(sheet.getTemplateVersion()))
                    .map(sheet -> sheet.getTemplate().getShortName())
                    .toList();
            List<String> pending = sheets.stream().filter(DeptReportSheet::hasPendingDraft)
                    .map(sheet -> sheet.getTemplate().getShortName()).toList();
            result.add(new DeptYearPeriod(period.getId(), period.getName(), period.getKind().name(),
                    period.getFromDate(), period.getToDate(), period.getStatus().name(),
                    report == null ? null : report.getId(), saved, unsaved, open, pending,
                    report == null ? null : report.getLedgerVersion(),
                    report == null ? null : lastChange.get(report.getId())));
        }
        result.sort(Comparator.comparing(DeptYearPeriod::fromDate, Comparator.nullsLast(Comparator.naturalOrder())));
        return result;
    }

    @Override
    public List<DeptDataRow> data(int year, int version, LocalDate from, LocalDate to, Set<Long> unitIds,
                                  Long templateId, boolean groupByUnit) {
        List<DeptReport> sources = periodService.ofYear(year).stream()
                .filter(report -> within(report.getPeriod(), from, to))
                .toList();
        if (version < 1 || version > currentVersion(year) || sources.isEmpty()
                || (unitIds != null && unitIds.isEmpty())) {
            return List.of();
        }
        Map<Long, DeptReport> reportById = new HashMap<>();
        for (DeptReport report : sources) {
            reportById.put(report.getId(), report);
        }
        Map<Long, Long> templateBySheet = new HashMap<>();
        for (DeptReportSheet sheet : sheetRepository.findByReports(reportById.keySet())) {
            templateBySheet.put(sheet.getId(), sheet.getTemplate().getId());
        }
        List<DeptLedgerLine> lines = new ArrayList<>(lineRepository.findAtForReports(reportById.keySet(), version));
        // Kỳ cũ trước — "lý do của kỳ muộn nhất thắng" và thứ tự xuất hiện ổn định.
        lines.sort(Comparator
                .comparing((DeptLedgerLine line) -> reportById.get(line.getReport().getId()).getPeriod().getFromDate())
                .thenComparing(line -> line.getOrderNo() == null ? Integer.MAX_VALUE : line.getOrderNo())
                .thenComparing(DeptLedgerLine::getUnitKey));

        List<PeriodCell> current = new ArrayList<>();
        List<PeriodCell> original = new ArrayList<>();
        Map<String, String> reasons = new HashMap<>();
        for (DeptLedgerLine line : lines) {
            if (templateId != null && !templateId.equals(templateBySheet.get(line.getSheetId()))) {
                continue;
            }
            if (unitIds != null && (line.getUnitId() == null || !unitIds.contains(line.getUnitId()))) {
                continue;
            }
            ReportPeriod period = reportById.get(line.getReport().getId()).getPeriod();
            String unitName = line.isMerged() ? DeptSheetService.MERGED_ADJUSTMENT_NAME
                    : line.getUnit() == null ? line.getUnitKey() : line.getUnit().getName();
            current.add(new PeriodCell(period.getId(), period.getFromDate(), line.getUnitKey(), unitName,
                    line.getUnitId(), line.getIndicatorCode(), line.getIndicatorName(), line.getQuantity(),
                    line.getAmount(), line.getOrderNo()));
            original.add(new PeriodCell(period.getId(), period.getFromDate(), line.getUnitKey(), unitName,
                    line.getUnitId(), line.getIndicatorCode(), line.getIndicatorName(), line.getSourceQuantity(),
                    line.getSourceAmount(), line.getOrderNo()));
            if (line.getAdjustReason() != null) {
                reasons.put(key(line.getUnitKey(), line.getIndicatorCode()), line.getAdjustReason());
            }
        }
        List<SummaryRow> rows = aggregation.aggregateCells(current, DELTA_ROW);
        List<SummaryRow> sourceRows = aggregation.aggregateCells(original, DELTA_ROW);
        if (groupByUnit) {
            Map<String, SummaryRow> sourceByKey = index(sourceRows, row -> key(row.organizationCode(), row.indicatorCode()));
            return rows.stream().map(row -> {
                boolean merged = DeptLedgerLine.MERGED_UNIT_KEY.equals(row.organizationCode());
                String rowKey = key(row.organizationCode(), row.indicatorCode());
                return toDto(merged ? SummaryAggregator.MERGED_CODE : row.organizationCode(), row.organizationName(),
                        row, sourceByKey.get(rowKey), reasons.get(rowKey));
            }).toList();
        }
        Map<String, SummaryRow> sourceByIndicator = index(aggregation.mergeByIndicator(sourceRows), SummaryRow::indicatorCode);
        Map<String, String> reasonByIndicator = new HashMap<>();
        reasons.forEach((rowKey, reason) -> reasonByIndicator.put(rowKey.substring(rowKey.indexOf('|') + 1), reason));
        return aggregation.mergeByIndicator(rows).stream()
                .map(row -> toDto(SummaryAggregator.MERGED_CODE, SummaryAggregator.MERGED_NAME, row,
                        sourceByIndicator.get(row.indicatorCode()), reasonByIndicator.get(row.indicatorCode())))
                .toList();
    }

    @Override
    public List<String> unfinishedSheets(int year) {
        List<String> result = new ArrayList<>();
        for (DeptYearPeriod period : periods(year)) {
            for (String sheet : period.openSheets()) {
                result.add("biểu " + sheet + " của " + period.periodName());
            }
            for (String sheet : period.pendingSheets()) {
                if (!period.openSheets().contains(sheet)) {
                    result.add("biểu " + sheet + " của " + period.periodName());
                }
            }
        }
        return result;
    }

    @Override
    public List<DeptHistoryEntry> yearHistory(int year) {
        return periodService.yearHistory(year);
    }

    @Override
    public Optional<String> lockReason(int year) {
        return yearLockService.lockReason(year);
    }

    // ------------------------------------------------------------------ nội bộ

    private static boolean overlapsSaved(ReportPeriod period, List<DeptReport> saved) {
        return saved.stream().map(DeptReport::getPeriod)
                .anyMatch(other -> !other.getFromDate().isAfter(period.getToDate())
                        && !other.getToDate().isBefore(period.getFromDate()));
    }

    private static boolean within(ReportPeriod period, LocalDate from, LocalDate to) {
        return (from == null || !period.getFromDate().isBefore(from))
                && (to == null || !period.getToDate().isAfter(to));
    }

    private static DeptDataRow toDto(String code, String name, SummaryRow row, SummaryRow source, String reason) {
        BigDecimal sq = source == null ? null : source.quantity();
        BigDecimal sa = source == null ? null : source.amount();
        return new DeptDataRow(code, name, row.indicatorCode(), row.indicatorName(), row.quantity(), row.amount(),
                row.quantitySum(), row.quantityMax(), row.measureKind(), row.periodCount(), null, sq, sa,
                DeptLedgerPlanner.isAdjusted(sq, sa, row.quantity(), row.amount()), reason, row.orderNo(),
                row.unitId());
    }

    private static String key(String unitKey, String indicatorCode) {
        return unitKey + "|" + indicatorCode;
    }

    private static Map<String, SummaryRow> index(List<SummaryRow> rows, Function<SummaryRow, String> key) {
        Map<String, SummaryRow> result = new LinkedHashMap<>();
        rows.forEach(row -> result.putIfAbsent(key.apply(row), row));
        return result;
    }
}
