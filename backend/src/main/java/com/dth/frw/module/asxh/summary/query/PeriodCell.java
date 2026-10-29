package com.dth.frw.module.asxh.summary.query;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Một ô số của MỘT đơn vị cho MỘT chỉ tiêu trong MỘT kỳ — đầu vào của phép gộp theo bản chất chỉ
 * tiêu (port {@code SummaryAggregationService.PeriodCell}). Dùng chung cho số liệu đơn vị đã duyệt
 * và số liệu Sở đã lưu.
 *
 * @param periodId   kỳ (khoá gộp trong kỳ)
 * @param periodFrom ngày đầu kỳ — xếp thứ tự cho phép "lấy kỳ mới nhất"; {@code null} xếp trước mọi kỳ
 * @param unitKey    khoá đơn vị: mã quan hệ ngân sách, hoặc "*" cho dòng "Sở điều chỉnh chung"
 * @param unitName   tên hiển thị
 * @param unitId     id đơn vị ({@code null} với dòng điều chỉnh chung)
 */
public record PeriodCell(
        Long periodId,
        LocalDate periodFrom,
        String unitKey,
        String unitName,
        Long unitId,
        String indicatorCode,
        String indicatorName,
        BigDecimal quantity,
        BigDecimal amount,
        Integer orderNo) {
}
