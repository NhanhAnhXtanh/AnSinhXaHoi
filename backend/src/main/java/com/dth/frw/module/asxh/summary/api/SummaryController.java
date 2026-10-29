package com.dth.frw.module.asxh.summary.api;

import com.dth.frw.module.asxh.annual.security.AnnualReportPermissions;
import com.dth.frw.module.asxh.summary.api.dto.SnapshotRequest;
import com.dth.frw.module.asxh.summary.query.ScopeKind;
import com.dth.frw.module.asxh.summary.query.SummaryRow;
import com.dth.frw.module.asxh.summary.query.YearRollupRow;
import com.dth.frw.module.asxh.summary.security.SummaryPermissions;
import com.dth.frw.module.asxh.summary.service.SummaryAggregationService;
import com.dth.frw.module.asxh.summary.service.SummaryReportService;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.PeriodItem;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.PeriodOverview;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.PeriodSheet;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.UnitOption;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.YearItem;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.YearOverview;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.YearSheet;
import com.dth.frw.module.asxh.summary.service.SummarySnapshotService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Màn "Tổng hợp báo cáo" và các endpoint số liệu mà script mẫu biểu gọi qua {@code ctx.api}.
 *
 * <p><b>Tương thích script bản Jmix</b>: script cũ gọi {@code /rest/qt/summary/...}; phía trình duyệt
 * đổi thành {@code <API_URL>/summary/...} = {@code /api/summary/...}. Vì vậy {@code /data},
 * {@code /school-year}, {@code /period-organizations} giữ ĐÚNG tên đường dẫn (có gạch ngang), tham số
 * và dạng JSON của bản Jmix; id là số thay cho UUID.
 *
 * <ul>
 *   <li>{@code GET /data?periodId=|from=&to=&scopeKind=&organizationId=&orgType=&block=&sourceSheetCode=&groupByOrg=}
 *       → mảng {@code SummaryRow}.</li>
 *   <li>{@code GET /school-year?schoolYear=&…} → mảng {@code YearRollupRow} (năm dương lịch).</li>
 *   <li>{@code GET /period-organizations?periodId=|from=&to=&sourceSheetCode=&reportType=} → đơn vị được giao.</li>
 *   <li>{@code GET /periods?year=} · {@code GET /periods/{id}} · {@code GET /period_sheet?periodId=&templateId=&…}
 *       — màn Theo kỳ.</li>
 *   <li>{@code GET /years} · {@code GET /year?year=} · {@code GET /year_sheet?year=&templateId=} — màn Theo năm.</li>
 *   <li>{@code POST /snapshot} — ảnh chụp (UC-57).</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/summary")
public class SummaryController {

    private final SummaryAggregationService aggregation;
    private final SummaryReportService reportService;
    private final SummarySnapshotService snapshotService;

    public SummaryController(SummaryAggregationService aggregation,
                             SummaryReportService reportService,
                             SummarySnapshotService snapshotService) {
        this.aggregation = aggregation;
        this.reportService = reportService;
        this.snapshotService = snapshotService;
    }

    // ------------------------------------------------------------------ cho script (tương thích Jmix)

    /** Số liệu tổng hợp: một kỳ (giải thành kỳ lá) hoặc dải {@code from}/{@code to} (ưu tiên khi đủ cặp). */
    @GetMapping("/data")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<SummaryRow> data(@RequestParam(required = false) Long periodId,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                 @RequestParam(required = false) String scopeKind,
                                 @RequestParam(required = false) Long organizationId,
                                 @RequestParam(required = false) String orgType,
                                 @RequestParam(required = false) String block,
                                 @RequestParam(required = false) String sourceSheetCode,
                                 @RequestParam(required = false, defaultValue = "false") boolean groupByOrg) {
        List<Long> periodIds = aggregation.resolvePeriodIds(periodId, from, to);
        Set<Long> unitIds = aggregation.resolveScope(ScopeKind.parse(scopeKind), organizationId, orgType, block);
        Long templateId = aggregation.resolveTemplateCode(sourceSheetCode).orElse(null);
        return aggregation.data(periodIds, unitIds, templateId, groupByOrg);
    }

    /** Tổng hợp theo NĂM DƯƠNG LỊCH: một dòng / chỉ tiêu với hai nửa năm (tham số giữ tên {@code schoolYear}). */
    @GetMapping("/school-year")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<YearRollupRow> schoolYear(@RequestParam int schoolYear,
                                          @RequestParam(required = false) String scopeKind,
                                          @RequestParam(required = false) Long organizationId,
                                          @RequestParam(required = false) String orgType,
                                          @RequestParam(required = false) String block,
                                          @RequestParam(required = false) String sourceSheetCode) {
        SummaryReportService.checkYear(schoolYear);
        Set<Long> unitIds = aggregation.resolveScope(ScopeKind.parse(scopeKind), organizationId, orgType, block);
        Optional<Long> template = aggregation.resolveTemplateCode(sourceSheetCode);
        return aggregation.yearRollup(schoolYear, unitIds, template.orElse(null));
    }

    /**
     * Đơn vị ĐƯỢC GIAO biểu trong tập kỳ (kể cả chưa nộp). Người xem báo cáo năm ({@code annual_reports:read},
     * gồm UBND không có quyền Tổng hợp) cũng gọi được: script biểu năm dựng dòng đơn vị từ đây — chỉ là danh
     * sách đơn vị, không có số liệu.
     */
    @GetMapping("/period-organizations")
    @PreAuthorize("hasAnyAuthority('" + SummaryPermissions.SUMMARY_READ + "', '"
            + AnnualReportPermissions.ANNUAL_READ + "')")
    public List<UnitOption> periodOrganizations(
            @RequestParam(required = false) Long periodId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String sourceSheetCode,
            @RequestParam(required = false) String reportType) {
        return reportService.periodOrganizations(aggregation.resolvePeriodIds(periodId, from, to),
                sourceSheetCode, reportType);
    }

    // ------------------------------------------------------------------ màn Theo kỳ

    @GetMapping("/periods")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<PeriodItem> periods(@RequestParam int year) {
        SummaryReportService.checkYear(year);
        return reportService.periods(year);
    }

    @GetMapping("/periods/{periodId}")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public PeriodOverview period(@PathVariable Long periodId) {
        return reportService.overview(periodId);
    }

    @GetMapping("/period_sheet")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public PeriodSheet periodSheet(@RequestParam Long periodId,
                                   @RequestParam Long templateId,
                                   @RequestParam(required = false) String scopeKind,
                                   @RequestParam(required = false) Long organizationId,
                                   @RequestParam(required = false) String orgType,
                                   @RequestParam(required = false) String block) {
        return reportService.periodSheet(periodId, templateId, ScopeKind.parse(scopeKind), organizationId,
                orgType, block);
    }

    // ------------------------------------------------------------------ màn Theo năm

    @GetMapping("/years")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<YearItem> years() {
        return reportService.years();
    }

    @GetMapping("/year")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public YearOverview year(@RequestParam int year) {
        return reportService.year(year);
    }

    @GetMapping("/year_sheet")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public YearSheet yearSheet(@RequestParam int year, @RequestParam Long templateId) {
        return reportService.yearSheet(year, templateId);
    }

    // ------------------------------------------------------------------ ảnh chụp

    @PostMapping("/snapshot")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_WRITE + "')")
    public SummarySnapshotService.SnapshotResult snapshot(@Valid @RequestBody SnapshotRequest request) {
        return snapshotService.save(request.periodId(), request.templateVersionId(), request.workbookJson());
    }
}
