package com.dth.frw.module.asxh.summary.query;

import java.math.BigDecimal;

/**
 * Một dòng số liệu đã tổng hợp theo (đơn vị, chỉ tiêu) — port {@code SummaryRowDto} của bản Jmix,
 * GIỮ NGUYÊN tên trường để script {@code afterInject} cũ đọc {@code ctx.shared.rows} / gọi
 * {@code /summary/data} chạy được không sửa.
 *
 * <p>{@code quantity}/{@code amount} = số đổ vào ô, đã gộp qua các kỳ theo bản chất chỉ tiêu
 * ({@code measureKind}). {@code quantitySum} / {@code quantityMax} = hai cách đọc số đối tượng
 * (cộng dồn / kỳ cao nhất) để đối chiếu. Bất biến: {@code amount} không phụ thuộc cách đọc số đối
 * tượng.
 *
 * @param organizationCode mã quan hệ ngân sách của đơn vị; dòng đã cộng qua đơn vị mang
 *                         {@code "TONG_HOP"} (không bao giờ rỗng — script cũ đòi chuỗi khác rỗng)
 * @param organizationName tên đơn vị, hoặc "Tổng hợp các đơn vị"
 * @param measureKind      tên hằng {@code MeasureKind} ({@code "NGUOI"}…)
 * @param periodCount      số kỳ có số đã gộp (1 = kỳ đơn)
 * @param orderNo          thứ tự dòng nhỏ nhất trong biểu nguồn (giữ vị trí người nhập)
 * @param unitId           id đơn vị ({@code null} ở dòng đã cộng qua đơn vị) — phần thêm của bản mới
 */
public record SummaryRow(
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
        Integer orderNo,
        Long unitId) {
}
