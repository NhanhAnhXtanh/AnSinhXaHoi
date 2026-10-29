package com.dth.frw.module.asxh.summary.service;

import com.dth.frw.domain.asxh.dept.DeptReport;
import com.dth.frw.domain.asxh.dept.DeptReportSheet;
import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import com.dth.frw.module.asxh.dept.query.DeptDataRow;
import com.dth.frw.module.asxh.dept.query.DeptYearDataQuery;
import com.dth.frw.module.asxh.dept.query.DeptYearPeriod;
import com.dth.frw.module.asxh.dept.service.DeptPeriodService;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.module.asxh.summary.query.ScopeKind;
import com.dth.frw.module.asxh.summary.query.SummaryRow;
import com.dth.frw.module.asxh.summary.query.UnitNode;
import com.dth.frw.module.asxh.summary.query.YearRollupRow;
import com.dth.frw.module.asxh.summary.repo.SummaryQueries;
import com.dth.frw.module.asxh.summary.repo.SummaryQueries.ReportRow;
import com.dth.frw.module.asxh.summary.security.SummaryPermissions;
import com.dth.frw.module.asxh.template.service.TemplateService;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.CurrentUser;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dữ liệu màn "Tổng hợp báo cáo" (UC-50..53): danh sách kỳ của năm kèm tình trạng, một kỳ (biểu đã
 * thiết lập, phiên bản theo ngày đầu kỳ, phạm vi đơn vị, số liệu Sở đã lưu chưa), một biểu của kỳ
 * (workbook + script + số liệu đổ vào {@code ctx.shared.rows}), chế độ Theo năm (biểu tổng hợp năm theo
 * mốc 01/07, số liệu từ số liệu Sở nếu năm đã có, không thì tổng hợp sống). Port phần đọc của
 * {@code SummaryReportService} + {@code SummaryReportView} bản Jmix.
 */
@Service
@Transactional(readOnly = true)
public class SummaryReportService {

    /** Endpoint tổng hợp sống — giá trị {@code ctx.shared.summaryDataUrl} mặc định (script tự nối tham số). */
    public static final String LIVE_DATA_URL = "/api/summary/data";

    /** Biểu "nhập hộ" (mỗi dòng một đơn vị) — tổng hợp một dòng / đơn vị ({@code groupByOrg}). */
    private static final Set<String> PER_UNIT_SHORT_NAMES = Set.of("1g");
    private static final String ROLLUP_ORG_NAME = "Tổng hợp theo năm";

    private final SummaryAggregationService aggregation;
    private final SummaryQueries queries;
    private final ReportPeriodService periodService;
    private final TemplateService templateService;
    private final TemplateVersionService templateVersionService;
    private final DeptPeriodService deptPeriodService;
    private final DeptYearDataQuery deptYearData;
    private final DeptYearLockService yearLockService;

    public SummaryReportService(SummaryAggregationService aggregation,
                                SummaryQueries queries,
                                ReportPeriodService periodService,
                                TemplateService templateService,
                                TemplateVersionService templateVersionService,
                                DeptPeriodService deptPeriodService,
                                DeptYearDataQuery deptYearData,
                                DeptYearLockService yearLockService) {
        this.aggregation = aggregation;
        this.queries = queries;
        this.periodService = periodService;
        this.templateService = templateService;
        this.templateVersionService = templateVersionService;
        this.deptPeriodService = deptPeriodService;
        this.deptYearData = deptYearData;
        this.yearLockService = yearLockService;
    }

    // ------------------------------------------------------------------ kiểu trả về

    /** Một đơn vị cho ô phạm vi / script ({@code orgType} = mã kiểu bản Jmix: SO, XA, HUYEN…). */
    public record UnitOption(Long id, String code, String name, String orgType, ReportUnitType unitType,
                             ReportBlock block, String parentCode) {
    }

    /** Một kỳ ở cột trái. */
    public record PeriodItem(Long id, String name, String code, PeriodKind kind, LocalDate fromDate, LocalDate toDate,
                             PeriodStatus status, String statusLabel, long assignedUnits, long reportedUnits,
                             long submittedUnits, long approvedUnits, Instant lastApprovedAt, Long deptReportId,
                             Integer ledgerVersion, boolean pendingDraft) {
    }

