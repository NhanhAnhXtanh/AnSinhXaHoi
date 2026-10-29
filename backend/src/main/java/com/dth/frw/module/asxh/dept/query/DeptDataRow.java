package com.dth.frw.module.asxh.dept.query;

import java.math.BigDecimal;

/**
 * Một dòng số liệu Sở đã lưu — đúng dạng {@code SummaryRow} của {@code /api/summary/data} (để CÙNG
 * script {@code afterInject} đổ được cả số tổng hợp sống lẫn số Sở đã lưu) cộng phần riêng của số
 * liệu Sở. Port {@code DeptSummaryRowDto} của bản Jmix, giữ tên trường.
 *
 * @param organizationCode mã quan hệ ngân sách; {@code "TONG_HOP"} cho dòng đã cộng qua đơn vị hoặc dòng
 *                         "Sở điều chỉnh chung" khi trả theo đơn vị
 * @param quantity         số Sở chốt (đã gộp qua kỳ theo bản chất chỉ tiêu khi đọc theo năm)
 * @param amount           kinh phí Sở chốt
 * @param measureKind      tên hằng {@code MeasureKind}
 * @param periodCount      số kỳ đã gộp (1 = một kỳ)
 * @param allocatedAmount  "Kinh phí đã bố trí trong dự toán NSĐP" Sở nhập ({@code null} khi đọc theo năm)
 * @param sourceQuantity   số gốc tổng hợp từ phiếu đơn vị lúc lưu
 * @param sourceAmount     kinh phí gốc
 * @param adjusted         Sở đã chỉnh khác số gốc
 * @param adjustReason     lý do điều chỉnh gần nhất
 * @param orderNo          thứ tự dòng trong biểu
 * @param unitId           id đơn vị ({@code null} ở dòng gộp / điều chỉnh chung)
 */
public record DeptDataRow(
        String organizationCode,
        String organizationName,
        String indicatorCode,
        String indicatorName,
        BigDecimal quantity,
        BigDecimal amount,
        BigDecimal quantitySum,
        BigDecimal quantityMax,
        String measureKind,
        int periodCount,
        BigDecimal allocatedAmount,
        BigDecimal sourceQuantity,
        BigDecimal sourceAmount,
        boolean adjusted,
        String adjustReason,
        Integer orderNo,
        Long unitId) {
}
