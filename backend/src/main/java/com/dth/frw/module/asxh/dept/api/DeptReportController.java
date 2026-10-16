package com.dth.frw.module.asxh.dept.api;

import com.dth.frw.module.asxh.dept.api.dto.DeptReportListItem;
import com.dth.frw.module.asxh.dept.api.dto.DeptRequests.DraftRequest;
import com.dth.frw.module.asxh.dept.api.dto.DeptRequests.ReasonRequest;
import com.dth.frw.module.asxh.dept.api.dto.DeptRequests.RestoreRequest;
import com.dth.frw.module.asxh.dept.api.dto.DeptRequests.SavePeriodRequest;
import com.dth.frw.module.asxh.dept.query.DeptDataRow;
import com.dth.frw.module.asxh.dept.query.DeptHistoryEntry;
import com.dth.frw.module.asxh.dept.service.DeptPeriodService;
import com.dth.frw.module.asxh.dept.service.DeptSheetService;
import com.dth.frw.module.asxh.dept.service.DeptSheetService.CompareResult;
import com.dth.frw.module.asxh.dept.service.DeptSheetService.DraftResult;
import com.dth.frw.module.asxh.dept.service.DeptSheetService.PendingChange;
import com.dth.frw.module.asxh.dept.service.DeptSheetService.ReportDetail;
import com.dth.frw.module.asxh.dept.service.DeptSheetService.SaveResult;
import com.dth.frw.module.asxh.dept.service.DeptSheetService.SheetRuntime;
import com.dth.frw.module.asxh.dept.service.DeptSheetService.VersionEntry;
import com.dth.frw.module.asxh.summary.query.ScopeKind;
import com.dth.frw.module.asxh.summary.security.SummaryPermissions;
import com.dth.frw.module.asxh.summary.service.SummaryAggregationService;
import com.dth.frw.module.asxh.summary.service.SummaryReportService;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Số liệu tổng hợp Sở đã lưu theo kỳ (UC-54, UC-55, UC-56). {@code {sheet}} = id biểu hoặc mã nội bộ
 * biểu (script cũ dùng mã).
 *
 * <ul>
 *   <li>{@code GET /api/dept_reports?year=} — các kỳ đã lưu số liệu (mảng + {@code X-Total-Count}).</li>
 *   <li>{@code POST /api/dept_reports} {@code {periodId}} — "Lưu số liệu" kỳ đã chốt (UC-54).</li>
 *   <li>{@code GET /{id}} — đầu + các biểu; {@code GET /{id}/sheets/{sheet}?version=} — dựng một biểu.</li>
 *   <li>{@code GET /{id}/sheets/{sheet}/data} và {@code …/versions/{v}/data} — số liệu cho script
 *       ({@code ctx.shared.summaryDataUrl}), cùng tham số / dạng {@code /api/summary/data}.</li>
 *   <li>{@code PUT /{id}/sheets/{sheet}/draft} {@code {workbookJson, revision}} — "Lưu dữ liệu".</li>
 *   <li>{@code GET /{id}/sheets/{sheet}/preview}, {@code POST …/complete} {@code {reason}},
 *       {@code POST …/reopen} — "Kiểm tra &amp; hoàn tất" / "Sửa lại".</li>
 *   <li>{@code GET /{id}/preview}, {@code POST /{id}/commit} {@code {reason}}, {@code POST /{id}/discard} —
 *       lưu / bỏ mọi biểu đang sửa dở.</li>
 *   <li>{@code GET /{id}/versions}, {@code GET /{id}/history}, {@code GET /{id}/compare?versionA=&versionB=},
 *       {@code POST /{id}/restore} {@code {versionNo, reason}} — lịch sử và so sánh số liệu.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/dept_reports")
public class DeptReportController {

    private final DeptPeriodService periodService;
    private final DeptSheetService sheetService;
    private final SummaryAggregationService aggregation;