    /** Một biểu của kỳ / năm với phiên bản sẽ dùng. */
    public record SheetOption(Long templateId, String templateCode, String shortName, String name,
                              Long versionId, Integer versionNo, LocalDate effectiveFrom, boolean borrowedEarliest) {
    }

    /**
     * Một kỳ (panel phải).
     *
     * @param saveBlockReason kỳ chưa lưu số liệu: vì sao chưa lưu được ({@code null} = lưu được)
     * @param yearLock        năm đã nộp / đã duyệt: lý do không sửa được ({@code null} = sửa được)
     */
    public record PeriodOverview(PeriodItem period, List<SheetOption> sheets, List<UnitOption> units,
                                 Long deptReportId, String saveBlockReason, String yearLock,
                                 boolean canWrite, int yearVersion) {
    }

    /** Một biểu của kỳ để dựng bảng tổng hợp sống. */
    public record PeriodSheet(Long periodId, String periodName, Long templateId, String sheetCode, String shortName,
                              String sheetName, String reportType, Long versionId, Integer versionNo,
                              boolean borrowedEarliest, String workbookJson, String scriptText, boolean groupByOrg,
                              int periodCount, String summaryDataUrl, List<SummaryRow> rows) {
    }

    /** Một năm ở danh sách năm. */
    public record YearItem(int year, int ledgerVersion, String lockReason) {
    }

    /**
     * Chế độ Theo năm.
     *
     * @param source "DEPT" = đọc số liệu Sở đã lưu (năm có ít nhất một kỳ đã lưu); "LIVE" = tổng hợp sống
     */
    public record YearOverview(int year, int ledgerVersion, String source, int savedPeriods, int totalPeriods,
                               String lockReason, List<SheetOption> sheets, List<DeptYearPeriod> periods,
                               List<String> unfinishedSheets) {
    }

    /** Một biểu tổng hợp năm. {@code a}/{@code b} = năm cho script cũ ({@code ctx.shared.a/b}, a = b = năm). */
    public record YearSheet(int year, Long templateId, String sheetCode, String shortName, String sheetName,
                            Long versionId, Integer versionNo, boolean borrowedEarliest, String workbookJson,
                            String scriptText, String source, int ledgerVersion, String summaryDataUrl, int a, int b,
                            List<Map<String, Object>> rows) {
    }

    // ------------------------------------------------------------------ theo kỳ

    /** Kỳ của năm kèm tình trạng tổng hợp, cũ trước. */
    public List<PeriodItem> periods(int year) {
        List<ReportPeriod> periods = queries.periodsOfYear(year).stream()
                .filter(period -> period.getStatus() != PeriodStatus.CANCELLED)
                .toList();
        List<Long> ids = periods.stream().map(ReportPeriod::getId).toList();
        Map<Long, Long> assigned = queries.assignedUnitCounts(ids);
        Map<Long, List<ReportRow>> reports = new HashMap<>();
        for (ReportRow row : queries.currentReports(ids)) {
            reports.computeIfAbsent(row.periodId(), key -> new ArrayList<>()).add(row);
        }
        Map<Long, Instant> approvals = queries.lastApprovals(ids);
        Map<Long, DeptReport> dept = deptPeriodService.byPeriods(ids);
        Set<Long> pending = new HashSet<>();
        for (DeptReport report : dept.values()) {
            for (DeptReportSheet sheet : deptPeriodService.sheets(report.getId())) {
                if (sheet.hasPendingDraft()) {
                    pending.add(report.getPeriod().getId());
                }
            }
        }
        List<PeriodItem> result = new ArrayList<>(periods.size());
        for (ReportPeriod period : periods) {
            result.add(item(period, assigned.getOrDefault(period.getId(), 0L),
                    reports.getOrDefault(period.getId(), List.of()), approvals.get(period.getId()),
                    dept.get(period.getId()), pending.contains(period.getId())));
        }
        return result;
    }

