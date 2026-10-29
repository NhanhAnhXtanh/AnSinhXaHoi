package com.dth.frw.module.asxh.annual;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
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
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.module.asxh.dept.repo.DeptChangeRepository;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerYearRepository;
import com.dth.frw.module.asxh.dept.service.DeptLedgerVersionService;
import com.dth.frw.module.asxh.dept.service.DeptPeriodService;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.module.asxh.inputreport.repo.InputReportRepository;
import com.dth.frw.module.asxh.inputreport.repo.InputReportSheetRepository;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.ledger.service.InputReportWorkflowHooks;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.module.asxh.setup.repo.PublicationRepository;
import com.dth.frw.module.asxh.setup.service.PeriodAssignmentService;
import com.dth.frw.module.asxh.setup.service.PeriodLifecycleService;
import com.dth.frw.module.asxh.setup.service.PeriodSetupLockService;
import com.dth.frw.module.asxh.setup.service.PublicationService;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Khoá năm (UC-60): năm 2026 đã nộp báo cáo năm lên UBND thì thiết lập / mở đợt / gia hạn kỳ, duyệt /
 * trả lại phiếu đơn vị của năm đều bị chặn bằng câu tiếng Việt; năm 2027 không bị ảnh hưởng. Cùng các
 * chỗ nối số liệu tổng hợp vào điều hành đợt: chốt đợt lưu số liệu kỳ (BR-27.1), thu hồi bị chặn khi kỳ
 * đã vào số liệu tổng hợp (UC-29 3a).
 *
 * <p>{@link DeptYearLockService} chạy thật trên kho năm giả lập — trạng thái khoá đọc từ dòng của năm
 * đúng như khi báo cáo năm gọi {@code lock(SUBMITTED)}.
 */
class AnnualYearLockGuardsTest {

    private static final ReportCalendar CALENDAR_2026 = new ReportCalendar(2026, 15, List.of(PeriodKind.QUY));
    private static final ReportCalendar CALENDAR_2027 = new ReportCalendar(2027, 15, List.of(PeriodKind.QUY));

    private DeptLedgerYearRepository yearRepository;
    private DeptYearLockService yearLockService;

    @BeforeEach
    void setUp() {
        yearRepository = mock(DeptLedgerYearRepository.class);
        when(yearRepository.findByYear(anyInt())).thenReturn(Optional.empty());
        yearLockService = new DeptYearLockService(yearRepository, mock(DeptChangeRepository.class),
                mock(DeptLedgerVersionService.class));
    }

    /** Năm {@code year} ở trạng thái khoá {@code state} (như sau khi báo cáo năm gọi lock). */
    private void yearState(int year, DeptYearLockState state) {
        DeptLedgerYear row = mock(DeptLedgerYear.class);
        when(row.getLockState()).thenReturn(state);
        when(row.getLockNote()).thenReturn(null);
        when(yearRepository.findByYear(year)).thenReturn(Optional.of(row));
    }

    private static ReportPeriod period(long id, ReportCalendar calendar, String name, String from, String to,
                                       PeriodStatus status) {
        LocalDate fromDate = LocalDate.parse(from);
        LocalDate toDate = LocalDate.parse(to);
        ReportPeriod period = new ReportPeriod(calendar, PeriodKind.QUY, 1, "K" + id, name, fromDate, toDate,
                fromDate, toDate.plusDays(15));
        ReflectionTestUtils.setField(period, "id", id);
        period.setStatus(status);
        return period;
    }

    // ------------------------------------------------------------------ thiết lập / mở đợt