    public DeptReportController(DeptPeriodService periodService,
                                DeptSheetService sheetService,
                                SummaryAggregationService aggregation) {
        this.periodService = periodService;
        this.sheetService = sheetService;
        this.aggregation = aggregation;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public ResponseEntity<List<DeptReportListItem>> list(@RequestParam int year) {
        SummaryReportService.checkYear(year);
        List<DeptReportListItem> rows = periodService.ofYear(year).stream().map(DeptReportListItem::from).toList();
        return ListResponse.of(rows, rows.size());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_WRITE + "')")
    public ReportDetail savePeriod(@Valid @RequestBody SavePeriodRequest request) {
        Long id = periodService.saveClosedPeriod(request.periodId()).getId();
        return sheetService.detail(id);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public ReportDetail detail(@PathVariable Long id) {
        return sheetService.detail(id);
    }

    // ------------------------------------------------------------------ một biểu

    @GetMapping("/{id}/sheets/{sheet}")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public SheetRuntime runtime(@PathVariable Long id, @PathVariable String sheet,
                                @RequestParam(required = false) Integer version) {
        return sheetService.runtime(id, sheet, version);
    }

    @GetMapping("/{id}/sheets/{sheet}/data")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<DeptDataRow> data(@PathVariable Long id, @PathVariable String sheet,
                                  @RequestParam(required = false) String scopeKind,
                                  @RequestParam(required = false) Long organizationId,
                                  @RequestParam(required = false) String orgType,
                                  @RequestParam(required = false) String block,
                                  @RequestParam(required = false, defaultValue = "false") boolean groupByOrg) {
        Set<Long> unitIds = aggregation.resolveScope(ScopeKind.parse(scopeKind), organizationId, orgType, block);
        return sheetService.data(id, sheet, null, unitIds, groupByOrg);
    }

    /** Như {@code /data} ở một phiên bản cũ (phiên bản trong đường dẫn — script tự nối {@code ?…}). */
    @GetMapping("/{id}/sheets/{sheet}/versions/{version}/data")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<DeptDataRow> versionData(@PathVariable Long id, @PathVariable String sheet, @PathVariable int version,
                                         @RequestParam(required = false) String scopeKind,
                                         @RequestParam(required = false) Long organizationId,
                                         @RequestParam(required = false) String orgType,
                                         @RequestParam(required = false) String block,
                                         @RequestParam(required = false, defaultValue = "false") boolean groupByOrg) {
        Set<Long> unitIds = aggregation.resolveScope(ScopeKind.parse(scopeKind), organizationId, orgType, block);
        return sheetService.data(id, sheet, version, unitIds, groupByOrg);
    }

    @PutMapping("/{id}/sheets/{sheet}/draft")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_WRITE + "')")
    public DraftResult saveDraft(@PathVariable Long id, @PathVariable String sheet,
                                 @Valid @RequestBody DraftRequest request) {
        return sheetService.saveDraft(id, sheet, request.workbookJson(), request.revision());
    }

    @GetMapping("/{id}/sheets/{sheet}/preview")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<PendingChange> preview(@PathVariable Long id, @PathVariable String sheet) {
        return sheetService.preview(id, sheet);
    }

    @PostMapping("/{id}/sheets/{sheet}/complete")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_WRITE + "')")
    public SaveResult complete(@PathVariable Long id, @PathVariable String sheet,
                               @Valid @RequestBody(required = false) ReasonRequest request) {
        return sheetService.complete(id, sheet, request == null ? null : request.reason());
    }

    @PostMapping("/{id}/sheets/{sheet}/reopen")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_WRITE + "')")
    public ReportDetail reopen(@PathVariable Long id, @PathVariable String sheet) {
        sheetService.reopen(id, sheet);
        return sheetService.detail(id);
    }

    // ------------------------------------------------------------------ mọi biểu của kỳ

    @GetMapping("/{id}/preview")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<PendingChange> previewAll(@PathVariable Long id) {
        return sheetService.previewAll(id);
    }

    @PostMapping("/{id}/commit")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_WRITE + "')")
    public SaveResult commit(@PathVariable Long id, @Valid @RequestBody(required = false) ReasonRequest request) {
        return sheetService.commitAll(id, request == null ? null : request.reason());
    }

    @PostMapping("/{id}/discard")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_WRITE + "')")
    public ReportDetail discard(@PathVariable Long id) {
        sheetService.discardPending(id);
        return sheetService.detail(id);
    }

    // ------------------------------------------------------------------ lịch sử, so sánh, khôi phục

    @GetMapping("/{id}/versions")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<VersionEntry> versions(@PathVariable Long id) {
        return sheetService.versions(id);
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<DeptHistoryEntry> history(@PathVariable Long id) {
        return periodService.periodHistory(id);
    }

    @GetMapping("/{id}/compare")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public CompareResult compare(@PathVariable Long id, @RequestParam int versionA, @RequestParam int versionB) {
        return sheetService.compare(id, versionA, versionB);
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_WRITE + "')")
    public SaveResult restore(@PathVariable Long id, @Valid @RequestBody RestoreRequest request) {
        return sheetService.restore(id, request.versionNo(), request.reason());
    }
}