    /** Một kỳ: biểu đã thiết lập (phiên bản theo ngày đầu kỳ), đơn vị có phiếu, số liệu Sở. */
    public PeriodOverview overview(Long periodId) {
        ReportPeriod period = periodService.get(periodId);
        List<Long> leaves = aggregation.resolveLeafPeriodIds(periodId);
        List<ReportRow> reports = queries.currentReports(List.of(periodId));
        Optional<DeptReport> dept = deptPeriodService.findByPeriod(periodId);
        boolean pending = dept.map(report -> deptPeriodService.sheets(report.getId()).stream()
                .anyMatch(DeptReportSheet::hasPendingDraft)).orElse(false);
        PeriodItem item = item(period, queries.assignedUnitCounts(List.of(periodId)).getOrDefault(periodId, 0L),
                reports, queries.lastApprovals(List.of(periodId)).get(periodId), dept.orElse(null), pending);
        List<SheetOption> sheets = new ArrayList<>();
        for (Template template : queries.assignedTemplates(periodId)) {
            if (template.getKind() == TemplateKind.CHI_TIET) {
                sheets.add(sheetOption(template, period.getFromDate()));
            }
        }
        List<UnitOption> units = queries.assignedUnits(leaves, null, null).stream().map(this::unitOption).toList();
        String yearLock = yearLockService.lockReason(period.getYear()).orElse(null);
        return new PeriodOverview(item, sheets, units, dept.map(DeptReport::getId).orElse(null),
                dept.isPresent() ? null : deptPeriodService.blockReason(period), yearLock,
                CurrentUser.has(SummaryPermissions.SUMMARY_WRITE), deptYearData.currentVersion(period.getYear()));
    }

    /**
     * Một biểu của kỳ: workbook phiên bản theo ngày đầu kỳ + script + số liệu tổng hợp sống theo phạm vi.
     * Biểu nhập hộ (1g) trả số theo từng đơn vị.
     */
    public PeriodSheet periodSheet(Long periodId, Long templateId, ScopeKind scopeKind, Long organizationId,
                                   String orgType, String block) {
        ReportPeriod period = periodService.get(periodId);
        Template template = templateService.get(templateId);
        TemplateVersion version = templateVersionService.resolveOrEarliest(templateId, period.getFromDate())
                .orElseThrow(() -> new ResourceNotFoundException("Phiên bản biểu mẫu áp dụng cho kỳ", templateId));
        boolean borrowed = version.getEffectiveFrom() != null && version.getEffectiveFrom().isAfter(period.getFromDate());
        boolean perUnit = isPerUnit(template);
        List<Long> leaves = aggregation.resolveLeafPeriodIds(periodId);
        Set<Long> unitIds = aggregation.resolveScope(scopeKind, organizationId, orgType, block);
        List<SummaryRow> rows = aggregation.data(leaves, unitIds, templateId, perUnit);
        int periodCount = rows.stream().mapToInt(SummaryRow::periodCount).max().orElse(0);
        return new PeriodSheet(period.getId(), period.getName(), template.getId(), template.getCode(),
                template.getShortName(), template.getName(), template.getShortName(), version.getId(),
                version.getVersionNo(), borrowed, version.getWorkbookJson(), version.getScriptText(), perUnit,
                periodCount, LIVE_DATA_URL, rows);
    }

    /**
     * Đơn vị ĐƯỢC GIAO biểu trong tập kỳ (kể cả chưa nộp) — {@code /summary/period-organizations} của script.
     *
     * @param sourceSheetCode mã nội bộ biểu; {@code reportType} tên ngắn ("1a"); bỏ trống cả hai = mọi đơn vị
     */
    public List<UnitOption> periodOrganizations(List<Long> periodIds, String sourceSheetCode, String reportType) {
        return queries.assignedUnits(periodIds, sourceSheetCode, reportType).stream().map(this::unitOption).toList();
    }

    /** Danh mục đơn vị cho script cũ ({@code /master/organization-units}), lọc theo loại kiểu bản Jmix. */
    public List<UnitOption> organizationUnits(List<String> orgTypes) {
        Set<String> wanted = new HashSet<>();
        if (orgTypes != null) {
            for (String type : orgTypes) {
                if (type != null && !type.isBlank()) {
                    wanted.add(type.trim().toUpperCase(Locale.ROOT));
                }
            }
        }
        List<UnitOption> result = new ArrayList<>();
        for (UnitNode unit : queries.units()) {
            UnitOption option = unitOption(unit);
            if (wanted.isEmpty() || wanted.contains(option.orgType())) {
                result.add(option);
            }
        }
        return result;
    }

