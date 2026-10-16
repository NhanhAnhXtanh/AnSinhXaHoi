package com.dth.frw.module.asxh.period.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.asxh.period.PeriodKind;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Sinh kỳ chuẩn của một năm (UC-20) — thuần hàm, không cần Spring.
 *
 * <p>Ba điều phải đúng tuyệt đối vì cả hệ thống dựa vào: đủ số kỳ mỗi loại, kỳ phủ
 * trọn các tháng của nó (kỳ con ghép khít khi tổng hợp), và hạn nộp = ngày cuối kỳ
 * + số ngày hạn nộp.
 */
class PeriodPlannerTest {

    private static final int YEAR = 2026;

    @Test
    @DisplayName("Đủ bốn loại kỳ: 12 tháng + 4 quý + 2 sáu tháng + 1 năm = 19 kỳ, theo thứ tự Tháng → Quý → 6 tháng → Năm")
    void allKindsGiveNineteenPeriodsInOrder() {
        List<PeriodPlanner.PeriodPlan> plans =
                PeriodPlanner.plan(YEAR, EnumSet.allOf(PeriodKind.class), 5);

        assertEquals(19, plans.size());
        assertEquals(12, plans.stream().filter(p -> p.kind() == PeriodKind.THANG).count());
        assertEquals(4, plans.stream().filter(p -> p.kind() == PeriodKind.QUY).count());
        assertEquals(2, plans.stream().filter(p -> p.kind() == PeriodKind.SAU_THANG).count());
        assertEquals(1, plans.stream().filter(p -> p.kind() == PeriodKind.NAM).count());

        assertEquals("T1", plans.get(0).code());
        assertEquals("T12", plans.get(11).code());
        assertEquals("Q1", plans.get(12).code());
        assertEquals("6TĐN", plans.get(16).code());
        assertEquals("NAM", plans.get(18).code());
    }

    @Test
    @DisplayName("Mặc định khi tạo lịch: Tháng + Quý + 6 tháng = 18 kỳ")
    void defaultKindsGiveEighteenPeriods() {
        assertEquals(18, PeriodPlanner.plan(YEAR, PeriodPlanner.DEFAULT_KINDS, 5).size());
        assertEquals(5, PeriodPlanner.DEFAULT_DEADLINE_DAYS);
    }

    @Test
    @DisplayName("Thứ tự chọn và loại kỳ lặp / null không làm sai kết quả")
    void kindsAreDeduplicatedAndOrdered() {
        List<PeriodPlanner.PeriodPlan> plans = PeriodPlanner.plan(
                YEAR, Arrays.asList(PeriodKind.NAM, null, PeriodKind.QUY, PeriodKind.NAM), 5);

        assertEquals(5, plans.size());
        assertEquals(PeriodKind.QUY, plans.get(0).kind());
        assertEquals(PeriodKind.NAM, plans.get(4).kind());
    }

    @Test
    @DisplayName("Không chọn loại kỳ nào thì không sinh kỳ nào (UC-06 3a)")
    void noKindsGiveNoPeriods() {
        assertTrue(PeriodPlanner.plan(YEAR, List.of(), 5).isEmpty());
        assertTrue(PeriodPlanner.plan(YEAR, null, 5).isEmpty());
    }

    @Test
    @DisplayName("Kỳ tháng phủ trọn tháng và nối liền nhau, kể cả tháng 2 năm nhuận")
    void monthsCoverWholeMonthsWithoutGaps() {
        List<PeriodPlanner.PeriodPlan> months = PeriodPlanner.plan(YEAR, List.of(PeriodKind.THANG), 5);

        assertEquals(LocalDate.of(2026, 1, 1), months.get(0).fromDate());
        assertEquals(LocalDate.of(2026, 1, 31), months.get(0).toDate());
        assertEquals(LocalDate.of(2026, 2, 28), months.get(1).toDate());
        assertEquals(LocalDate.of(2026, 12, 31), months.get(11).toDate());
        for (int i = 1; i < months.size(); i++) {
            assertEquals(months.get(i - 1).toDate().plusDays(1), months.get(i).fromDate(),
                    "Kỳ " + months.get(i).code() + " phải bắt đầu ngay sau kỳ trước");
        }

        PeriodPlanner.PeriodPlan leapFebruary = PeriodPlanner.plan(2028, PeriodKind.THANG, 2, 5);
        assertEquals(LocalDate.of(2028, 2, 29), leapFebruary.toDate());
    }

