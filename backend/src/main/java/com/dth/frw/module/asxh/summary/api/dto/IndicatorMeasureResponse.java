package com.dth.frw.module.asxh.summary.api.dto;

import com.dth.frw.domain.asxh.dept.MeasureKind;
import com.dth.frw.module.asxh.summary.service.IndicatorMeasureService.IndicatorItem;
import java.time.Instant;
import java.util.List;

/**
 * Một dòng của {@code GET /api/indicator_measures}.
 *
 * @param id            = {@code indicatorCode} (Refine cần trường {@code id})
 * @param measureKind   tên hằng đã khai ({@code "NGUOI"}…); {@code null} = chưa khai
 * @param effectiveKind bản chất dùng khi tổng hợp (đã khai, hoặc mặc định)
 * @param quantityRule  cách gộp số đối tượng qua nhiều kỳ theo {@code effectiveKind} ({@code SUM/MAX/LAST})
 * @param amountRule    cách gộp kinh phí qua nhiều kỳ
 * @param inUse         đã có số liệu đã duyệt mang mã này
 */
public record IndicatorMeasureResponse(
        String id,
        String indicatorCode,
        String indicatorName,
        List<String> sheets,
        String measureKind,
        String effectiveKind,
        String quantityRule,
        String amountRule,
        String note,
        long entryCount,
        boolean inUse,
        Instant updatedAt) {

    public static IndicatorMeasureResponse from(IndicatorItem item) {
        MeasureKind effective = item.effectiveKind();
        return new IndicatorMeasureResponse(item.indicatorCode(), item.indicatorCode(), item.indicatorName(),
                item.sheets(), item.measureKind() == null ? null : item.measureKind().name(), effective.name(),
                effective.quantityRule().name(), effective.amountRule().name(), item.note(), item.entryCount(),
                item.entryCount() > 0, item.updatedAt());
    }
}
