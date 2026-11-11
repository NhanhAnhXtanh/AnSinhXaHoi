package com.dth.frw.module.asxh.annual;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.annual.AnnualReport;
import com.dth.frw.domain.asxh.annual.AnnualReportStatus;
import com.dth.frw.module.asxh.annual.repo.AnnualReportAttachmentRepository;
import com.dth.frw.module.asxh.annual.repo.AnnualReportRepository;
import com.dth.frw.module.asxh.annual.repo.AnnualReportSheetRepository;
import com.dth.frw.module.asxh.annual.service.AnnualReportService;
import com.dth.frw.module.asxh.annual.service.AnnualReportService.YearCheck;
import com.dth.frw.module.asxh.attachment.service.AttachmentStorage;
import com.dth.frw.module.asxh.dept.query.DeptYearDataQuery;
import com.dth.frw.module.asxh.dept.query.DeptYearPeriod;
import com.dth.frw.module.asxh.summary.service.SummaryAggregationService;
import com.dth.frw.module.asxh.summary.service.SummaryReportService;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.SheetOption;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.YearOverview;
import com.dth.frw.module.asxh.template.service.TemplateScriptService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Kiểm trước khi nộp báo cáo năm (UC-59 bước 2): lý do chặn bằng câu tiếng Việt, cảnh báo kỳ chưa lưu
 * số liệu (vẫn nộp được), một năm một phiếu còn hiệu lực.
 */
class AnnualSubmitCheckTest {

    private static final int YEAR = 2026;

    private static final SheetOption YEAR_SHEET =
            new SheetOption(31L, "BT-01", "01", "Biểu tổng hợp năm", 310L, 1, LocalDate.of(2026, 1, 1), false);

    private static final DeptYearPeriod Q1_SAVED = period(1L, "Quý I/2026", 11L, List.of());
    private static final DeptYearPeriod Q2_SAVED_MISSING = period(2L, "Quý II/2026", 12L, List.of("1c"));
    private static final DeptYearPeriod Q3_UNSAVED = period(3L, "Quý III/2026", null, List.of("1a", "1b"));

    private SummaryReportService summaryReports;
    private AnnualReportRepository repository;
    private AnnualReportService service;

    @BeforeEach
    void setUp() {
        summaryReports = mock(SummaryReportService.class);
        repository = mock(AnnualReportRepository.class);
        when(repository.findByYearAndStatusIn(anyInt(), anyCollection())).thenReturn(List.of());
        when(repository.findByYear(anyInt())).thenReturn(List.of());
        service = new AnnualReportService(repository, mock(AnnualReportSheetRepository.class),
                mock(AnnualReportAttachmentRepository.class), summaryReports, mock(SummaryAggregationService.class),
                mock(DeptYearDataQuery.class), mock(AttachmentStorage.class), mock(TemplateScriptService.class));
    }

    private static DeptYearPeriod period(Long id, String name, Long deptReportId, List<String> unsaved) {
        return new DeptYearPeriod(id, name, "QUY", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31), "CLOSED",
                deptReportId, List.of(), unsaved, List.of(), List.of(), deptReportId == null ? null : 3, null);
    }

    private void overview(int version, int saved, String lockReason, List<SheetOption> sheets,
                          List<DeptYearPeriod> periods, List<String> unfinished) {
        when(summaryReports.year(YEAR)).thenReturn(new YearOverview(YEAR, version, saved > 0 ? "DEPT" : "LIVE",
                saved, periods.size(), lockReason, sheets, periods, unfinished, List.of()));
    }

    @Test
    @DisplayName("Đủ điều kiện: không có lý do chặn; kỳ chưa lưu / thiếu biểu chỉ là cảnh báo")
    void readyWithWarnings() {
        overview(5, 2, null, List.of(YEAR_SHEET), List.of(Q1_SAVED, Q2_SAVED_MISSING, Q3_UNSAVED), List.of());

        YearCheck check = service.check(YEAR);

        assertNull(check.blocker());
        assertEquals(5, check.ledgerVersion());
        assertEquals(2, check.warnings().size());
        assertTrue(check.warnings().get(0).startsWith("Quý II/2026: số liệu đã lưu thiếu biểu 1c"));
        assertTrue(check.warnings().get(1).startsWith("Quý III/2026: chưa lưu số liệu tổng hợp"));
    }

    @Test
    @DisplayName("Còn biểu đang sửa dở: chặn nộp, nêu đúng biểu của kỳ nào")
    void blockedByUnfinishedSheets() {
        overview(5, 2, null, List.of(YEAR_SHEET), List.of(Q1_SAVED, Q2_SAVED_MISSING),
                List.of("biểu 1a của Quý I/2026", "biểu 1b của Quý II/2026"));

        YearCheck check = service.check(YEAR);

        assertEquals("Còn biểu 1a của Quý I/2026 và biểu 1b của Quý II/2026 đang sửa dở. "
                + "Hoàn tất các biểu này ở Theo kỳ rồi nộp báo cáo năm.", check.blocker());
    }

    @Test
    @DisplayName("Năm chưa có kỳ nào lưu số liệu: chặn nộp")
    void blockedWhenNothingSaved() {
        overview(0, 0, null, List.of(YEAR_SHEET), List.of(Q3_UNSAVED), List.of());

        assertEquals("Năm 2026 chưa có kỳ nào lưu số liệu tổng hợp — chốt đợt báo cáo ở Theo kỳ trước khi nộp.",
                service.check(YEAR).blocker());
    }

    @Test
    @DisplayName("Đã có phiếu đang chờ duyệt: một năm chỉ nộp một phiếu")
    void blockedByActiveReport() {
        overview(5, 1, "Báo cáo năm 2026 đã nộp UBND (Phiếu 1) và đang chờ duyệt nên chưa sửa được số liệu.",
                List.of(YEAR_SHEET), List.of(Q1_SAVED), List.of());
        AnnualReport active = new AnnualReport(YEAR, 1, 5, "12/TTr-STC", LocalDate.of(2027, 1, 6));
        ReflectionTestUtils.setField(active, "id", 1L);
        active.setStatus(AnnualReportStatus.SUBMITTED);
        when(repository.findByYearAndStatusIn(anyInt(), anyCollection())).thenReturn(List.of(active));
        when(repository.findByYear(anyInt())).thenReturn(List.of(active));

        YearCheck check = service.check(YEAR);

        assertEquals("Báo cáo năm 2026 đã nộp (Phiếu 1 — đang chờ UBND duyệt). Một năm chỉ nộp một phiếu; "
                + "nộp lại được khi UBND trả lại hoặc mở lại phiếu đó.", check.blocker());
        assertNotNull(check.latest());
    }

    @Test
    @DisplayName("Chưa có biểu tổng hợp năm nào được ban hành: chặn nộp")
    void blockedWithoutYearSheets() {
        overview(5, 1, null, List.of(), List.of(Q1_SAVED), List.of());

        assertEquals("Năm 2026 chưa có biểu tổng hợp năm nào được ban hành nên chưa nộp được.",
                service.check(YEAR).blocker());
    }
}