    @Test
    @DisplayName("Thiết lập: mọi kỳ của năm đã nộp UBND bị khoá với câu của khung Figma; năm khác không")
    void setupLockedByYear() {
        yearState(2026, DeptYearLockState.SUBMITTED);
        PublicationRepository publications = mock(PublicationRepository.class);
        when(publications.findOpenedPeriodsOverlapping(eq(PublicationStatus.PUBLISHED), anyCollection(), any(), any()))
                .thenReturn(List.of());
        PeriodSetupLockService lockService = new PeriodSetupLockService(publications, yearLockService);

        ReportPeriod q4 = period(1, CALENDAR_2026, "Quý IV/2026", "2026-10-01", "2026-12-31", PeriodStatus.READY);
        ReportPeriod q1Open = period(2, CALENDAR_2026, "Quý I/2026", "2026-01-01", "2026-03-31", PeriodStatus.OPEN);
        ReportPeriod next = period(3, CALENDAR_2027, "Quý I/2027", "2027-01-01", "2027-03-31", PeriodStatus.READY);

        Map<Long, PeriodSetupLockService.PeriodLock> locks = lockService.locks(List.of(q4, q1Open, next));

        assertEquals(PeriodSetupLockService.LockKind.YEAR, locks.get(q4.getId()).kind());
        assertEquals("Năm 2026 đã nộp UBND nên không sửa được số liệu các kỳ trong năm.", locks.get(q4.getId()).reason());
        assertNull(locks.get(q4.getId()).sourceName());
        assertTrue(locks.containsKey(q1Open.getId()), "Kỳ đã mở đợt của năm đã nộp cũng bị khoá");
        assertFalse(locks.containsKey(next.getId()), "Năm 2027 không bị ảnh hưởng");

        ConflictException error = assertThrows(ConflictException.class, () -> lockService.assertSetupAllowed(q4));
        assertEquals("Năm 2026 đã nộp UBND nên không sửa được số liệu các kỳ trong năm.", error.getMessage());
        assertDoesNotThrow(() -> lockService.assertSetupAllowed(next));
    }

    @Test
    @DisplayName("Thiết lập: năm UBND đã duyệt dùng câu riêng")
    void setupLockedByApprovedYear() {
        yearState(2026, DeptYearLockState.APPROVED);
        PublicationRepository publications = mock(PublicationRepository.class);
        when(publications.findOpenedPeriodsOverlapping(eq(PublicationStatus.PUBLISHED), anyCollection(), any(), any()))
                .thenReturn(List.of());
        PeriodSetupLockService lockService = new PeriodSetupLockService(publications, yearLockService);
        ReportPeriod q4 = period(1, CALENDAR_2026, "Quý IV/2026", "2026-10-01", "2026-12-31", PeriodStatus.READY);

        assertEquals("Năm 2026 đã được UBND duyệt nên không sửa được số liệu các kỳ trong năm.",
                lockService.lock(q4).orElseThrow().reason());
    }

    // ------------------------------------------------------------------ điều hành đợt

    private ReportPeriodService periodService;
    private InputReportService inputReportService;
    private PublicationService publicationService;
    private DeptPeriodService deptPeriodService;

    private PeriodLifecycleService lifecycle() {
        periodService = mock(ReportPeriodService.class);
        inputReportService = mock(InputReportService.class);
        publicationService = mock(PublicationService.class);
        deptPeriodService = mock(DeptPeriodService.class);
        return new PeriodLifecycleService(periodService, mock(PeriodSetupLockService.class), publicationService,
                mock(PeriodAssignmentService.class), inputReportService, deptPeriodService, yearLockService);
    }

    @Test
    @DisplayName("Gia hạn kỳ quá hạn của năm đã nộp UBND: 409, hạn nộp không đổi")
    void extendBlockedByYearLock() {
        yearState(2026, DeptYearLockState.SUBMITTED);
        PeriodLifecycleService service = lifecycle();
        ReportPeriod overdue = period(5, CALENDAR_2026, "Quý III/2026", "2026-07-01", "2026-09-30", PeriodStatus.OVERDUE);
        when(periodService.get(5L)).thenReturn(overdue);

        ConflictException error = assertThrows(ConflictException.class,
                () -> service.extend(5L, LocalDate.now().plusDays(10)));

        assertEquals("Báo cáo năm 2026 đã nộp UBND và đang chờ duyệt nên chưa sửa được số liệu.", error.getMessage());
        verify(periodService, never()).changeDeadline(anyLong(), any());
        verify(periodService, never()).transition(anyLong(), any());
    }

