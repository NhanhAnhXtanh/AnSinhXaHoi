package com.dth.frw.module.asxh.attachment.api;

import com.dth.frw.domain.asxh.attachment.InputReportAttachment;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.module.asxh.attachment.api.dto.AttachmentResponse;
import com.dth.frw.module.asxh.attachment.api.dto.TreasuryConfirmationRequest;
import com.dth.frw.module.asxh.attachment.api.dto.TreasuryConfirmationResponse;
import com.dth.frw.module.asxh.attachment.service.AttachmentFiles;
import com.dth.frw.module.asxh.attachment.service.InputReportAttachmentService;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.attachment.security.AttachmentPermissions;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * {@code /api/input_reports/{reportId}/attachments} — giấy tờ đính kèm phiếu (xác nhận Kho bạc,
 * UC-38) và {@code /api/input_reports/{reportId}/treasury_confirmation} — ô tích "Đã có phiếu xác
 * nhận".
 *
 * <p>Phiếu được nạp qua {@code InputReportService.get}, tức là qua phạm vi dữ liệu của người gọi:
 * phiếu ngoài tầm nhìn trả 404 trước khi chạm tới file nào.
 *
 * <ul>
 *   <li>{@code GET /attachments} — danh sách (mảng JSON trần + {@code X-Total-Count}).</li>
 *   <li>{@code POST /attachments} — multipart, trường {@code file}; trả file vừa lưu.</li>
 *   <li>{@code GET /attachments/{id}/content} — nội dung file (ảnh / PDF mở tại chỗ, còn lại tải về).</li>
 *   <li>{@code DELETE /attachments/{id}} — gỡ (xoá mềm); trả file vừa gỡ.</li>
 *   <li>{@code GET|PUT /treasury_confirmation} — đọc / đặt ô tích ({@code {"confirmed": true}}).</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/input_reports/{reportId}")
public class InputReportAttachmentController {

    private final InputReportService reportService;
    private final InputReportAttachmentService service;

    public InputReportAttachmentController(InputReportService reportService, InputReportAttachmentService service) {
        this.reportService = reportService;
        this.service = service;
    }

    @GetMapping("/attachments")
    @PreAuthorize("hasAuthority('" + AttachmentPermissions.ATTACHMENTS_READ + "')")
    public ResponseEntity<List<AttachmentResponse>> list(@PathVariable Long reportId) {
        InputReport report = reportService.get(reportId);
        List<AttachmentResponse> body = service.list(report).stream().map(AttachmentResponse::from).toList();
        return ListResponse.of(body, body.size());
    }

    @PostMapping(path = "/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('" + AttachmentPermissions.ATTACHMENTS_WRITE + "')")
    public AttachmentResponse upload(@PathVariable Long reportId, @RequestParam("file") MultipartFile file) {
        InputReport report = reportService.get(reportId);
        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Không đọc được file tải lên.", e);
        }
        return AttachmentResponse.from(service.upload(report, file.getOriginalFilename(), content));
    }

    @GetMapping("/attachments/{attachmentId}/content")
    @PreAuthorize("hasAuthority('" + AttachmentPermissions.ATTACHMENTS_READ + "')")
    public ResponseEntity<InputStreamResource> download(@PathVariable Long reportId,
                                                        @PathVariable Long attachmentId) {
        InputReport report = reportService.get(reportId);
        InputReportAttachment attachment = service.get(report, attachmentId);
        AttachmentResponse meta = AttachmentResponse.from(attachment);
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

    @DeleteMapping("/attachments/{attachmentId}")
    @PreAuthorize("hasAuthority('" + AttachmentPermissions.ATTACHMENTS_DELETE + "')")
    public AttachmentResponse delete(@PathVariable Long reportId, @PathVariable Long attachmentId) {
        InputReport report = reportService.get(reportId);
        return AttachmentResponse.from(service.delete(report, attachmentId));
    }

    @GetMapping("/treasury_confirmation")
    @PreAuthorize("hasAuthority('" + AttachmentPermissions.ATTACHMENTS_READ + "')")
    public TreasuryConfirmationResponse treasury(@PathVariable Long reportId) {
        InputReport report = reportService.get(reportId);
        return TreasuryConfirmationResponse.from(
                service.treasuryStatus(report), service.isTreasuryRequired(), AttachmentFiles.MAX_FILE_BYTES);
    }

    @PutMapping("/treasury_confirmation")
    @PreAuthorize("hasAuthority('" + AttachmentPermissions.ATTACHMENTS_WRITE + "')")
    public TreasuryConfirmationResponse setTreasury(@PathVariable Long reportId,
                                                    @Valid @RequestBody TreasuryConfirmationRequest request) {
        InputReport report = reportService.get(reportId);
        return TreasuryConfirmationResponse.from(
                service.setTreasuryConfirmed(report, request.confirmed()),
                service.isTreasuryRequired(), AttachmentFiles.MAX_FILE_BYTES);
    }
}
