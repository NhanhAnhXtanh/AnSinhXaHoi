package com.dth.frw.module.asxh.period.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.dept.DeptLedgerYear;
import com.dth.frw.domain.asxh.dept.DeptYearLockState;
import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.module.asxh.dept.repo.DeptChangeRepository;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerYearRepository;
import com.dth.frw.module.asxh.dept.service.DeptLedgerVersionService;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.module.asxh.period.api.dto.ReportCalendarPatchRequest;
import com.dth.frw.module.asxh.period.api.dto.ReportPeriodPatchRequest;
import com.dth.frw.module.asxh.period.repo.ReportCalendarRepository;
import com.dth.frw.module.asxh.period.repo.ReportPeriodRepository;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Lịch báo cáo chốt cùng báo cáo năm (UC-60): năm đã nộp UBND (chờ duyệt) hoặc đã được UBND duyệt
 * thì không thêm / bỏ loại kỳ, không đổi hạn nộp chung hay hạn nộp từng kỳ, không xoá lịch được;
 * năm đang mở thì vẫn sửa như cũ.
 *
 * <p>{@link DeptYearLockService} chạy thật trên kho năm giả lập — trạng thái khoá đọc từ dòng của năm
 * đúng như khi báo cáo năm gọi {@code lock(SUBMITTED)} / {@code lock(APPROVED)}.
 */
class CalendarYearLockTest {

    private static final String SUBMITTED_2024 =
            "Báo cáo năm 2024 đã nộp UBND nên lịch báo cáo năm 2024 không sửa được nữa.";

    private DeptLedgerYearRepository yearRepository;
    private CalendarYearLock yearLock;
    private ReportCalendarRepository calendarRepository;
    private ReportPeriodRepository periodRepository;
    private ReportPeriodService periodService;
    private ReportCalendarService calendarService;
    private ReportCalendar calendar2024;

    @BeforeEach
    void setUp() {
        yearRepository = mock(DeptLedgerYearRepository.class);
        when(yearRepository.findByYear(anyInt())).thenReturn(Optional.empty());
        yearLock = new CalendarYearLock(new DeptYearLockService(yearRepository, mock(DeptChangeRepository.class),
                mock(DeptLedgerVersionService.class)));

        RowLevelSecurity rowLevel = mock(RowLevelSecurity.class);
        calendarRepository = mock(ReportCalendarRepository.class);
        periodRepository = mock(ReportPeriodRepository.class);
        periodService = mock(ReportPeriodService.class);
        calendarService = new ReportCalendarService(calendarRepository, periodService, rowLevel, yearLock);

        calendar2024 = new ReportCalendar(2024, 5, List.of(PeriodKind.THANG));
        ReflectionTestUtils.setField(calendar2024, "id", 24L);
        when(calendarRepository.findOne(ArgumentMatchers.<Specification<ReportCalendar>>any()))
                .thenReturn(Optional.of(calendar2024));
        when(periodService.listByCalendar(anyLong())).thenReturn(List.of());
    }

    /** Năm {@code year} ở trạng thái khoá {@code state} (như sau khi báo cáo năm gọi lock). */
    private void yearState(int year, DeptYearLockState state) {
        DeptLedgerYear row = mock(DeptLedgerYear.class);
        when(row.getLockState()).thenReturn(state);
        when(yearRepository.findByYear(year)).thenReturn(Optional.of(row));
    }

    private ReportPeriodService realPeriodService() {
        return new ReportPeriodService(periodRepository, mock(RowLevelSecurity.class), yearLock);
    }

    private ReportPeriod period2024() {
        ReportPeriod period = new ReportPeriod(calendar2024, PeriodKind.THANG, 5, "T05-2024", "Tháng 5/2024",
                LocalDate.of(2024, 5, 1), LocalDate.of(2024, 5, 31), LocalDate.of(2024, 5, 1),
                LocalDate.of(2024, 6, 5));
        ReflectionTestUtils.setField(period, "id", 245L);
        period.setStatus(PeriodStatus.DRAFT);
        return period;
    }

