package com.dth.frw.module.asxh.annual;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.annual.AnnualReport;
import com.dth.frw.domain.asxh.annual.AnnualReportSheet;
import com.dth.frw.domain.asxh.annual.AnnualReportStatus;
import com.dth.frw.domain.asxh.dept.DeptChangeAction;
import com.dth.frw.domain.asxh.dept.DeptYearLockState;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.annual.repo.AnnualReportAttachmentRepository;
import com.dth.frw.module.asxh.annual.repo.AnnualReportRepository;
import com.dth.frw.module.asxh.annual.repo.AnnualReportSheetRepository;
import com.dth.frw.module.asxh.annual.service.AnnualReportService;
import com.dth.frw.module.asxh.annual.service.AnnualReportService.YearCheck;
import com.dth.frw.module.asxh.annual.service.AnnualReportWorkflowService;
import com.dth.frw.module.asxh.attachment.service.AttachmentStorage;
import com.dth.frw.module.asxh.dept.service.DeptLedgerVersionService;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.SheetOption;
import com.dth.frw.module.asxh.template.service.TemplateService;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import com.dth.frw.shared.exception.ConflictException;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Luồng báo cáo năm (UC-59, UC-63..66): nộp → UBND duyệt → mở lại → gửi lại → trả lại, và các
 * điều kiện chặn — trên bộ nhớ, không cần cơ sở dữ liệu.
 *
 * <p>Kho phiếu năm giả lập bằng một {@code Map}; phần kiểm trước khi nộp
 * ({@link AnnualReportService#check}) giả lập riêng — luật của nó kiểm ở {@code AnnualSubmitCheckTest}.
 * Điều được kiểm ở đây: trạng thái phiếu, số "Phiếu n", phiên bản số liệu được ghim, và khoá / mở khoá
 * năm + mốc lịch sử đi đúng cùng từng bước.
 */
class AnnualReportWorkflowTest {

    private static final int YEAR = 2026;
    private static final LocalDate DOC_DATE = LocalDate.of(2027, 1, 6);

    private final Map<Long, AnnualReport> store = new HashMap<>();
    private final AtomicLong ids = new AtomicLong();

    private AnnualReportRepository repository;
    private AnnualReportSheetRepository sheetRepository;
    private AnnualReportService reportService;
    private DeptLedgerVersionService versionService;
    private DeptYearLockService yearLockService;
    private AnnualReportWorkflowService workflow;

    @BeforeEach
    void setUp() {
        repository = mock(AnnualReportRepository.class);
        sheetRepository = mock(AnnualReportSheetRepository.class);
        reportService = mock(AnnualReportService.class);
        versionService = mock(DeptLedgerVersionService.class);
        yearLockService = mock(DeptYearLockService.class);
        TemplateService templateService = mock(TemplateService.class);
        TemplateVersionService templateVersionService = mock(TemplateVersionService.class);

        when(repository.saveAndFlush(any(AnnualReport.class))).thenAnswer(call -> persist(call.getArgument(0)));
        when(repository.save(any(AnnualReport.class))).thenAnswer(call -> persist(call.getArgument(0)));
        when(repository.findForUpdate(any())).thenAnswer(call -> Optional.ofNullable(store.get(call.<Long>getArgument(0))));
        when(repository.maxRevision(anyInt())).thenAnswer(call -> store.values().stream()
                .filter(report -> report.getReportYear() == call.<Integer>getArgument(0))
                .mapToInt(AnnualReport::getRevisionNo).max().orElse(0));
        when(sheetRepository.save(any(AnnualReportSheet.class))).thenAnswer(call -> call.getArgument(0));
        when(templateService.get(any())).thenReturn(mock(Template.class));
        when(templateVersionService.get(any())).thenReturn(mock(TemplateVersion.class));

        workflow = new AnnualReportWorkflowService(repository, sheetRepository,
                mock(AnnualReportAttachmentRepository.class), reportService, versionService, yearLockService,
                templateService, templateVersionService, mock(AttachmentStorage.class));
    }

    private AnnualReport persist(AnnualReport report) {
        if (report.getId() == null) {
            ReflectionTestUtils.setField(report, "id", ids.incrementAndGet());
        }
        store.put(report.getId(), report);
        return report;
    }

    /** Năm nộp được: phiên bản số liệu {@code version}, hai biểu tổng hợp năm. */
    private void readyToSubmit(int version) {
        List<SheetOption> sheets = List.of(
                new SheetOption(31L, "BT-01", "01", "Biểu tổng hợp năm", 310L, 1, LocalDate.of(2026, 1, 1), false),
                new SheetOption(32L, "BT-02", "02", "Phụ lục", 320L, 2, LocalDate.of(2026, 1, 1), false));
        when(reportService.check(YEAR)).thenReturn(new YearCheck(YEAR, version, 4, 4, null, null,
                List.of(), List.of(), sheets, null));
    }

    @Test
    @DisplayName("Nộp → duyệt → mở lại → gửi lại → trả lại: đúng trạng thái, số phiếu, phiên bản ghim, khoá năm")
    void fullCycle() {
        // Nộp lần đầu: Phiếu 1 ghim phiên bản 5, khoá năm ở mức chờ duyệt.
        readyToSubmit(5);
        AnnualReport first = workflow.submit(YEAR, " 12/TTr-STC ", DOC_DATE, List.of());
        assertEquals(AnnualReportStatus.SUBMITTED, first.getStatus());
        assertEquals(1, first.getRevisionNo());
        assertEquals(5, first.getLedgerVersion());
        assertEquals("12/TTr-STC", first.getDocNo());
        verify(sheetRepository, org.mockito.Mockito.times(2)).save(any(AnnualReportSheet.class));
        verify(yearLockService).lock(eq(YEAR), eq(DeptYearLockState.SUBMITTED), anyString());
        verify(yearLockService).recordYearEvent(eq(YEAR), eq(first.getId()), eq(DeptChangeAction.YEAR_SUBMITTED),
                eq(5), anyString());

        // Khoá dòng của năm TRƯỚC khi đọc phiên bản để ghim.
        InOrder order = inOrder(versionService, reportService);
        order.verify(versionService).lockYear(YEAR);
        order.verify(reportService).check(YEAR);

        // UBND duyệt: khoá năm ở mức đã duyệt.
        AnnualReport approved = workflow.approve(first.getId());
        assertEquals(AnnualReportStatus.APPROVED, approved.getStatus());
        assertTrue(approved.getDecidedAt() != null);
        verify(yearLockService).lock(eq(YEAR), eq(DeptYearLockState.APPROVED), anyString());
        verify(yearLockService).recordYearEvent(eq(YEAR), eq(first.getId()), eq(DeptChangeAction.YEAR_APPROVED),
                eq(5), anyString());

        // Duyệt lần nữa: không còn chờ duyệt.
        assertThrows(ConflictException.class, () -> workflow.approve(first.getId()));

        // Mở lại phiếu đã duyệt: thành trả lại, đánh dấu mở lại, năm mở khoá.
        AnnualReport reopened = workflow.reopen(first.getId(), "Sai số biểu 1b của Quý II/2026");
        assertEquals(AnnualReportStatus.RETURNED, reopened.getStatus());
        assertTrue(reopened.isReopened());
        assertEquals("Sai số biểu 1b của Quý II/2026", reopened.getReturnReason());
        verify(yearLockService).unlock(eq(YEAR), isNull());
        verify(yearLockService).recordYearEvent(eq(YEAR), eq(first.getId()), eq(DeptChangeAction.YEAR_REOPENED),
                eq(5), anyString());

        // Gửi lại: Phiếu 2, ghim phiên bản mới (Sở đã sửa số → 7); phiếu 1 giữ nguyên số đã ghim.
        readyToSubmit(7);
        AnnualReport second = workflow.submit(YEAR, "15/TTr-STC", DOC_DATE.plusDays(9), List.of());
        assertEquals(2, second.getRevisionNo());
        assertEquals(7, second.getLedgerVersion());
        assertEquals(AnnualReportStatus.SUBMITTED, second.getStatus());
        assertEquals(5, store.get(first.getId()).getLedgerVersion());

        // UBND trả lại Phiếu 2 kèm lý do: phiếu dừng, năm mở khoá.
        AnnualReport returned = workflow.returnReport(second.getId(), "  Thiếu số liệu biểu 1c  ");
        assertEquals(AnnualReportStatus.RETURNED, returned.getStatus());
        assertFalse(returned.isReopened());
        assertEquals("Thiếu số liệu biểu 1c", returned.getReturnReason());
        verify(yearLockService).recordYearEvent(eq(YEAR), eq(second.getId()), eq(DeptChangeAction.YEAR_RETURNED),
                eq(7), anyString());

        // Phiếu đã trả lại không trả lại / mở lại được nữa.
        assertThrows(ConflictException.class, () -> workflow.returnReport(second.getId(), "Lần nữa"));
        assertThrows(ConflictException.class, () -> workflow.reopen(second.getId(), "Lần nữa"));
    }

    @Test
    @DisplayName("Còn biểu đang sửa dở: không nộp được, không tạo phiếu, không khoá năm")
    void blockedWhenSheetsUnfinished() {
        String blocker = "Còn biểu 1a của Quý I/2026 đang sửa dở. Hoàn tất các biểu này ở Theo kỳ rồi nộp báo cáo năm.";
        when(reportService.check(YEAR)).thenReturn(new YearCheck(YEAR, 5, 4, 4, null, blocker,
                List.of(), List.of("biểu 1a của Quý I/2026"), List.of(), null));

        ConflictException error = assertThrows(ConflictException.class,
                () -> workflow.submit(YEAR, "12/TTr-STC", DOC_DATE, List.of()));

        assertEquals(blocker, error.getMessage());
        verify(repository, never()).saveAndFlush(any(AnnualReport.class));
        verify(yearLockService, never()).lock(anyInt(), any(), any());
        verify(yearLockService, never()).recordYearEvent(anyInt(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Thiếu số / ngày văn bản, quá 10 file: báo lỗi trước khi đụng tới số liệu")
    void validatesInputFirst() {
        readyToSubmit(5);
        assertThrows(IllegalArgumentException.class, () -> workflow.submit(YEAR, "  ", DOC_DATE, List.of()));
        assertThrows(IllegalArgumentException.class, () -> workflow.submit(YEAR, "12/TTr-STC", null, List.of()));
        assertThrows(IllegalArgumentException.class,
                () -> workflow.submit(YEAR, "x".repeat(AnnualReport.DOC_NO_MAX_LENGTH + 1), DOC_DATE, List.of()));
        List<AnnualReportWorkflowService.SubmitFile> tooMany = java.util.stream.IntStream.range(0, 11)
                .mapToObj(i -> new AnnualReportWorkflowService.SubmitFile("f" + i + ".pdf", new byte[] {0x25, 0x50, 0x44, 0x46}))
                .toList();
        assertThrows(IllegalArgumentException.class, () -> workflow.submit(YEAR, "12/TTr-STC", DOC_DATE, tooMany));
        verify(versionService, never()).lockYear(anyInt());
    }

    @Test
    @DisplayName("Trả lại / mở lại phải có lý do")
    void reasonRequired() {
        readyToSubmit(5);
        AnnualReport report = workflow.submit(YEAR, "12/TTr-STC", DOC_DATE, List.of());

        assertThrows(IllegalArgumentException.class, () -> workflow.returnReport(report.getId(), "   "));
        assertThrows(IllegalArgumentException.class, () -> workflow.returnReport(report.getId(), null));
        assertEquals(AnnualReportStatus.SUBMITTED, store.get(report.getId()).getStatus());
        assertNull(store.get(report.getId()).getReturnReason());

        // Mở lại chỉ dành cho phiếu đã duyệt.
        assertThrows(ConflictException.class, () -> workflow.reopen(report.getId(), "Sai số"));
    }
}
