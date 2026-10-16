package com.dth.frw.module.asxh.annual.api;

import com.dth.frw.domain.asxh.annual.AnnualReport;
import com.dth.frw.domain.asxh.annual.AnnualReportAttachment;
import com.dth.frw.domain.asxh.annual.AnnualReportStatus;
import com.dth.frw.module.asxh.annual.api.dto.AnnualAttachmentResponse;
import com.dth.frw.module.asxh.annual.api.dto.AnnualReasonRequest;
import com.dth.frw.module.asxh.annual.api.dto.AnnualReportResponse;
import com.dth.frw.module.asxh.annual.api.dto.AnnualSheetResponse;
import com.dth.frw.module.asxh.annual.api.dto.AnnualYearStatusResponse;
import com.dth.frw.module.asxh.annual.security.AnnualReportPermissions;
import com.dth.frw.module.asxh.annual.service.AnnualReportService;
import com.dth.frw.module.asxh.annual.service.AnnualReportService.Detail;
import com.dth.frw.module.asxh.annual.service.AnnualReportService.SheetRuntime;
import com.dth.frw.module.asxh.annual.service.AnnualReportService.YearCheck;
import com.dth.frw.module.asxh.annual.service.AnnualReportWorkflowService;
import com.dth.frw.module.asxh.annual.service.AnnualReportWorkflowService.SubmitFile;
import com.dth.frw.module.asxh.attachment.service.AttachmentFiles;
import com.dth.frw.module.asxh.dept.query.DeptDataRow;
import com.dth.frw.shared.security.CurrentUser;
import com.dth.frw.shared.web.ListResponse;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.core.io.InputStreamResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * {@code /api/annual_reports} — báo cáo năm Sở nộp lên UBND (UC-58..67).
 *
 * <ul>
 *   <li>{@code GET /?year=&status=} — các lần nộp, năm mới trước rồi phiếu mới trước (mảng trần +
 *       {@code X-Total-Count}; danh sách nhỏ nên không phân trang ở máy chủ).</li>
 *   <li>{@code GET /year_status?year=} — tình trạng nộp của năm + kiểm trước khi nộp (màn Tổng hợp).</li>
 *   <li>{@code POST /} multipart: {@code year}, {@code docNo}, {@code docDate} (yyyy-MM-dd), {@code files}
 *       (0–10 file) — nộp / gửi lại (UC-59, UC-66).</li>
 *   <li>{@code GET /{id}} — đầu phiếu + biểu + file phiếu nộp.</li>
 *   <li>{@code POST /{id}/approve} · {@code POST /{id}/return} {@code {reason}} · {@code POST /{id}/reopen}
 *       {@code {reason}} — quyết định của UBND (UC-63..65).</li>
 *   <li>{@code GET /{id}/sheets/{templateId}} — dựng một biểu năm ở phiên bản đã ghim.</li>
 *   <li>{@code GET /{id}/data?from=&to=&scopeKind=&organizationId=&orgType=&block=&sourceSheetCode=&groupByOrg=}
 *       — số liệu cho script ({@code ctx.shared.summaryDataUrl}), cùng dạng {@code /api/dept_years/{year}/data}.</li>
 *   <li>{@code GET /{id}/attachments} · {@code GET /{id}/attachments/{aid}/content} — file phiếu nộp.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/annual_reports")
public class AnnualReportController {

    private final AnnualReportService service;
    private final AnnualReportWorkflowService workflow;

    public AnnualReportController(AnnualReportService service, AnnualReportWorkflowService workflow) {
        this.service = service;
        this.workflow = workflow;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + AnnualReportPermissions.ANNUAL_READ + "')")
    public ResponseEntity<List<AnnualReportResponse>> list(@RequestParam(required = false) Integer year,
                                                           @RequestParam(required = false) String status) {
        List<AnnualReportResponse> rows = service.list(year, parseStatus(status)).stream()
                .map(AnnualReportResponse::from)
                .toList();
        return ListResponse.of(rows, rows.size());
    }

