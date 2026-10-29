package com.dth.frw.module.asxh.script;

import java.math.BigDecimal;

/**
 * Một dòng số liệu do hook {@code getInputData} trả về (port {@code TempTableRowDto} của bản
 * Jmix — giữ nguyên tên trường để script cũ chạy được).
 *
 * @param organizationCode mã quan hệ ngân sách của đơn vị số liệu — chỉ biểu nhập hộ (1g) dùng;
 *                         biểu thường để trống và mọi dòng thuộc đơn vị của phiếu
 * @param organizationName tên đơn vị (chỉ để đọc, không dùng khi ghi)
 * @param indicatorCode    mã chỉ tiêu
 * @param indicatorName    tên chỉ tiêu
 * @param quantity         số đối tượng
 * @param amount           kinh phí
 * @param note             ghi chú tự do của dòng
 * @param orderNo          thứ tự dòng trong biểu — giữ đúng vị trí khi tổng hợp
 */
public record ScriptRow(
        String organizationCode,
        String organizationName,
        String indicatorCode,
        String indicatorName,
        BigDecimal quantity,
        BigDecimal amount,
        String note,
        Integer orderNo) {
}
