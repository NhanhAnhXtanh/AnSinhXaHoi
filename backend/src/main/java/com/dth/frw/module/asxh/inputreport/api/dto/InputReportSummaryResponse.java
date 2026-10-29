package com.dth.frw.module.asxh.inputreport.api.dto;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * {@code GET /api/input_reports/summary} — số đếm cho thẻ lọc nhanh và lựa chọn cho ô lọc của
 * hai màn danh sách phiếu (Nhập liệu, Duyệt phiếu), để frontend không phải tải mọi phiếu.
 *
 * @param total        số phiếu khớp bộ lọc (không tính bản cũ), bỏ qua lọc trạng thái
 * @param counts       số phiếu theo trạng thái hiển thị: {@code draft} (Cần nhập / Chưa nộp),
 *                     {@code overdue} (Quá hạn), {@code returned}, {@code submitted},
 *                     {@code approved}, {@code locked}
 * @param periods      các kỳ có phiếu trong năm (mới trước) — ô "Kỳ"
 * @param templateSets các bộ mẫu có biểu trong phiếu của năm — ô "Bộ biểu mẫu"
 * @param districts    các đơn vị cha (huyện / thành phố) có đơn vị nộp phiếu trong năm — ô
 *                     "Huyện / thành phố" của màn duyệt
 */
public record InputReportSummaryResponse(
        long total,
        Map<String, Long> counts,
        List<PeriodOption> periods,
        List<TemplateSetOption> templateSets,
        List<UnitOption> districts) {

    public record UnitOption(Long id, String name) {
    }

    public record PeriodOption(Long id, String name, LocalDate fromDate, LocalDate toDate, PeriodStatus status) {
    }

    public record TemplateSetOption(Long id, String name) {
    }
}
