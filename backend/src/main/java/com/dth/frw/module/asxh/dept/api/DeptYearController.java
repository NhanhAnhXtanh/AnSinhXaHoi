package com.dth.frw.module.asxh.dept.api;

import com.dth.frw.module.asxh.dept.query.DeptDataRow;
import com.dth.frw.module.asxh.dept.query.DeptHistoryEntry;
import com.dth.frw.module.asxh.dept.query.DeptYearDataQuery;
import com.dth.frw.module.asxh.dept.query.DeptYearPeriod;
import com.dth.frw.module.asxh.summary.query.ScopeKind;
import com.dth.frw.module.asxh.summary.security.SummaryPermissions;
import com.dth.frw.module.asxh.summary.service.SummaryAggregationService;
import com.dth.frw.module.asxh.summary.service.SummaryReportService;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Số liệu Sở đã lưu theo NĂM (UC-52 khi năm đã có số liệu Sở).
 *
 * <ul>
 *   <li>{@code GET /api/dept_years/{year}/data?from=&to=&scopeKind=&organizationId=&orgType=&block=&sourceSheetCode=&groupByOrg=}
 *       — số năm ở phiên bản mới nhất, cùng dạng {@code /api/summary/data} (script tổng hợp năm đổ được y
 *       nguyên); {@code …/versions/{v}/data} ở một phiên bản.</li>
 *   <li>{@code GET /{year}/periods} — các kỳ của năm và tình trạng số liệu Sở.</li>
 *   <li>{@code GET /{year}/history} — lịch sử số liệu Sở của năm.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/dept_years")
public class DeptYearController {

    private final DeptYearDataQuery yearData;
    private final SummaryAggregationService aggregation;

    public DeptYearController(DeptYearDataQuery yearData, SummaryAggregationService aggregation) {
        this.yearData = yearData;
        this.aggregation = aggregation;
    }

    @GetMapping("/{year}/data")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<DeptDataRow> data(@PathVariable int year,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                  @RequestParam(required = false) String scopeKind,
                                  @RequestParam(required = false) Long organizationId,
                                  @RequestParam(required = false) String orgType,
                                  @RequestParam(required = false) String block,
                                  @RequestParam(required = false) String sourceSheetCode,
                                  @RequestParam(required = false, defaultValue = "false") boolean groupByOrg) {
        SummaryReportService.checkYear(year);
        return read(year, yearData.currentVersion(year), from, to, scopeKind, organizationId, orgType, block,
                sourceSheetCode, groupByOrg);
    }

    @GetMapping("/{year}/versions/{version}/data")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<DeptDataRow> versionData(@PathVariable int year, @PathVariable int version,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                         @RequestParam(required = false) String scopeKind,
                                         @RequestParam(required = false) Long organizationId,
                                         @RequestParam(required = false) String orgType,
                                         @RequestParam(required = false) String block,
                                         @RequestParam(required = false) String sourceSheetCode,
                                         @RequestParam(required = false, defaultValue = "false") boolean groupByOrg) {
        SummaryReportService.checkYear(year);
        if (version < 1 || version > yearData.currentVersion(year)) {
            throw new IllegalArgumentException("Số liệu năm " + year + " không có phiên bản " + version + ".");
        }
        return read(year, version, from, to, scopeKind, organizationId, orgType, block, sourceSheetCode, groupByOrg);
    }

    @GetMapping("/{year}/periods")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<DeptYearPeriod> periods(@PathVariable int year) {
        SummaryReportService.checkYear(year);
        return yearData.periods(year);
    }

    @GetMapping("/{year}/history")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<DeptHistoryEntry> history(@PathVariable int year) {
        SummaryReportService.checkYear(year);
        return yearData.yearHistory(year);
    }

    private List<DeptDataRow> read(int year, int version, LocalDate from, LocalDate to, String scopeKind,
                                   Long organizationId, String orgType, String block, String sourceSheetCode,
                                   boolean groupByOrg) {
        Set<Long> unitIds = aggregation.resolveScope(ScopeKind.parse(scopeKind), organizationId, orgType, block);
        Long templateId = aggregation.resolveTemplateCode(sourceSheetCode).orElse(null);
        if (templateId != null && templateId < 0) {
            return List.of();
        }
        return yearData.data(year, version, from, to, unitIds, templateId, groupByOrg);
    }
}