    // ------------------------------------------------------------------ theo năm

    /** Các năm có lịch báo cáo, mới trước. */
    public List<YearItem> years() {
        List<YearItem> result = new ArrayList<>();
        for (Integer year : queries.calendarYears()) {
            result.add(new YearItem(year, deptYearData.currentVersion(year),
                    yearLockService.lockReason(year).orElse(null)));
        }
        return result;
    }

    /** Chế độ Theo năm (UC-52). */
    public YearOverview year(int year) {
        checkYear(year);
        int version = deptYearData.currentVersion(year);
        List<DeptYearPeriod> periods = deptYearData.periods(year);
        int saved = (int) periods.stream().filter(period -> period.deptReportId() != null).count();
        List<SheetOption> sheets = yearSheets(year);
        return new YearOverview(year, version, saved > 0 ? "DEPT" : "LIVE", saved, periods.size(),
                yearLockService.lockReason(year).orElse(null), sheets, periods, deptYearData.unfinishedSheets(year));
    }

    /**
     * Một biểu tổng hợp năm: workbook phiên bản theo mốc 01/07 (BR-52.2) + script. Năm đã có số liệu Sở thì
     * script đọc số liệu Sở ở phiên bản mới nhất ({@code /api/dept_years/{year}/data}); không thì tổng hợp
     * sống theo năm dương lịch ({@code /api/summary/data}).
     */
    public YearSheet yearSheet(int year, Long templateId) {
        checkYear(year);
        Template template = templateService.get(templateId);
        LocalDate anchor = LocalDate.of(year, 7, 1);
        TemplateVersion version = templateVersionService.resolveOrEarliest(templateId, anchor)
                .orElseThrow(() -> new ResourceNotFoundException("Phiên bản biểu tổng hợp năm", templateId));
        boolean borrowed = version.getEffectiveFrom() != null && version.getEffectiveFrom().isAfter(anchor);
        int ledgerVersion = deptYearData.currentVersion(year);
        boolean dept = deptYearData.periods(year).stream().anyMatch(period -> period.deptReportId() != null)
                && ledgerVersion > 0;
        List<Map<String, Object>> rows = dept ? deptRollupRows(year, ledgerVersion) : liveRollupRows(year);
        return new YearSheet(year, template.getId(), template.getCode(), template.getShortName(), template.getName(),
                version.getId(), version.getVersionNo(), borrowed, version.getWorkbookJson(), version.getScriptText(),
                dept ? "DEPT" : "LIVE", ledgerVersion,
                dept ? "/api/dept_years/" + year + "/data" : LIVE_DATA_URL, year, year, rows);
    }

    // ------------------------------------------------------------------ nội bộ

    private List<SheetOption> yearSheets(int year) {
        LocalDate anchor = LocalDate.of(year, 7, 1);
        List<SheetOption> sheets = new ArrayList<>();
        for (Template template : queries.publishedTemplatesOfKind(TemplateKind.TONG_HOP)) {
            SheetOption option = sheetOption(template, anchor);
            if (option.versionId() != null) {
                sheets.add(option);
            }
        }
        // Biểu "01-…" đứng đầu, phụ lục theo tên (UC-52 bước 2).
        sheets.sort(Comparator.comparing((SheetOption option) -> !startsWith01(option))
                .thenComparing(option -> option.name() == null ? "" : option.name().toLowerCase(Locale.ROOT)));
        return sheets;
    }

    private static boolean startsWith01(SheetOption option) {
        String shortName = option.shortName() == null ? "" : option.shortName().trim();
        String name = option.name() == null ? "" : option.name().trim();
        return shortName.startsWith("01") || name.startsWith("01");
    }

    private SheetOption sheetOption(Template template, LocalDate date) {
        Optional<TemplateVersion> version = templateVersionService.resolveOrEarliest(template.getId(), date);
        return new SheetOption(template.getId(), template.getCode(), template.getShortName(), template.getName(),
                version.map(TemplateVersion::getId).orElse(null),
                version.map(TemplateVersion::getVersionNo).orElse(null),
                version.map(TemplateVersion::getEffectiveFrom).orElse(null),
                version.map(v -> v.getEffectiveFrom() != null && v.getEffectiveFrom().isAfter(date)).orElse(false));
    }

