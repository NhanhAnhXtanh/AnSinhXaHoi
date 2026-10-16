package com.dth.frw.module.asxh.ledger.query;

import java.math.BigDecimal;

/**
 * Tổng số liệu còn hiệu lực theo (biểu, đơn vị, chỉ tiêu), cộng qua mọi kỳ trong điều kiện.
 *
 * @param templateId    biểu
 * @param unitId        đơn vị số liệu; {@code null} ở {@link EffectiveLedgerQuery#sumByIndicator}
 *                      (cộng mọi đơn vị)
 * @param indicatorCode mã chỉ tiêu
 * @param indicatorName tên chỉ tiêu (lấy một tên đại diện nếu các kỳ ghi tên khác nhau)
 * @param quantity      tổng số đối tượng ({@code null} nếu mọi dòng đều trống)
 * @param amount        tổng kinh phí ({@code null} nếu mọi dòng đều trống)
 * @param orderNo       thứ tự dòng nhỏ nhất — để xếp lại đúng vị trí trong biểu
 * @param entryCount    số dòng đã cộng
 */
public record LedgerTotal(
        Long templateId,
        Long unitId,
        String indicatorCode,
        String indicatorName,
        BigDecimal quantity,
        BigDecimal amount,
        Integer orderNo,
        Long entryCount) {
}
