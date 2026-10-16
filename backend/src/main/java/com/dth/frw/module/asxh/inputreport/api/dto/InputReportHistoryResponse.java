package com.dth.frw.module.asxh.inputreport.api.dto;

import com.dth.frw.domain.asxh.report.ReportStatus;
import java.time.Instant;
import java.util.List;

/**
 * {@code GET /api/input_reports/{id}/history} — lịch sử phiên bản và lịch sử thao tác của
 * phiếu (UC-44).
 *
 * <p>Dựng lại từ dữ liệu sẵn có (BR-44.1): chuỗi phiên bản nối bằng {@code previousRevision},
 * dấu thời gian nộp / trả lại / duyệt của từng phiên bản, dấu lưu số liệu và hoàn tất của từng
 * tờ biểu. Không có bảng sự kiện riêng, nên chỉ còn lần lưu / lần đánh dấu GẦN NHẤT của mỗi
 * biểu; mốc nào suy ra (không có thời điểm gốc) gắn {@code derived = true}.
 *
 * @param revisions mọi phiên bản, MỚI trước
 * @param events    các mốc thao tác, MỚI trước
 */
public record InputReportHistoryResponse(List<Revision> revisions, List<Event> events) {

    /** Một phiên bản phiếu. Mỗi phiên bản có id riêng — "Xem" mở thẳng id đó. */
    public record Revision(
            Long id,
            int revisionNo,
            ReportStatus status,
            Instant createdAt,
            Instant submittedAt,
            String submittedBy,
            Instant approvedAt,
            String approvedBy,
            Instant returnedAt,
            String returnedBy,
            String returnReason) {
    }

    /**
     * Một mốc thao tác.
     *
     * @param action  {@code ISSUED} (phát phiếu), {@code SUBMITTED}, {@code RETURNED},
     *                {@code APPROVED}, {@code LOCKED}, {@code CANCELLED}, {@code SHEET_SAVED},
     *                {@code SHEET_COMPLETED}, {@code SHEET_NO_DATA}
     * @param sheet   tên ngắn của biểu (1a, 1b…) với mốc của tờ biểu; {@code null} với mốc phiếu
     * @param note    lý do trả lại với {@code RETURNED}
     * @param derived thời điểm suy ra từ lần sửa cuối của phiếu, không phải thời điểm gốc
     */
    public record Event(
            String action,
            Instant at,
            String by,
            int revisionNo,
            String sheet,
            String note,
            boolean derived) {
    }
}
