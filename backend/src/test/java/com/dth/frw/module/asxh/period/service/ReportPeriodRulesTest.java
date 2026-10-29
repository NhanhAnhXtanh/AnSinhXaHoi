package com.dth.frw.module.asxh.period.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import java.time.LocalDate;
import java.util.EnumSet;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Quy tắc thuần của kỳ báo cáo: tự chuyển trạng thái theo ngày (UC-25), kỳ nào được
 * tính lại hạn nộp khi lịch đổi số ngày (UC-21), và bảng chuyển trạng thái.
 */
class ReportPeriodRulesTest {

    /** Quý IV/2026: số liệu 01/10 → 31/12, nhận nhập từ 01/10, hạn nộp 05/01/2027. */
    private static ReportPeriod fourthQuarter() {
        ReportCalendar calendar = new ReportCalendar(2026, 5, EnumSet.of(PeriodKind.QUY));
        PeriodPlanner.PeriodPlan plan = PeriodPlanner.plan(2026, PeriodKind.QUY, 4, 5);
        return new ReportPeriod(calendar, plan.kind(), plan.seq(), plan.code(), plan.name(),
                plan.fromDate(), plan.toDate(), plan.openFrom(), plan.deadline());
    }

    @Test
    @DisplayName("Trước ngày nhận số liệu: giữ nguyên trạng thái")
    void beforeWindowKeepsStatus() {
        assertNull(ReportPeriodService.dateStatus(fourthQuarter(), LocalDate.of(2026, 9, 30)));
    }

    @Test
    @DisplayName("Từ ngày mở đến hết ngày hạn nộp: Đang mở")
    void insideWindowIsOpen() {
        ReportPeriod period = fourthQuarter();
        assertEquals(PeriodStatus.OPEN, ReportPeriodService.dateStatus(period, LocalDate.of(2026, 10, 1)));
        assertEquals(PeriodStatus.OPEN, ReportPeriodService.dateStatus(period, LocalDate.of(2026, 12, 31)));
        assertEquals(PeriodStatus.OPEN, ReportPeriodService.dateStatus(period, LocalDate.of(2027, 1, 5)));
    }

    @Test
    @DisplayName("Qua ngày hạn nộp: Quá hạn")
    void afterDeadlineIsOverdue() {
        assertEquals(PeriodStatus.OVERDUE,
                ReportPeriodService.dateStatus(fourthQuarter(), LocalDate.of(2027, 1, 6)));
    }

    @Test
    @DisplayName("Kỳ chưa dùng, hạn nộp tự tính: theo lịch; đã dùng hoặc sửa tay: giữ hạn")
    void followsCalendarDeadline() {
        ReportPeriod period = fourthQuarter();
        assertTrue(ReportPeriodService.followsCalendarDeadline(period));

        period.setDeadlineManual(true);
        assertFalse(ReportPeriodService.followsCalendarDeadline(period));

        period.setDeadlineManual(false);
        period.setStatus(PeriodStatus.READY);
        assertFalse(ReportPeriodService.followsCalendarDeadline(period));
        assertTrue(ReportPeriodService.isUsed(period));
    }

    @Test
    @DisplayName("Hạn nộp mặc định = ngày cuối kỳ + số ngày của lịch")
    void defaultDeadline() {
        assertEquals(LocalDate.of(2027, 1, 5), ReportPeriodService.defaultDeadline(fourthQuarter()));
    }

    @Test
    @DisplayName("Bảng chuyển trạng thái kỳ")
    void transitions() {
        assertTrue(PeriodStatus.DRAFT.canMoveTo(PeriodStatus.READY));
        assertFalse(PeriodStatus.DRAFT.canMoveTo(PeriodStatus.OPEN));
        assertTrue(PeriodStatus.READY.canMoveTo(PeriodStatus.OPEN));
        assertTrue(PeriodStatus.OVERDUE.canMoveTo(PeriodStatus.OPEN));
        assertTrue(PeriodStatus.OPEN.canMoveTo(PeriodStatus.CLOSED));
        assertFalse(PeriodStatus.CLOSED.canMoveTo(PeriodStatus.OPEN));
        assertFalse(PeriodStatus.LOCKED.canMoveTo(PeriodStatus.CLOSED));
        assertEquals("Chưa thiết lập", PeriodStatus.DRAFT.label());
        assertEquals("Quá hạn", PeriodStatus.OVERDUE.label());
    }

    @Test
    @DisplayName("Ngày trong thông báo lỗi viết dd/MM/yyyy")
    void vietnameseDate() {
        assertEquals("05/01/2027", ReportPeriodService.vnDate(LocalDate.of(2027, 1, 5)));
        assertEquals("", ReportPeriodService.vnDate(null));
    }
}
