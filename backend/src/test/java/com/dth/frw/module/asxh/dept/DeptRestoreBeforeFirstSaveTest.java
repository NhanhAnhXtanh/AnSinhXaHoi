package com.dth.frw.module.asxh.dept;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.dept.DeptChange;
import com.dth.frw.domain.asxh.dept.DeptChangeAction;
import com.dth.frw.domain.asxh.dept.DeptReport;
import com.dth.frw.module.asxh.dept.repo.DeptChangeRepository;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerAuditRepository;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerLineRepository;
import com.dth.frw.module.asxh.dept.repo.DeptReportRepository;
import com.dth.frw.module.asxh.dept.repo.DeptReportSheetRepository;
import com.dth.frw.module.asxh.dept.service.DeptLedgerVersionService;
import com.dth.frw.module.asxh.dept.service.DeptPeriodService;
import com.dth.frw.module.asxh.dept.service.DeptSheetService;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.module.asxh.script.ServerScriptRunner;
import com.dth.frw.module.asxh.summary.repo.SummaryQueries;
import com.dth.frw.shared.exception.ConflictException;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Khôi phục số liệu Sở của kỳ ({@code POST /api/dept_reports/{id}/restore}) về một phiên bản có
 * trước lần lưu đầu của kỳ. Số phiên bản đánh chung cả năm, nên phiên bản đó vẫn "có thật" (kỳ khác
 * đã lưu ở đó) — trước đây lọt kiểm tra và khôi phục đóng hết dòng hiện hành: số liệu kỳ bị xoá sạch
 * dưới danh nghĩa "khôi phục". Dữ liệu thật có đúng tình huống này: số liệu kỳ id 2 năm 2029 lưu lần
 * đầu ở phiên bản 2, phiên bản 1 là của kỳ khác.
 */
class DeptRestoreBeforeFirstSaveTest {

    private DeptReportRepository reportRepository;
    private DeptReportSheetRepository sheetRepository;
    private DeptLedgerLineRepository lineRepository;
    private DeptChangeRepository changeRepository;
    private DeptLedgerVersionService versionService;
    private DeptSheetService service;

    @BeforeEach
    void setUp() {
        reportRepository = mock(DeptReportRepository.class);
        sheetRepository = mock(DeptReportSheetRepository.class);
        lineRepository = mock(DeptLedgerLineRepository.class);
        changeRepository = mock(DeptChangeRepository.class);
        versionService = mock(DeptLedgerVersionService.class);
        service = new DeptSheetService(mock(DeptPeriodService.class), reportRepository, sheetRepository,
                lineRepository, changeRepository, mock(DeptLedgerAuditRepository.class), versionService,
                mock(DeptYearLockService.class), mock(ServerScriptRunner.class), mock(SummaryQueries.class),
                mock(EntityManager.class));

        DeptReport report = new DeptReport(null, 2029);
        ReflectionTestUtils.setField(report, "id", 2L);
        report.setLedgerVersion(5);
        when(reportRepository.lockById(2L)).thenReturn(Optional.of(report));
        when(versionService.currentVersion(2029)).thenReturn(5);
        Instant now = Instant.now();
        when(changeRepository.findByReport(2L)).thenReturn(List.of(
                new DeptChange(2029, 2L, 10L, DeptChangeAction.RESTORED, 5, 3, null, "so.tonghop", now),
                new DeptChange(2029, 2L, null, DeptChangeAction.PERIOD_SAVED, 2, 40, null, "so.tonghop", now)));
        when(sheetRepository.findByReport(2L)).thenReturn(List.of());
    }

    @Test
    @DisplayName("Phiên bản trước lần lưu đầu của kỳ: 409 tiếng Việt, không đụng số liệu")
    void restoreBeforeFirstSaveRefused() {
        ConflictException error = assertThrows(ConflictException.class, () -> service.restore(2L, 1, null));

        assertTrue(error.getMessage().contains("xoá hết số liệu của kỳ"));
        verify(lineRepository, never()).findCurrent(org.mockito.ArgumentMatchers.anyLong());
        verify(versionService, never()).nextVersion(anyInt());
    }

    @Test
    @DisplayName("Phiên bản từ lần lưu đầu trở đi vẫn khôi phục được")
    void restoreWithinHistoryAllowed() {
        assertDoesNotThrow(() -> service.restore(2L, 2, "Về số lưu lần đầu"));
    }
}
