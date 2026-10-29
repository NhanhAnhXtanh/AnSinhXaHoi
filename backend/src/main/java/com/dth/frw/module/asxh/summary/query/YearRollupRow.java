package com.dth.frw.module.asxh.summary.query;

import java.math.BigDecimal;

/**
 * Một chỉ tiêu của tổng hợp NĂM DƯƠNG LỊCH với hai nửa năm tách riêng (port
 * {@code SchoolYearRollupRowDto}, giữ tên trường {@code Hk1}/{@code Hk2} — đó là slot cột
 * {@code #HK1}/{@code #HK2} của mẫu biểu năm).
 *
 * <p>{@code Hk1} = nửa đầu T1–T6 (cột trái), {@code Hk2} = nửa cuối T7–T12 (cột phải). Cột "Cả năm"
 * (người = MAX hai nửa, tiền = cộng) do CÔNG THỨC của mẫu tính (BR-52.1), không có ở đây. Nửa không
 * có số để {@code null} (không bịa 0).
 */
public record YearRollupRow(
        String indicatorCode,
        String indicatorName,
        BigDecimal quantityHk1,
        BigDecimal amountHk1,
        BigDecimal quantityHk2,
        BigDecimal amountHk2) {
}
