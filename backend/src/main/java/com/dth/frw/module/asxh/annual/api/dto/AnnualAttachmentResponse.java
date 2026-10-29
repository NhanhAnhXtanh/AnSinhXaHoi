package com.dth.frw.module.asxh.annual.api.dto;

import com.dth.frw.domain.asxh.annual.AnnualReportAttachment;
import java.time.Instant;

/**
 * Một file phiếu nộp. {@code previewable}: ảnh / PDF mở được ngay trên trình duyệt; Word / Excel phải
 * tải về.
 */
public record AnnualAttachmentResponse(
        Long id,
        Long reportId,
        String fileName,
        String contentType,
        long fileSize,
        boolean previewable,
        Instant createdAt,
        String createdBy) {

    public static AnnualAttachmentResponse from(AnnualReportAttachment attachment) {
        String type = attachment.getContentType();
        boolean previewable = type != null && (type.startsWith("image/") || type.equals("application/pdf"));
        return new AnnualAttachmentResponse(
                attachment.getId(),
                attachment.getReportId(),
                attachment.getFileName(),
                type,
                attachment.getFileSize(),
                previewable,
                attachment.getCreatedAt(),
                attachment.getCreatedBy());
    }
}
