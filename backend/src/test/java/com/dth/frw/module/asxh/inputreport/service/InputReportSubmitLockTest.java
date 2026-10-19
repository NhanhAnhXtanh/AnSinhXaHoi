package com.dth.frw.module.asxh.inputreport.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.attachment.InputReportAttachment;
import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.module.asxh.attachment.repo.InputReportAttachmentRepository;
import com.dth.frw.module.asxh.attachment.repo.TreasuryConfirmationRepository;
import com.dth.frw.module.asxh.attachment.service.AttachmentStorage;
import com.dth.frw.module.asxh.attachment.service.InputReportAttachmentService;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.module.asxh.inputreport.repo.InputReportRepository;
import com.dth.frw.module.asxh.inputreport.repo.InputReportSheetRepository;
import com.dth.frw.module.asxh.ledger.service.InputReportWorkflowHooks;
import com.dth.frw.module.asxh.ledger.service.ReportSubmitValidationService;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.InOrder;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Nộp phiếu chen với lưu / đánh dấu biểu và đính kèm (UC-34..38): trước đây nộp đọc phiếu KHÔNG khoá,
 * lưu biểu kiểm trạng thái phiếu trên bản đọc thường, file đính kèm kiểm trên bản phiếu nạp ở giao
 * dịch trước — nên bấm Nộp hai lần, hoặc lưu biểu / tải file ngay lúc phiếu đang được nộp, đều lọt:
 * phiếu nộp hai lần, số liệu / giấy tờ đổi sau khi đã nộp.
 *
 * <p>Giờ mọi đường giữ CÙNG khoá dòng phiếu (như duyệt) rồi mới đọc trạng thái. Mô phỏng "phiên khác
 * vừa nộp xong" bằng câu khoá trả phiếu đã ở {@code SUBMITTED}: thao tác phải bị từ chối và không ghi
 * gì. Thứ tự "khoá trước, kiểm phạm vi sau" cũng được giữ — làm ngược lại thì Hibernate trả bản đã nạp
 * (trạng thái cũ) dù câu khoá đọc được dòng mới.
 */
class InputReportSubmitLockTest {

    private static final ReportCalendar CALENDAR = new ReportCalendar(2026, 15, List.of(PeriodKind.QUY));

    private InputReportRepository reportRepository;
    private InputReportSheetRepository sheetRepository;
    private InputReportWorkflowHooks hooks;
    private DeptYearLockService yearLockService;

    @BeforeEach
    void setUp() {
        reportRepository = mock(InputReportRepository.class);
        sheetRepository = mock(InputReportSheetRepository.class);
        hooks = mock(InputReportWorkflowHooks.class);
        yearLockService = mock(DeptYearLockService.class);
    }