    @GetMapping("/year_status")
    @PreAuthorize("hasAuthority('" + AnnualReportPermissions.ANNUAL_READ + "')")
    public AnnualYearStatusResponse yearStatus(@RequestParam int year) {
        YearCheck check = service.check(year);
        AnnualReport latest = check.latest();
        return new AnnualYearStatusResponse(check.year(), check.ledgerVersion(), check.savedPeriods(),
                check.totalPeriods(), check.lockReason(), check.blocker(), check.warnings(),
                check.unfinishedSheets(), check.sheets().size(),
                check.blocker() == null && CurrentUser.has(AnnualReportPermissions.ANNUAL_WRITE),
                latest == null ? null : AnnualReportResponse.from(service.view(latest)));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('" + AnnualReportPermissions.ANNUAL_WRITE + "')")
    public AnnualReportResponse submit(@RequestParam int year,
                                       @RequestParam(required = false) String docNo,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate docDate,
                                       @RequestParam(value = "files", required = false) List<MultipartFile> files) {
        List<SubmitFile> uploads = new ArrayList<>();
        if (files != null) {
            for (MultipartFile file : files) {
                if (file == null || file.isEmpty() && (file.getOriginalFilename() == null
                        || file.getOriginalFilename().isBlank())) {
                    continue;
                }
                try {
                    uploads.add(new SubmitFile(file.getOriginalFilename(), file.getBytes()));
                } catch (IOException e) {
                    throw new UncheckedIOException("Không đọc được file tải lên.", e);
                }
            }
        }
        AnnualReport report = workflow.submit(year, docNo, docDate, uploads);
        return detail(report.getId());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + AnnualReportPermissions.ANNUAL_READ + "')")
    public AnnualReportResponse get(@PathVariable Long id) {
        return detail(id);
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('" + AnnualReportPermissions.ANNUAL_APPROVE + "')")
    public AnnualReportResponse approve(@PathVariable Long id) {
        workflow.approve(id);
        return detail(id);
    }

    @PostMapping("/{id}/return")
    @PreAuthorize("hasAuthority('" + AnnualReportPermissions.ANNUAL_APPROVE + "')")
    public AnnualReportResponse returnReport(@PathVariable Long id,
                                             @RequestBody(required = false) AnnualReasonRequest request) {
        workflow.returnReport(id, request == null ? null : request.reason());
        return detail(id);
    }

    @PostMapping("/{id}/reopen")
    @PreAuthorize("hasAuthority('" + AnnualReportPermissions.ANNUAL_APPROVE + "')")
    public AnnualReportResponse reopen(@PathVariable Long id,
                                       @RequestBody(required = false) AnnualReasonRequest request) {
        workflow.reopen(id, request == null ? null : request.reason());
        return detail(id);
    }

    @GetMapping("/{id}/sheets/{templateId}")
    @PreAuthorize("hasAuthority('" + AnnualReportPermissions.ANNUAL_READ + "')")
    public SheetRuntime sheet(@PathVariable Long id, @PathVariable Long templateId) {
        return service.sheet(id, templateId);
    }

    @GetMapping("/{id}/data")
    @PreAuthorize("hasAuthority('" + AnnualReportPermissions.ANNUAL_READ + "')")
    public List<DeptDataRow> data(@PathVariable Long id,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                  @RequestParam(required = false) String scopeKind,
                                  @RequestParam(required = false) Long organizationId,
                                  @RequestParam(required = false) String orgType,
                                  @RequestParam(required = false) String block,
                                  @RequestParam(required = false) String sourceSheetCode,
                                  @RequestParam(required = false, defaultValue = "false") boolean groupByOrg) {
        return service.data(id, from, to, scopeKind, organizationId, orgType, block, sourceSheetCode, groupByOrg);
    }

    @GetMapping("/{id}/attachments")
    @PreAuthorize("hasAuthority('" + AnnualReportPermissions.ANNUAL_READ + "')")
    public ResponseEntity<List<AnnualAttachmentResponse>> attachments(@PathVariable Long id) {
        List<AnnualAttachmentResponse> rows = service.attachments(id).stream()
                .map(AnnualAttachmentResponse::from)
                .toList();
        return ListResponse.of(rows, rows.size());
    }

    @GetMapping("/{id}/attachments/{attachmentId}/content")
    @PreAuthorize("hasAuthority('" + AnnualReportPermissions.ANNUAL_READ + "')")
    public ResponseEntity<InputStreamResource> download(@PathVariable Long id, @PathVariable Long attachmentId) {
        AnnualReportAttachment attachment = service.attachment(id, attachmentId);
        AnnualAttachmentResponse meta = AnnualAttachmentResponse.from(attachment);
        ContentDisposition disposition = (meta.previewable()
                ? ContentDisposition.inline()
                : ContentDisposition.attachment())
                .filename(attachment.getFileName(), StandardCharsets.UTF_8)
                .build();
        String contentType = attachment.getContentType() == null
                ? AttachmentFiles.contentTypeOf(attachment.getFileName())
                : attachment.getContentType();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(contentType))
                .contentLength(attachment.getFileSize())
                .body(new InputStreamResource(service.openContent(attachment)));
    }

    // ------------------------------------------------------------------ nội bộ

    private AnnualReportResponse detail(Long id) {
        Detail detail = service.detail(id);
        return AnnualReportResponse.from(detail.view(),
                detail.sheets().stream().map(AnnualSheetResponse::from).toList(),
                detail.attachments().stream().map(AnnualAttachmentResponse::from).toList());
    }

    /** Trạng thái lạ thì bỏ qua bộ lọc (không trả 400 làm trắng bảng). */
    private static AnnualReportStatus parseStatus(String raw) {
        try {
            return AnnualReportStatus.from(raw);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
