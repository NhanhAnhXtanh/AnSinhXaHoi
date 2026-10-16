package com.dth.frw.module.asxh.ledger.query;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Một dòng số liệu CÒN HIỆU LỰC (phiếu đã duyệt, hoặc đã khoá sau khi duyệt).
 *
 * @param entryId           id dòng số liệu
 * @param reportId          phiếu nguồn
 * @param sheetId           tờ biểu nguồn
 * @param periodId          kỳ của phiếu
 * @param templateId        biểu
 * @param templateCode      mã nội bộ ổn định của biểu (không hiển thị)
 * @param templateShortName tên ngắn của biểu ("1a")
 * @param templateVersionId phiên bản mẫu đã ghim vào tờ biểu
 * @param unitId            đơn vị số liệu
 * @param unitBudgetCode    mã quan hệ ngân sách của đơn vị số liệu
 * @param unitName          tên đơn vị số liệu
 * @param submitterUnitId   đơn vị nộp (khác {@code unitId} chỉ ở biểu nhập hộ)
 * @param indicatorCode     mã chỉ tiêu
 * @param indicatorName     tên chỉ tiêu
 * @param quantity          số đối tượng (có thể null)
 * @param amount            kinh phí (có thể null)
 * @param note              ghi chú
 * @param orderNo           thứ tự dòng trong biểu
 * @param approvedAt        lúc phiếu được duyệt
 */
public record EffectiveLedgerRow(
        Long entryId,
        Long reportId,
        Long sheetId,
        Long periodId,
        Long templateId,
        String templateCode,
        String templateShortName,
        Long templateVersionId,
        Long unitId,
        String unitBudgetCode,
        String unitName,
        Long submitterUnitId,
        String indicatorCode,
        String indicatorName,
        BigDecimal quantity,
        BigDecimal amount,
        String note,
        Integer orderNo,
        Instant approvedAt) {
}