    @Test
    @DisplayName("Câu báo: năm đã nộp UBND / đã được duyệt có câu riêng; năm đang mở thì không khoá")
    void reasonsByYearState() {
        assertTrue(yearLock.reason(2024).isEmpty(), "Chưa có dòng năm = năm đang mở");

        yearState(2024, DeptYearLockState.OPEN);
        assertTrue(yearLock.reason(2024).isEmpty(), "Bị trả lại / mở lại = sửa được");

        yearState(2024, DeptYearLockState.SUBMITTED);
        assertEquals(SUBMITTED_2024, yearLock.reason(2024).orElseThrow());

        yearState(2024, DeptYearLockState.APPROVED);
        assertEquals("UBND đã duyệt báo cáo năm 2024 nên lịch báo cáo năm 2024 đã chốt, không sửa được nữa.",
                yearLock.reason(2024).orElseThrow());

        assertTrue(yearLock.reason(2025).isEmpty(), "Năm khác không bị ảnh hưởng");
    }

    @Test
    @DisplayName("Lịch của năm đã nộp UBND: thêm loại kỳ bị chặn, không sinh / xoá / dời kỳ nào")
    void updateBlockedWhenYearSubmitted() {
        yearState(2024, DeptYearLockState.SUBMITTED);
        ReportCalendarPatchRequest addQuarters =
                new ReportCalendarPatchRequest(2024, 5, List.of(PeriodKind.THANG, PeriodKind.QUY));

        ConflictException error = assertThrows(ConflictException.class,
                () -> calendarService.update(24L, addQuarters));

        assertEquals(SUBMITTED_2024, error.getMessage());
        verify(periodService, never()).generate(any(), any(), anyInt());
        verify(periodService, never()).removeKinds(anyLong(), any());
        verify(periodService, never()).reschedule(anyLong(), anyInt(), any());
        assertEquals(List.of(PeriodKind.THANG), List.copyOf(calendar2024.getKinds()), "Loại kỳ của lịch giữ nguyên");
    }

    @Test
    @DisplayName("Lịch của năm đang mở (hoặc bị UBND trả lại) vẫn thêm loại kỳ được")
    void updateAllowedWhenYearOpen() {
        yearState(2024, DeptYearLockState.OPEN);
        when(periodService.generate(any(), any(), anyInt()))
                .thenReturn(new ReportPeriodService.GenerationResult(4, 0));

        ReportCalendarService.CalendarResult result = calendarService.update(24L,
                new ReportCalendarPatchRequest(2024, 5, List.of(PeriodKind.THANG, PeriodKind.QUY)));

        assertEquals(4, result.created());
        verify(periodService).generate(any(), any(), anyInt());
    }

    @Test
    @DisplayName("Lịch của năm UBND đã duyệt: xoá lịch bị chặn")
    void deleteBlockedWhenYearApproved() {
        yearState(2024, DeptYearLockState.APPROVED);

        ConflictException error = assertThrows(ConflictException.class, () -> calendarService.delete(24L));

        assertTrue(error.getMessage().startsWith("UBND đã duyệt báo cáo năm 2024"));
        verify(periodService, never()).deleteAllOfCalendar(anyLong());
    }

    @Test
    @DisplayName("Hạn nộp từng kỳ của năm đã nộp UBND không đổi được")
    void periodDeadlineBlockedWhenYearSubmitted() {
        ReportPeriod period = period2024();
        when(periodRepository.findOne(ArgumentMatchers.<Specification<ReportPeriod>>any()))
                .thenReturn(Optional.of(period));
        ReportPeriodService service = realPeriodService();
        ReportPeriodPatchRequest later = new ReportPeriodPatchRequest(null, LocalDate.of(2024, 6, 10));

        yearState(2024, DeptYearLockState.SUBMITTED);
        ConflictException error = assertThrows(ConflictException.class, () -> service.update(245L, later));
        assertEquals(SUBMITTED_2024, error.getMessage());
        assertEquals(LocalDate.of(2024, 6, 5), period.getDeadline(), "Hạn nộp giữ nguyên");
    }
}
