package com.dth.frw.module.asxh.attachment.api.dto;

import com.dth.frw.module.asxh.attachment.service.InputReportAttachmentService;
import java.time.Instant;

/**
 * Trạng thái xác nhận Kho bạc của một phiếu.
 *
 * @param confirmed  đã tích "Đã có phiếu xác nhận"
 * @param fileCount  số file xác nhận còn hiệu lực
 * @param ready      đủ cả hai vế — nút Nộp được sáng (BR-38.1)
 * @param required   máy chủ có bắt buộc xác nhận khi nộp không (cấu hình)
 * @param maxFiles   số file tối đa mỗi phiếu
 * @param maxFileBytes dung lượng tối đa mỗi file
 */
public record TreasuryConfirmationResponse(
        Long reportId,
        boolean confirmed,
        Instant confirmedAt,
        String confirmedBy,
        long fileCount,
        boolean ready,
        boolean required,
        int maxFiles,
        long maxFileBytes) {

    public static TreasuryConfirmationResponse from(InputReportAttachmentService.TreasuryStatus status,
                                                    boolean required, long maxFileBytes) {
        return new TreasuryConfirmationResponse(
                status.reportId(),
                status.confirmed(),
                status.confirmedAt(),
                status.confirmedBy(),
                status.fileCount(),
                status.ready(),
                required,
                InputReportAttachmentService.MAX_FILES_PER_REPORT,
                maxFileBytes);
    }
}
