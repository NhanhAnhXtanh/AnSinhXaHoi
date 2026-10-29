package com.dth.frw.module.asxh.attachment.api.dto;

import com.dth.frw.domain.asxh.attachment.AttachmentKind;
import com.dth.frw.domain.asxh.attachment.InputReportAttachment;
import java.time.Instant;

/**
 * Wire shape của một file đính kèm phiếu.
 *
 * <p>{@code previewable}: ảnh / PDF xem được ngay trên trình duyệt; Word / Excel phải tải về
 * (màn nộp nhắc người dùng điều này — UC-38 3b).
 */
public record AttachmentResponse(
        Long id,
        Long reportId,
        AttachmentKind kind,
        String fileName,
        String contentType,
        long fileSize,
        boolean previewable,
        Instant createdAt,
        String createdBy) {

    public static AttachmentResponse from(InputReportAttachment attachment) {
        String type = attachment.getContentType();
        boolean previewable = type != null && (type.startsWith("image/") || type.equals("application/pdf"));
        return new AttachmentResponse(
                attachment.getId(),
                attachment.getReportId(),
                attachment.getKind(),
                attachment.getFileName(),
                type,
                attachment.getFileSize(),
                previewable,
                attachment.getCreatedAt(),
                attachment.getCreatedBy());
    }
}
