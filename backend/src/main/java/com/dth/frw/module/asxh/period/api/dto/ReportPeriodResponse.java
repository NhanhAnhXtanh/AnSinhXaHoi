package com.dth.frw.module.asxh.period.api.dto;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Hình dạng dây của một kỳ báo cáo. {@code calendar} lồng để bộ lọc
 * {@code calendar.year} / {@code calendar.id} ở frontend gắn thẳng vào trường.
 */
public record ReportPeriodResponse(
        Long id,
        CalendarSummary calendar,
        Integer year,
        PeriodKind kind,
        int seq,
        String code,
        String name,
        LocalDate fromDate,
        LocalDate toDate,
        LocalDate openFrom,
        LocalDate deadline,
        boolean deadlineManual,
        PeriodStatus status,
        Instant createdAt,
        Instant updatedAt) {

    /** Lịch theo cách endpoint này báo — khai riêng, không dùng chung với resource lịch. */
    public record CalendarSummary(Long id, Integer year) {

        static CalendarSummary from(ReportCalendar calendar) {
            return new CalendarSummary(calendar.getId(), calendar.getYear());
        }
    }

    public static ReportPeriodResponse from(ReportPeriod period) {
        return new ReportPeriodResponse(
                period.getId(),
                CalendarSummary.from(period.getCalendar()),
                period.getYear(),
                period.getKind(),
                period.getSeq(),
                period.getCode(),
                period.getName(),
                period.getFromDate(),
                period.getToDate(),
                period.getOpenFrom(),
                period.getDeadline(),
                period.isDeadlineManual(),
                period.getStatus(),
                period.getCreatedAt(),
                period.getUpdatedAt());
    }
}