    @Test
    @DisplayName("Quý IV: 01/10 → 31/12, hạn nộp 5 ngày rơi sang năm sau")
    void fourthQuarter() {
        PeriodPlanner.PeriodPlan q4 = PeriodPlanner.plan(YEAR, PeriodKind.QUY, 4, 5);

        assertEquals("Q4", q4.code());
        assertEquals("Quý IV/2026", q4.name());
        assertEquals(LocalDate.of(2026, 10, 1), q4.fromDate());
        assertEquals(LocalDate.of(2026, 12, 31), q4.toDate());
        assertEquals(LocalDate.of(2026, 10, 1), q4.openFrom());
        assertEquals(LocalDate.of(2027, 1, 5), q4.deadline());
    }

    @Test
    @DisplayName("Sáu tháng đầu / cuối năm và cả năm")
    void halfYearsAndYear() {
        PeriodPlanner.PeriodPlan first = PeriodPlanner.plan(YEAR, PeriodKind.SAU_THANG, 1, 10);
        assertEquals("6TĐN", first.code());
        assertEquals("6 tháng đầu năm 2026", first.name());
        assertEquals(LocalDate.of(2026, 1, 1), first.fromDate());
        assertEquals(LocalDate.of(2026, 6, 30), first.toDate());
        assertEquals(LocalDate.of(2026, 7, 10), first.deadline());

        PeriodPlanner.PeriodPlan second = PeriodPlanner.plan(YEAR, PeriodKind.SAU_THANG, 2, 10);
        assertEquals("6TCN", second.code());
        assertEquals("6 tháng cuối năm 2026", second.name());
        assertEquals(LocalDate.of(2026, 7, 1), second.fromDate());
        assertEquals(LocalDate.of(2026, 12, 31), second.toDate());

        PeriodPlanner.PeriodPlan year = PeriodPlanner.plan(YEAR, PeriodKind.NAM, 1, 30);
        assertEquals("NAM", year.code());
        assertEquals("Năm 2026", year.name());
        assertEquals(LocalDate.of(2026, 1, 1), year.fromDate());
        assertEquals(LocalDate.of(2026, 12, 31), year.toDate());
        assertEquals(LocalDate.of(2027, 1, 30), year.deadline());
    }

    @Test
    @DisplayName("Mọi kỳ: mở nhận số liệu từ ngày đầu kỳ, hạn nộp = ngày cuối kỳ + số ngày")
    void windowOpensAtStartAndClosesAfterDeadlineDays() {
        for (PeriodPlanner.PeriodPlan plan : PeriodPlanner.plan(YEAR, EnumSet.allOf(PeriodKind.class), 7)) {
            assertEquals(plan.fromDate(), plan.openFrom(), plan.code());
            assertEquals(plan.toDate().plusDays(7), plan.deadline(), plan.code());
            assertEquals(YEAR, plan.year());
        }
        assertEquals(LocalDate.of(2026, 2, 5), PeriodPlanner.deadlineFor(LocalDate.of(2026, 1, 31), 5));
    }

    @Test
    @DisplayName("Tên kỳ tháng có dạng \"Tháng 3/2026\"")
    void monthName() {
        assertEquals("Tháng 3/2026", PeriodPlanner.name(YEAR, PeriodKind.THANG, 3));
        assertEquals("T3", PeriodPlanner.code(PeriodKind.THANG, 3));
    }

    @Test
    @DisplayName("Hạn nộp chỉ nhận 1–365 ngày")
    void deadlineDaysMustBeBetweenOneAndThreeHundredSixtyFive() {
        assertDoesNotThrow(() -> PeriodPlanner.requireValidDeadline(1));
        assertDoesNotThrow(() -> PeriodPlanner.requireValidDeadline(365));

        IllegalArgumentException zero =
                assertThrows(IllegalArgumentException.class, () -> PeriodPlanner.requireValidDeadline(0));
        assertEquals("Hạn nộp phải từ 1 đến 365 ngày.", zero.getMessage());
        assertThrows(IllegalArgumentException.class, () -> PeriodPlanner.requireValidDeadline(366));
        assertThrows(IllegalArgumentException.class,
                () -> PeriodPlanner.plan(YEAR, List.of(PeriodKind.QUY), 0));
    }

    @Test
    @DisplayName("Số thứ tự kỳ ngoài phạm vi của loại kỳ bị từ chối")
    void sequenceOutOfRangeIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> PeriodPlanner.plan(YEAR, PeriodKind.QUY, 5, 5));
        assertThrows(IllegalArgumentException.class, () -> PeriodPlanner.plan(YEAR, PeriodKind.THANG, 0, 5));
        assertThrows(IllegalArgumentException.class, () -> PeriodPlanner.code(PeriodKind.NAM, 2));
    }
}
