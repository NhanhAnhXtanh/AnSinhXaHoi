package com.dth.frw.module.asxh.period.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.shared.exception.ConflictException;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Cập nhật loại kỳ và hạn nộp của lịch đã lưu (UC-21) — phần tính kế hoạch
 * ({@link ReportCalendarService#planFor}), không chạm database.
 *
 * <p>Lịch mẫu: năm 2026, hạn nộp 5 ngày, đã sinh Tháng + Quý (16 kỳ, đều "Chưa thiết lập").
 */
class CalendarUpdatePlanTest {

    private ReportCalendar calendar;
    private List<ReportPeriod> periods;

    @BeforeEach
    void setUp() {
        Set<PeriodKind> kinds = EnumSet.of(PeriodKind.THANG, PeriodKind.QUY);
        calendar = new ReportCalendar(2026, 5, kinds);
        periods = new ArrayList<>();
        for (PeriodPlanner.PeriodPlan plan : PeriodPlanner.plan(2026, kinds, 5)) {
            periods.add(new ReportPeriod(calendar, plan.kind(), plan.seq(), plan.code(), plan.name(),
                    plan.fromDate(), plan.toDate(), plan.openFrom(), plan.deadline()));
        }
    }

    private ReportPeriod period(String code) {
        return periods.stream().filter(p -> p.getCode().equals(code)).findFirst().orElseThrow();
    }

    @Test
    @DisplayName("Không đổi gì thì kế hoạch rỗng (\"Không có thay đổi nào để cập nhật.\")")
    void unchangedCalendarGivesEmptyPlan() {
        assertTrue(ReportCalendarService.planFor(calendar, periods, null, null).isEmpty());
        assertTrue(ReportCalendarService.planFor(
                calendar, periods, List.of(PeriodKind.QUY, PeriodKind.THANG), 5).isEmpty());
    }

    @Test
    @DisplayName("Thêm loại kỳ Năm: sinh thêm 1 kỳ, không bỏ gì")
    void addingAKindCreatesItsPeriods() {
        ReportCalendarService.UpdatePlan plan = ReportCalendarService.planFor(
                calendar, periods, List.of(PeriodKind.THANG, PeriodKind.QUY, PeriodKind.NAM), null);

        assertEquals(List.of(PeriodKind.NAM), plan.addedKinds());
        assertEquals(1, plan.createdPeriods());
        assertTrue(plan.removedKinds().isEmpty());
        assertEquals(0, plan.removedPeriods());
        assertFalse(plan.isEmpty());
    }

    @Test
    @DisplayName("Thêm 6 tháng + Năm cùng lúc: 3 kỳ mới")
    void addingTwoKinds() {
        ReportCalendarService.UpdatePlan plan = ReportCalendarService.planFor(
                calendar, periods, EnumSet.allOf(PeriodKind.class), null);

        assertEquals(List.of(PeriodKind.SAU_THANG, PeriodKind.NAM), plan.addedKinds());
        assertEquals(3, plan.createdPeriods());
    }

    @Test
    @DisplayName("Bỏ loại kỳ Quý chưa dùng: xoá 4 kỳ")
    void removingAnUnusedKind() {
        ReportCalendarService.UpdatePlan plan =
                ReportCalendarService.planFor(calendar, periods, List.of(PeriodKind.THANG), null);

        assertEquals(List.of(PeriodKind.QUY), plan.removedKinds());
        assertEquals(4, plan.removedPeriods());
        assertEquals(0, plan.createdPeriods());
    }

    @Test
    @DisplayName("Không bỏ được loại kỳ đã có kỳ được gán đơn vị (UC-21 2c)")
    void removingAUsedKindIsRefused() {
        period("Q1").setStatus(PeriodStatus.READY);

        ConflictException refused = assertThrows(ConflictException.class,
                () -> ReportCalendarService.planFor(calendar, periods, List.of(PeriodKind.THANG), null));
        assertTrue(refused.getMessage().contains("Quý"), refused.getMessage());
    }

    @Test
    @DisplayName("Danh sách loại kỳ rỗng khi cập nhật bị từ chối")
    void emptyKindListIsRefused() {
        IllegalArgumentException refused = assertThrows(IllegalArgumentException.class,
                () -> ReportCalendarService.planFor(calendar, periods, List.of(), null));
        assertEquals("Cần chọn ít nhất một loại kỳ.", refused.getMessage());
    }

    @Test
    @DisplayName("Hạn nộp ngoài 1–365 ngày bị từ chối (UC-21 2b)")
    void invalidDeadlineIsRefused() {
        assertThrows(IllegalArgumentException.class,
                () -> ReportCalendarService.planFor(calendar, periods, null, 0));
        assertThrows(IllegalArgumentException.class,
                () -> ReportCalendarService.planFor(calendar, periods, null, 400));
    }

    @Test
    @DisplayName("Đổi hạn nộp: chỉ kỳ chưa dùng và chưa sửa tay được tính lại; kỳ đã dùng / sửa tay giữ hạn")
    void changingDeadlineReschedulesOnlyUnusedAutomaticPeriods() {
        period("T1").setStatus(PeriodStatus.CLOSED);
        period("Q1").setStatus(PeriodStatus.OPEN);
        period("T2").setDeadlineManual(true);

        ReportCalendarService.UpdatePlan plan = ReportCalendarService.planFor(calendar, periods, null, 10);

        assertTrue(plan.deadlineChanged());
        assertEquals(5, plan.oldDeadlineDays());
        assertEquals(10, plan.newDeadlineDays());
        // 16 kỳ − 2 kỳ đã dùng − 1 kỳ sửa tay.
        assertEquals(13, plan.rescheduledPeriods());
        assertEquals(List.of("T1", "Q1"), plan.keptDeadlineCodes());
        assertEquals(List.of("T2"), plan.manualDeadlineCodes());
        assertFalse(plan.isEmpty());
    }

    @Test
    @DisplayName("Đổi hạn nộp và bỏ Quý cùng lúc: kỳ quý bị xoá không tính vào số kỳ được tính lại")
    void removedPeriodsAreNotRescheduled() {
        ReportCalendarService.UpdatePlan plan =
                ReportCalendarService.planFor(calendar, periods, List.of(PeriodKind.THANG), 7);

        assertEquals(4, plan.removedPeriods());
        assertEquals(12, plan.rescheduledPeriods());
        assertTrue(plan.keptDeadlineCodes().isEmpty());
        assertTrue(plan.manualDeadlineCodes().isEmpty());
    }

    @Test
    @DisplayName("Không đổi hạn nộp thì không kỳ nào được tính lại")
    void sameDeadlineReschedulesNothing() {
        ReportCalendarService.UpdatePlan plan = ReportCalendarService.planFor(
                calendar, periods, List.of(PeriodKind.THANG, PeriodKind.QUY, PeriodKind.NAM), 5);

        assertFalse(plan.deadlineChanged());
        assertEquals(0, plan.rescheduledPeriods());
        assertTrue(plan.keptDeadlineCodes().isEmpty());
    }
}
