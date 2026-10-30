package com.dth.frw.module.asxh.setup.api.dto;

import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.domain.asxh.unit.ReportBlock;
import java.time.Instant;
import java.util.List;

/**
 * {@code GET /api/publications/{id}/items} — chi tiết một đợt mở (UC-30): mỗi dòng là MỘT biểu
 * của MỘT đơn vị mà đợt này phát, kèm tình trạng hiện tại của biểu đó trong phiếu.
 *
 * <p>Cách gán biểu cho đợt (không có cột đợt trên tờ biểu): xem
 * {@code PublicationItemAssembler}.
 *
 * @param publicationId đợt được hỏi
 * @param items         các dòng đơn vị × biểu, xếp theo tên đơn vị rồi thứ tự biểu
 */
public record PublicationItemsResponse(Long publicationId, List<Item> items) {

    /** Cách đơn vị nhận biểu ở đợt này. */
    public enum Delivery {
        /** Biểu nằm trong phiếu MỚI do chính đợt này lập. */
        NEW_REPORT,
        /** Biểu được thêm vào phiếu đang nhập (lập ở đợt trước) của đơn vị. */
        ADDED_TO_OPEN_REPORT
    }

    /**
     * Một dòng đơn vị × biểu.
     *
     * @param reportPublicationNo số thứ tự của đợt đã lập phiếu chứa biểu — khác đợt đang xem
     *                 khi biểu được thêm vào phiếu đang nhập
     * @param issuedAt thời điểm tờ biểu được phát (tờ GỐC, trước mọi lần sao chép khi trả lại)
     * @param derived  {@code true} khi việc gán dòng cho đợt là SUY RA vì dữ liệu không đủ chắc
     *                 (ví dụ tờ biểu có thời điểm tạo trước mọi đợt của kỳ)
     * @param ledger   {@code null} khi người dùng không có quyền đọc số liệu đã lưu
     */
    public record Item(
            UnitRef unit,
            TemplateRef template,
            VersionRef templateVersion,
            Delivery delivery,
            int reportPublicationNo,
            Instant issuedAt,
            boolean derived,
            ReportRef report,
            SheetRef sheet,
            LedgerRef ledger) {
    }

    public record UnitRef(Long id, String name, ReportBlock block) {
    }

    public record TemplateRef(Long id, String shortName, String name) {
    }

    public record VersionRef(Long id, Integer versionNo) {
    }

    /**
     * Phiếu HIỆN TẠI chứa biểu: bản mới nhất của chuỗi phiên bản.
     *
     * @param firstId id bản đầu tiên của chuỗi (bản phát) — lịch sử phiếu tính từ id bất kỳ
     */
    public record ReportRef(Long id, Long firstId, int revisionNo, ReportStatus status, Instant approvedAt) {
    }

    /** Tờ biểu trong phiếu hiện tại. */
    public record SheetRef(
            Long id,
            SheetCompletion completion,
            Instant dataUpdatedAt,
            String dataUpdatedBy,
            Instant completedAt,
            String completedBy) {
    }

    /**
     * Ghi số liệu đã lưu (sổ cái) của biểu trong mọi phiên bản của phiếu.
     *
     * @param lastSuccess lần ghi thành công gần nhất, {@code null} khi chưa có
     * @param lastFailure lần ghi thất bại gần nhất, {@code null} khi chưa có
     */
    public record LedgerRef(LedgerWrite lastSuccess, LedgerWrite lastFailure) {
    }

    public record LedgerWrite(
            Instant at,
            String by,
            int linesAdded,
            int linesUpdated,
            int linesRemoved,
            String failReason) {
    }
}
