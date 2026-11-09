package com.dth.frw.module.asxh.period.api.dto;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

/**
 * Hình dạng dây của một lịch năm.
 *
 * <p>{@code lockedKinds} là loại kỳ đã có kỳ đem ra dùng (đã rời "Chưa thiết lập")
 * — giao diện khoá thẻ loại kỳ đó, không cho bỏ (UC-21 2c).
 * {@code createdPeriods}/{@code skippedPeriods} chỉ có trên kết quả tạo/cập nhật,
 * để hiện "Đã tạo N kỳ; bỏ qua M kỳ đã tồn tại."; {@code removedPeriods}/
 * {@code rescheduledPeriods} chỉ có trên kết quả cập nhật.
 * {@code yearLockReason} chỉ có khi báo cáo năm đã nộp UBND / đã được duyệt: lịch năm đó
 * đã chốt, giao diện chỉ cho xem (UC-60).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ReportCalendarResponse(
        Long id,
        Integer year,
        String name,
        int deadlineDays,
        List<PeriodKind> kinds,
        List<PeriodKind> lockedKinds,
        long periodCount,
        Integer createdPeriods,
        Integer skippedPeriods,
        Integer removedPeriods,
        Integer rescheduledPeriods,
        String yearLockReason,
        Instant createdAt,
        Instant updatedAt) {

    public static ReportCalendarResponse from(ReportCalendar calendar, List<PeriodKind> lockedKinds,
                                              long periodCount, String yearLockReason) {
        return from(calendar, lockedKinds, periodCount, null, null, null, null, yearLockReason);
    }

    public static ReportCalendarResponse from(ReportCalendar calendar, List<PeriodKind> lockedKinds,
                                              long periodCount, Integer created, Integer skipped,
                                              Integer removed, Integer rescheduled, String yearLockReason) {
        return new ReportCalendarResponse(
                calendar.getId(),
                calendar.getYear(),
                calendar.getName(),
                calendar.getDeadlineDays(),
                List.copyOf(calendar.getKinds()),
                lockedKinds,
                periodCount,
                created,
                skipped,
                removed,
                rescheduled,
                yearLockReason,
                calendar.getCreatedAt(),
                calendar.getUpdatedAt());
    }
}