    private static InputReport report(long id, ReportStatus status) {
        ReportPeriod period = new ReportPeriod(CALENDAR, PeriodKind.QUY, 1, "Q1-2026", "Quý I/2026",
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31), LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31));
        period.setStatus(PeriodStatus.OPEN);
        InputReport report = new InputReport(null, period, null);
        ReflectionTestUtils.setField(report, "id", id);
        report.setStatus(status);
        return report;
    }

    // JpaSpecificationExecutor có hai bản findOne (Specification / PredicateSpecification): ghi rõ kiểu.
    private static Specification<InputReport> reportSpec() {
        return ArgumentMatchers.any();
    }

    private static Specification<InputReportSheet> sheetSpec() {
        return ArgumentMatchers.any();
    }

    private InputReportService reports() {
        return new InputReportService(reportRepository, sheetRepository, mock(RowLevelSecurity.class), hooks,
                yearLockService);
    }

    @Test
    @DisplayName("Nộp: khoá dòng phiếu trước rồi mới kiểm phạm vi và trạng thái; phiếu vừa nộp ở phiên khác → 409")
    void submitLocksBeforeCheckingStatus() {
        InputReport alreadySubmitted = report(7L, ReportStatus.SUBMITTED);
        when(reportRepository.findForUpdate(7L)).thenReturn(Optional.of(alreadySubmitted));
        when(reportRepository.findOne(reportSpec())).thenReturn(Optional.of(alreadySubmitted));

        ConflictException error = assertThrows(ConflictException.class, () -> reports().submit(7L));

        assertEquals("Phiếu đã nộp hoặc đã chốt nên không nộp lại được.", error.getMessage());
        InOrder order = inOrder(reportRepository);
        order.verify(reportRepository).findForUpdate(7L);
        order.verify(reportRepository).findOne(reportSpec());
        verify(hooks, never()).beforeSubmit(any(), any());
        verify(reportRepository, never()).persist(any());
    }

    @Test
    @DisplayName("Nộp phiếu ngoài phạm vi vẫn là 404 dù đã khoá được dòng")
    void submitOutOfScopeIsNotFound() {
        when(reportRepository.findForUpdate(8L)).thenReturn(Optional.of(report(8L, ReportStatus.DRAFT)));
        when(reportRepository.findOne(reportSpec())).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> reports().submit(8L));
        verify(reportRepository, never()).persist(any());
    }

    @Test
    @DisplayName("Lưu / đánh dấu / sửa lại biểu: khoá phiếu trước khi nạp tờ biểu; phiếu vừa nộp → 409, không ghi")
    void sheetWritesLockReportFirst() {
        InputReport submitted = report(9L, ReportStatus.SUBMITTED);
        InputReportSheet sheet = new InputReportSheet(submitted, mock(Template.class), null);
        ReflectionTestUtils.setField(sheet, "id", 90L);
        sheet.setCompletion(SheetCompletion.COMPLETED);
        when(sheetRepository.lockReportOfSheet(90L)).thenReturn(Optional.of(submitted));
        when(sheetRepository.findOne(sheetSpec())).thenReturn(Optional.of(sheet));

        InputReportSheetService sheets = new InputReportSheetService(sheetRepository, mock(RowLevelSecurity.class),
                mock(ReportSubmitValidationService.class), yearLockService);

        ConflictException save = assertThrows(ConflictException.class,
                () -> sheets.saveData(90L, "{\"sheets\":{}}", null));
        assertEquals("Phiếu đã nộp hoặc đã chốt nên không lưu số liệu được nữa.", save.getMessage());
        assertThrows(ConflictException.class, () -> sheets.reopen(90L));
        assertThrows(ConflictException.class, () -> sheets.markNoData(90L));

        InOrder order = inOrder(sheetRepository);
        order.verify(sheetRepository).lockReportOfSheet(90L);
        order.verify(sheetRepository).findOne(sheetSpec());
        verify(sheetRepository, never()).persist(any());
    }

    @Test
    @DisplayName("Tờ biểu không tồn tại / ngoài phạm vi: 404")
    void sheetMissingIsNotFound() {
        when(sheetRepository.lockReportOfSheet(91L)).thenReturn(Optional.empty());
        InputReportSheetService sheets = new InputReportSheetService(sheetRepository, mock(RowLevelSecurity.class),
                mock(ReportSubmitValidationService.class), yearLockService);

        assertThrows(ResourceNotFoundException.class, () -> sheets.saveData(91L, "{}", null));
    }

    @Test
    @DisplayName("Đính kèm / ô tích Kho bạc: kiểm trên bản phiếu đã khoá, không trên bản controller nạp trước")
    void attachmentsCheckLockedReport() {
        // Controller nạp phiếu khi còn đang nhập; trong lúc đó tab khác đã nộp xong.
        InputReport stale = report(11L, ReportStatus.DRAFT);
        InputReport fresh = report(11L, ReportStatus.SUBMITTED);
        InputReportAttachmentRepository attachmentRepository = mock(InputReportAttachmentRepository.class);
        TreasuryConfirmationRepository confirmationRepository = mock(TreasuryConfirmationRepository.class);
        AttachmentStorage storage = mock(AttachmentStorage.class);
        when(attachmentRepository.lockReport(11L)).thenReturn(Optional.of(fresh));

        InputReportAttachmentService attachments = new InputReportAttachmentService(attachmentRepository,
                confirmationRepository, storage, true, yearLockService);

        assertThrows(ConflictException.class,
                () -> attachments.upload(stale, "xac-nhan.pdf", "%PDF-1.4 kiểm thử".getBytes()));
        assertThrows(ConflictException.class, () -> attachments.delete(stale, 5L));
        assertThrows(ConflictException.class, () -> attachments.setTreasuryConfirmed(stale, false));

        verify(storage, never()).save(any(), any());
        verify(attachmentRepository, never()).persist(any(InputReportAttachment.class));
        verify(confirmationRepository, never()).persist(any());
        verify(yearLockService, never()).assertOpen(anyInt());
        verify(reportRepository, never()).findForUpdate(anyLong());
    }
}
