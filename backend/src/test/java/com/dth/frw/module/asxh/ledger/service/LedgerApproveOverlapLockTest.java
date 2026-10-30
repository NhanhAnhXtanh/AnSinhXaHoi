package com.dth.frw.module.asxh.ledger.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import com.dth.frw.module.asxh.ledger.repo.LedgerEntryRepository;
import com.dth.frw.module.asxh.script.ServerScriptRunner;
import com.dth.frw.module.asxh.template.service.TemplateScriptService;
import com.dth.frw.shared.exception.ConflictException;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Chống cộng đôi khi duyệt hai phiếu kỳ giao nhau ĐỒNG THỜI (UC-41 3.1): mỗi lượt duyệt khoá dòng
 * phiếu CỦA MÌNH, nên hai phiếu khác nhau (1a tháng 11 và 1a quý IV của cùng đơn vị) không chặn
 * nhau — cả hai cùng đếm "chưa có kỳ giao nhau đã duyệt" và cùng ghi số liệu. Bước đếm giờ chạy dưới
 * khoá theo đơn vị: lượt sau chờ lượt trước commit rồi mới đếm, thấy dòng vừa ghi và bị từ chối.
 */
class LedgerApproveOverlapLockTest {

    private LedgerEntryRepository entryRepository;
    private LedgerWriteService writer;
    private InputReport report;
    private List<InputReportSheet> sheets;

    @BeforeEach
    void setUp() {
        entryRepository = mock(LedgerEntryRepository.class);
        writer = new LedgerWriteService(entryRepository, mock(LedgerReplaceService.class),
                mock(LedgerAuditService.class), mock(ServerScriptRunner.class), mock(TemplateScriptService.class));

        ReportUnit unit = new ReportUnit("X01", "UBND phường Kiểm Thử", null, ReportUnitType.UBND_XA, ReportBlock.XA);
        ReflectionTestUtils.setField(unit, "id", 42L);
        ReportCalendar calendar = new ReportCalendar(2026, 15, List.of(PeriodKind.QUY));
        ReportPeriod quarter = new ReportPeriod(calendar, PeriodKind.QUY, 4, "Q4-2026", "Quý IV/2026",
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 12, 31), LocalDate.of(2026, 10, 1),
                LocalDate.of(2027, 1, 15));
        ReflectionTestUtils.setField(quarter, "id", 4L);
        report = new InputReport(unit, quarter, null);
        ReflectionTestUtils.setField(report, "id", 400L);
        Template template = mock(Template.class);
        when(template.getId()).thenReturn(1L);
        sheets = List.of(new InputReportSheet(report, template, null));
    }

    @Test
    @DisplayName("Đếm kỳ giao nhau đã duyệt SAU khi giữ khoá theo đơn vị")
    void countsUnderUnitLock() {
        when(entryRepository.countOverlappingEffective(anyLong(), anyLong(), anyCollection(), anyLong(), anyInt(),
                any(), any(), any(), any())).thenReturn(0L);

        assertDoesNotThrow(() -> writer.assertNoOverlappingApproved(report, sheets));

        InOrder order = inOrder(entryRepository);
        order.verify(entryRepository).lockUnitForApproval(LedgerWriteService.APPROVAL_LOCK_NAMESPACE, 42L);
        order.verify(entryRepository).countOverlappingEffective(eq(42L), eq(400L), anyCollection(), eq(4L),
                eq(2026), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Lượt chờ khoá thấy kỳ giao nhau vừa được duyệt → 409, không ghi số liệu")
    void overlapCommittedMeanwhileRefused() {
        // Lượt kia đã commit trong lúc lượt này chờ khoá: câu đếm (chạy sau khoá) thấy dòng của nó.
        when(entryRepository.countOverlappingEffective(anyLong(), anyLong(), anyCollection(), anyLong(), anyInt(),
                any(), any(), any(), any())).thenReturn(3L);

        assertThrows(ConflictException.class, () -> writer.assertNoOverlappingApproved(report, sheets));
    }
}
