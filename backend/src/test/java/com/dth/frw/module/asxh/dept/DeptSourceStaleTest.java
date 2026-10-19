package com.dth.frw.module.asxh.dept;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.dept.DeptReport;
import com.dth.frw.domain.asxh.dept.DeptReportSource;
import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.ReportStatus;
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
import com.dth.frw.module.asxh.summary.repo.SummaryQueries.ReportRow;
import com.dth.frw.module.asxh.summary.service.SummaryAggregationService;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Nhãn "có phiếu được duyệt hoặc trả lại sau lần lưu" (BR-55.4). Số liệu Sở chuyển từ bản Jmix mang dấu
 * băm tính trên mã phiếu UUID cũ — so với dấu băm đó thì cả ba kỳ đã lưu của dữ liệu thật luôn báo "đã đổi"
 * dù tập phiếu y nguyên (Tháng 8/2026: đóng băng phiếu 224 lần 1, hiện tại vẫn phiếu 224 lần 1).
 */
class DeptSourceStaleTest {

    private static final Instant APPROVED_AT = Instant.parse("2026-10-14T07:00:00Z");

    private SummaryQueries queries;
    private DeptReportSourceRepository sourceRepository;
    private DeptPeriodService service;
    private DeptReport report;

    @BeforeEach
    void setUp() {
        queries = mock(SummaryQueries.class);
        sourceRepository = mock(DeptReportSourceRepository.class);
        SummaryAggregationService aggregation = mock(SummaryAggregationService.class);
        when(aggregation.resolveLeafPeriodIds(8L)).thenReturn(List.of(8L));

        ReportPeriod august = new ReportPeriod(new ReportCalendar(2026, 15, List.of(PeriodKind.THANG)),
                PeriodKind.THANG, 8, "T8-2026", "Tháng 8/2026", LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31),
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 9, 15));
        ReflectionTestUtils.setField(august, "id", 8L);
        report = new DeptReport(august, 2026);
        ReflectionTestUtils.setField(report, "id", 3L);
        // Dấu băm kiểu bản Jmix (trên UUID) — không bao giờ khớp cách tính của bản mới.
        report.setSourceFingerprint("ba01958ca24ab827d755c133bce14f1c6ce2090f061e9362de4c6cc1551c932d");
        when(sourceRepository.findByReport(3L))
                .thenReturn(List.of(new DeptReportSource(report, 224L, 5L, 8L, 1, APPROVED_AT)));

        service = new DeptPeriodService(mock(DeptReportRepository.class), mock(DeptReportSheetRepository.class),
                mock(DeptLedgerLineRepository.class), sourceRepository, mock(DeptChangeRepository.class),
                mock(DeptLedgerVersionService.class), mock(DeptYearLockService.class), aggregation, queries,
                mock(ReportPeriodService.class), mock(TemplateVersionService.class), mock(EntityManager.class));
    }

    private static ReportRow current(long reportId, int revisionNo, ReportStatus status) {
        return new ReportRow(reportId, 8L, 5L, "Phường Dầu Giây", status, revisionNo, APPROVED_AT);
    }

    @Test
    @DisplayName("Tập phiếu y nguyên so với lúc lưu (dữ liệu chuyển từ Jmix): không báo đã đổi")
    void unchangedSourcesNotStale() {
        when(queries.currentReports(any())).thenReturn(List.of(current(224L, 1, ReportStatus.APPROVED)));

        assertFalse(service.isSourceStale(report));
    }

    @Test
    @DisplayName("Phiếu được duyệt lại (lần nộp mới) hoặc thêm phiếu mới sau khi lưu: báo đã đổi")
    void changedSourcesStale() {
        when(queries.currentReports(any())).thenReturn(List.of(current(224L, 2, ReportStatus.APPROVED)));
        assertTrue(service.isSourceStale(report));

        when(queries.currentReports(any())).thenReturn(List.of(current(224L, 1, ReportStatus.APPROVED),
                current(230L, 1, ReportStatus.APPROVED)));
        assertTrue(service.isSourceStale(report));
    }

    @Test
    @DisplayName("Phiếu bị trả lại sau khi lưu (không còn hiệu lực): báo đã đổi")
    void returnedSourceStale() {
        when(queries.currentReports(any())).thenReturn(List.of(current(224L, 1, ReportStatus.RETURNED)));

        assertTrue(service.isSourceStale(report));
    }
}