    private PeriodItem item(ReportPeriod period, long assignedUnits, List<ReportRow> reports, Instant lastApproval,
                            DeptReport dept, boolean pendingDraft) {
        Set<Long> reported = new HashSet<>();
        Set<Long> submitted = new HashSet<>();
        Set<Long> approved = new HashSet<>();
        for (ReportRow row : reports) {
            reported.add(row.unitId());
            if (row.status() == ReportStatus.SUBMITTED) {
                submitted.add(row.unitId());
            }
            if (row.effective()) {
                approved.add(row.unitId());
            }
        }
        return new PeriodItem(period.getId(), period.getName(), period.getCode(), period.getKind(),
                period.getFromDate(), period.getToDate(), period.getStatus(), period.getStatus().label(),
                assignedUnits, reported.size(), submitted.size(), approved.size(), lastApproval,
                dept == null ? null : dept.getId(), dept == null ? null : dept.getLedgerVersion(), pendingDraft);
    }

    private UnitOption unitOption(UnitNode unit) {
        return new UnitOption(unit.id(), unit.budgetCode(), unit.name(), legacyOrgType(unit.unitType()),
                unit.unitType(), unit.block(), null);
    }

    /** Mã loại đơn vị kiểu bản Jmix mà script cũ so sánh ({@code orgType === 'XA'}…). */
    static String legacyOrgType(ReportUnitType type) {
        if (type == null) {
            return "KHAC";
        }
        return switch (type) {
            case UBND_XA -> "XA";
            case UBND_HUYEN -> "HUYEN";
            default -> type.name();
        };
    }

    private static boolean isPerUnit(Template template) {
        String shortName = template.getShortName();
        return shortName != null && PER_UNIT_SHORT_NAMES.contains(shortName.trim().toLowerCase(Locale.ROOT));
    }

    /**
     * Dòng {@code ctx.shared.rows} cho biểu năm: mỗi chỉ tiêu hai dòng {@code <mã>#HK1} / {@code <mã>#HK2}
     * (slot cột của mẫu biểu năm). Script năm hiện hành tự gọi API theo nửa năm nên dòng này vô hại.
     */
    private List<Map<String, Object>> liveRollupRows(int year) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (YearRollupRow row : aggregation.yearRollup(year, null, null)) {
            rows.add(tempRow(row.indicatorCode() + "#HK1", row.indicatorName(), row.quantityHk1(), row.amountHk1()));
            rows.add(tempRow(row.indicatorCode() + "#HK2", row.indicatorName(), row.quantityHk2(), row.amountHk2()));
        }
        return rows;
    }

    private List<Map<String, Object>> deptRollupRows(int year, int version) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (DeptDataRow row : deptYearData.data(year, version, LocalDate.of(year, 1, 1), LocalDate.of(year, 6, 30),
                null, null, false)) {
            rows.add(tempRow(row.indicatorCode() + "#HK1", row.indicatorName(), row.quantity(), row.amount()));
        }
        for (DeptDataRow row : deptYearData.data(year, version, LocalDate.of(year, 7, 1), LocalDate.of(year, 12, 31),
                null, null, false)) {
            rows.add(tempRow(row.indicatorCode() + "#HK2", row.indicatorName(), row.quantity(), row.amount()));
        }
        return rows;
    }

    private static Map<String, Object> tempRow(String code, String name, BigDecimal quantity, BigDecimal amount) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("organizationCode", SummaryAggregator.MERGED_CODE);
        row.put("organizationName", ROLLUP_ORG_NAME);
        row.put("indicatorCode", code);
        row.put("indicatorName", name == null ? code : name);
        row.put("quantity", quantity);
        row.put("amount", amount);
        return row;
    }

    /** Năm ngoài biên làm {@code LocalDate.of} ném lỗi không phải 400 — chặn ngay ở cửa. */
    public static void checkYear(int year) {
        if (year < 1900 || year > 2200) {
            throw new IllegalArgumentException("Năm phải trong khoảng 1900–2200.");
        }
    }
}
