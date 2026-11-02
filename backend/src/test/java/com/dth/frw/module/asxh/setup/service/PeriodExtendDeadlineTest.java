package com.dth.frw.module.asxh.setup.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.module.asxh.dept.repo.DeptChangeRepository;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerYearRepository;
import com.dth.frw.module.asxh.dept.service.DeptLedgerVersionService;
import com.dth.frw.module.asxh.dept.service.DeptPeriodService;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Gia hạn và mở lại (UC-28): hạn nộp mới theo đúng luật sửa hạn nộp ở lịch — sau ngày cuối kỳ và
 * không phải ngày đã qua. Trước đây chỉ kiểm "từ hôm nay", nên kỳ còn chưa hết vẫn nhận hạn nộp
 * sớm hơn ngày cuối kỳ.
 */
class PeriodExtendDeadlineTest {

    /** Năm xa để ngày cuối kỳ luôn sau hôm nay, bất kể ngày chạy test. */
    private static final ReportCalendar CALENDAR = new ReportCalendar(2099, 15, List.of(PeriodKind.QUY));
    private static final LocalDate TO_DATE = LocalDate.parse("2099-09-30");

    private ReportPeriodService periodService;
    private PeriodLifecycleService service;

    @BeforeEach
    void setUp() {
        DeptLedgerYearRepository years = mock(DeptLedgerYearRepository.class);
        when(years.findByYear(anyInt())).thenReturn(Optional.empty());
        DeptYearLockService yearLock = new DeptYearLockService(years, mock(DeptChangeRepository.class),
                mock(DeptLedgerVersionService.class));
        periodService = mock(ReportPeriodService.class);
        service = new PeriodLifecycleService(periodService, mock(PeriodSetupLockService.class),
                mock(PublicationService.class), mock(PeriodAssignmentService.class),
                mock(InputReportService.class), mock(DeptPeriodService.class), yearLock);

        ReportPeriod overdue = new ReportPeriod(CALENDAR, PeriodKind.QUY, 3, "K9", "Quý III/2099",
                LocalDate.parse("2099-07-01"), TO_DATE, LocalDate.parse("2099-07-01"), TO_DATE.plusDays(15));
        ReflectionTestUtils.setField(overdue, "id", 9L);
        overdue.setStatus(PeriodStatus.OVERDUE);
        when(periodService.get(9L)).thenReturn(overdue);
    }

    @Test
    @DisplayName("Hạn nộp mới đúng ngày cuối kỳ: bị từ chối, kỳ không đổi")
    void deadlineOnPeriodEndIsRefused() {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.extend(9L, TO_DATE));

        assertEquals("Hạn nộp của kỳ Quý III/2099 phải sau ngày cuối kỳ (30/09/2099).", error.getMessage());
        verify(periodService, never()).changeDeadline(anyLong(), any());
        verify(periodService, never()).transition(anyLong(), any());
    }

    @Test
    @DisplayName("Hạn nộp mới sau ngày cuối kỳ: dời hạn rồi mở lại")
    void deadlineAfterPeriodEndIsAccepted() {
        service.extend(9L, TO_DATE.plusDays(1));

        verify(periodService).changeDeadline(9L, TO_DATE.plusDays(1));
        verify(periodService).transition(9L, PeriodStatus.OPEN);
    }

    @Test
    @DisplayName("Không chọn hạn nộp mới: bị từ chối")
    void missingDeadlineIsRefused() {
        assertThrows(IllegalArgumentException.class, () -> service.extend(9L, null));
        verify(periodService, never()).changeDeadline(anyLong(), any());
    }
}
