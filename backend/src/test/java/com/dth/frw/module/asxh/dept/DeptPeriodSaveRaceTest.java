package com.dth.frw.module.asxh.dept;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.dept.DeptReport;
import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.dept.repo.DeptChangeRepository;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerLineRepository;
import com.dth.frw.module.asxh.dept.repo.DeptReportRepository;
import com.dth.frw.module.asxh.dept.repo.DeptReportSheetRepository;
import com.dth.frw.module.asxh.dept.repo.DeptReportSourceRepository;
import com.dth.frw.module.asxh.dept.service.DeptLedgerVersionService;
import com.dth.frw.module.asxh.dept.service.DeptPeriodService;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.module.asxh.summary.repo.SummaryQueries;
import com.dth.frw.module.asxh.summary.service.SummaryAggregationService;
import com.dth.frw.module.asxh.summary.service.PeriodVersionResolver;
import com.dth.frw.shared.exception.ConflictException;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Lưu số liệu tổng hợp kỳ khi hai lượt chạy song song: cả hai đã qua bước kiểm đầu ("chưa lưu", "không
 * chồng kỳ đã lưu", "năm còn mở"), xếp hàng ở khoá năm. Lượt sau phải KIỂM LẠI sau khi giữ khoá — không thì
 * hai kỳ chồng thời gian (Quý I và Tháng 1) cùng vào số liệu Sở và năm cộng trùng. Mô phỏng phần lượt
 * trước vừa commit bằng kho trả "chưa có" ở lần đọc đầu và "đã có" ở lần đọc sau khoá.
 */
class DeptPeriodSaveRaceTest {

    private static final ReportCalendar CALENDAR = new ReportCalendar(2026, 15, List.of(PeriodKind.QUY));

    private DeptReportRepository reportRepository;
    private DeptLedgerVersionService versionService;
    private DeptYearLockService yearLockService;
    private DeptPeriodService service;
    private ReportPeriod quarter;

    @BeforeEach
    void setUp() {
        reportRepository = mock(DeptReportRepository.class);
        versionService = mock(DeptLedgerVersionService.class);
        yearLockService = mock(DeptYearLockService.class);
        when(yearLockService.lockReason(anyInt())).thenReturn(Optional.empty());
        SummaryAggregationService aggregation = mock(SummaryAggregationService.class);
        SummaryQueries queries = mock(SummaryQueries.class);
        ReportPeriodService periodService = mock(ReportPeriodService.class);
        PeriodVersionResolver templateVersions = mock(PeriodVersionResolver.class);

        quarter = new ReportPeriod(CALENDAR, PeriodKind.QUY, 1, "Q1-2026", "Quý I/2026",
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31), LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 4, 15));
        ReflectionTestUtils.setField(quarter, "id", 11L);
        quarter.setStatus(PeriodStatus.CLOSED);
        when(periodService.get(11L)).thenReturn(quarter);
        when(aggregation.resolveLeafPeriodIds(11L)).thenReturn(List.of(11L));
        when(queries.currentReports(any())).thenReturn(List.of());

        Template form = mock(Template.class);
        when(form.getId()).thenReturn(1L);
        when(form.getKind()).thenReturn(TemplateKind.CHI_TIET);
        when(queries.assignedTemplates(11L)).thenReturn(List.of(form));
        when(templateVersions.resolve(any(), any(), eq(1L)))
                .thenReturn(Optional.of(new PeriodVersionResolver.Resolved(mock(TemplateVersion.class), true)));

        service = new DeptPeriodService(reportRepository, mock(DeptReportSheetRepository.class),
                mock(DeptLedgerLineRepository.class), mock(DeptReportSourceRepository.class),
                mock(DeptChangeRepository.class), versionService, yearLockService, aggregation, queries,
                periodService, templateVersions, mock(EntityManager.class));
    }

    @Test
    @DisplayName("Kỳ chồng thời gian vừa được lưu ở lượt khác: lượt sau dừng sau khi giữ khoá năm, không tiêu phiên bản")
    void overlapCommittedMeanwhileRefused() {
        DeptReport january = mock(DeptReport.class);
        ReportPeriod month = new ReportPeriod(CALENDAR, PeriodKind.THANG, 1, "T1-2026", "Tháng 1/2026",
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31), LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 2, 15));
        when(january.getPeriod()).thenReturn(month);
        when(reportRepository.findByPeriodId(11L)).thenReturn(Optional.empty());
        // Lần kiểm đầu chưa thấy Tháng 1; lần kiểm sau khoá thấy (lượt kia vừa commit).
        when(reportRepository.findOverlapping(eq(11L), any(), any())).thenReturn(List.of(), List.of(january));

        ConflictException error = assertThrows(ConflictException.class, () -> service.saveClosedPeriod(11L));
        assertEquals("Kỳ Quý I/2026 trùng thời gian với kỳ đã lưu số liệu (Tháng 1/2026) — lưu cả hai sẽ cộng trùng"
                + " số liệu trong năm.", error.getMessage());
        verify(versionService).lockYear(2026);
        verify(versionService, never()).nextVersion(anyInt());
        verify(reportRepository, never()).save(any());
    }

    @Test
    @DisplayName("Chốt đợt: kỳ vừa được lưu ở lượt khác thì bỏ qua (không báo lỗi làm hỏng chốt đợt)")
    void closeSkipsWhenSavedMeanwhile() {
        when(reportRepository.findByPeriodId(11L)).thenReturn(Optional.empty(), Optional.of(mock(DeptReport.class)));
        when(reportRepository.findOverlapping(anyLong(), any(), any())).thenReturn(List.of());

        assertNull(service.snapshotClosedPeriod(quarter));
        verify(versionService, never()).nextVersion(anyInt());
    }

    @Test
    @DisplayName("Năm vừa nộp UBND trong lúc lưu: từ chối sau khi giữ khoá năm")
    void yearLockedMeanwhileRefused() {
        when(reportRepository.findByPeriodId(11L)).thenReturn(Optional.empty());
        when(reportRepository.findOverlapping(anyLong(), any(), any())).thenReturn(List.of());
        // Bước kiểm đầu (assertOpen, ở đây là mock) đã qua; dòng năm đọc lại sau khoá thì đã khoá.
        when(yearLockService.lockReason(2026)).thenReturn(Optional.of("Báo cáo năm 2026 đã nộp UBND."));

        ConflictException error = assertThrows(ConflictException.class, () -> service.saveClosedPeriod(11L));
        assertEquals("Báo cáo năm 2026 đã nộp UBND.", error.getMessage());
        verify(versionService, never()).nextVersion(anyInt());
    }
}