    @Test
    @DisplayName("Chốt đợt lưu số liệu tổng hợp của kỳ trong cùng giao dịch (BR-27.1)")
    void closeSnapshotsPeriod() {
        PeriodLifecycleService service = lifecycle();
        ReportPeriod open = period(6, CALENDAR_2026, "Quý II/2026", "2026-04-01", "2026-06-30", PeriodStatus.OPEN);
        ReportPeriod closed = period(6, CALENDAR_2026, "Quý II/2026", "2026-04-01", "2026-06-30", PeriodStatus.CLOSED);
        when(periodService.get(6L)).thenReturn(open);
        when(inputReportService.unitsAwaitingReview(6L)).thenReturn(List.of());
        when(periodService.transition(6L, PeriodStatus.CLOSED)).thenReturn(closed);

        assertEquals(PeriodStatus.CLOSED, service.close(6L).getStatus());
        verify(deptPeriodService).snapshotClosedPeriod(closed);
    }

    @Test
    @DisplayName("Thu hồi kỳ đã vào số liệu tổng hợp: 409, không xoá phiếu nào")
    void withdrawBlockedWhenUsedBySummary() {
        PeriodLifecycleService service = lifecycle();
        ReportPeriod open = period(7, CALENDAR_2026, "Tháng 2/2026", "2026-02-01", "2026-02-28", PeriodStatus.OPEN);
        when(periodService.get(7L)).thenReturn(open);
        when(deptPeriodService.isUsedBy(open)).thenReturn(true);

        assertThrows(ConflictException.class, () -> service.withdraw(7L, "Tháng 2/2026"));
        verify(inputReportService, never()).deleteAllForPeriod(anyLong());
        verify(publicationService, never()).cancelAll(anyLong());
    }

    // ------------------------------------------------------------------ phiếu đơn vị

    private InputReportRepository reportRepository;
    private InputReportWorkflowHooks hooks;

    private InputReportService inputReports() {
        reportRepository = mock(InputReportRepository.class);
        hooks = mock(InputReportWorkflowHooks.class);
        return new InputReportService(reportRepository, mock(InputReportSheetRepository.class),
                mock(RowLevelSecurity.class), hooks, yearLockService);
    }

    private InputReport submittedReport(long id, ReportCalendar calendar) {
        ReportPeriod period = period(10, calendar, "Quý I/" + calendar.getYear(),
                calendar.getYear() + "-01-01", calendar.getYear() + "-03-31", PeriodStatus.OPEN);
        InputReport report = new InputReport(null, period, null);
        ReflectionTestUtils.setField(report, "id", id);
        report.setStatus(ReportStatus.SUBMITTED);
        when(reportRepository.findForUpdate(id)).thenReturn(Optional.of(report));
        return report;
    }

    @Test
    @DisplayName("Duyệt / trả lại phiếu đơn vị của năm đã nộp UBND: 409 tiếng Việt, không ghi số liệu")
    void reviewBlockedByYearLock() {
        yearState(2026, DeptYearLockState.SUBMITTED);
        InputReportService service = inputReports();
        submittedReport(21L, CALENDAR_2026);

        ConflictException approve = assertThrows(ConflictException.class, () -> service.approve(21L));
        assertEquals("Năm 2026 đã nộp báo cáo năm lên UBND nên không phê duyệt được nữa: "
                + "số liệu các kỳ trong năm đã khoá.", approve.getMessage());
        verify(hooks, never()).onApprove(any(), any());

        ConflictException giveBack = assertThrows(ConflictException.class,
                () -> service.returnReport(21L, "Sai số biểu 1a"));
        assertTrue(giveBack.getMessage().contains("không trả lại được nữa"));
        verify(reportRepository, never()).persist(any());
    }
}
