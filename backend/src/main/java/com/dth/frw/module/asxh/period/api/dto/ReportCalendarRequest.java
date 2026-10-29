package com.dth.frw.module.asxh.period.api.dto;

import com.dth.frw.domain.asxh.period.PeriodKind;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * {@code POST /report_calendars} — tạo lịch năm rồi sinh kỳ (UC-06 → UC-20).
 *
 * <p>{@code deadlineDays} thiếu thì lấy 5. {@code kinds} vắng mặt thì lấy mặc định
 * Tháng + Quý + 6 tháng; gửi mảng rỗng thì lịch vẫn được lưu nhưng chưa sinh kỳ
 * (UC-06 3a).
 */
public record ReportCalendarRequest(
        @NotNull(message = "Vui lòng chọn năm")
        Integer year,

        Integer deadlineDays,

        List<PeriodKind> kinds) {
}
