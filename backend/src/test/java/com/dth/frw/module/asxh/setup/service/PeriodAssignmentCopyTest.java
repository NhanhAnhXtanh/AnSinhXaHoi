package com.dth.frw.module.asxh.setup.service;

import static com.dth.frw.module.asxh.setup.service.SetupTestData.cell;
import static com.dth.frw.module.asxh.setup.service.SetupTestData.period;
import static com.dth.frw.module.asxh.setup.service.SetupTestData.template;
import static com.dth.frw.module.asxh.setup.service.SetupTestData.unit;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.PeriodAssignment;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.module.asxh.setup.repo.PeriodAssignmentRepository;
import com.dth.frw.module.asxh.setup.repo.PublicationRepository;
import com.dth.frw.module.asxh.template.service.TemplateService;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import com.dth.frw.module.asxh.unit.service.ReportUnitService;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * "Áp dụng thiết lập cho kỳ khác" (UC-23, {@code POST /api/period_assignments/copy}) theo luật
 * khoá CẢ KỲ: kỳ đích trùng thời gian với kỳ nguồn CHƯA mở đợt vẫn nhận được thiết lập (không
 * còn khoá theo đơn vị); kỳ đích trùng một kỳ ĐÃ mở đợt thì bị từ chối cả lượt.
 *
 * <p>Khoá kỳ chạy bằng {@link PeriodSetupLockService} thật trên kho đợt phát hành giả lập, để
 * test bắt được cả đường nối giữa hai service.
 */
class PeriodAssignmentCopyTest {

    private final ReportPeriod quy4 = period(10, "Quý IV/2026", PeriodKind.QUY, "2026-10-01", "2026-12-31", PeriodStatus.READY);
    private final ReportPeriod thang11 =
            period(11, "Tháng 11/2026", PeriodKind.THANG, "2026-11-01", "2026-11-30", PeriodStatus.DRAFT);
    private final ReportPeriod thang12 =
            period(12, "Tháng 12/2026", PeriodKind.THANG, "2026-12-01", "2026-12-31", PeriodStatus.DRAFT);
    private final ReportPeriod quy3 = period(13, "Quý III/2026", PeriodKind.QUY, "2026-07-01", "2026-09-30", PeriodStatus.OPEN);
    private final ReportPeriod thang8 = period(14, "Tháng 8/2026", PeriodKind.THANG, "2026-08-01", "2026-08-31", PeriodStatus.DRAFT);

    private final ReportUnit bienHoa = unit(1, "UBND TP. Biên Hoà");
    private final ReportUnit longKhanh = unit(2, "UBND TP. Long Khánh");
    private final Template bieu1a = template(1, "1a");
    private final Template bieu1b = template(2, "1b");

    private PeriodAssignmentRepository repository;
    private PublicationRepository publications;
    private ReportPeriodService periodService;
    private TemplateVersionService versions;
    private PeriodAssignmentService service;

    @BeforeEach
    void setUp() {
        repository = mock(PeriodAssignmentRepository.class);
        publications = mock(PublicationRepository.class);
        periodService = mock(ReportPeriodService.class);
        versions = mock(TemplateVersionService.class);

        for (ReportPeriod p : List.of(quy4, thang11, thang12, quy3, thang8)) {
            when(periodService.get(p.getId())).thenReturn(p);
            when(repository.findByPeriodId(p.getId())).thenReturn(List.of());
        }
        when(versions.findEffective(anyLong(), any())).thenReturn(Optional.of(mock(TemplateVersion.class)));
        // Mặc định chưa kỳ nào mở đợt.
        when(publications.findOpenedPeriodsOverlapping(eq(PublicationStatus.PUBLISHED), anyCollection(), any(), any()))
                .thenReturn(List.of());

        service = new PeriodAssignmentService(
                repository,
                new PeriodSetupLockService(publications),
                mock(PublicationService.class),
                mock(InputReportService.class),
                periodService,
                mock(ReportUnitService.class),
                mock(TemplateService.class),
                versions,
                mock(RowLevelSecurity.class));
    }

    @Test
    @DisplayName("Chỉ cộng thêm; kỳ đích trùng thời gian với kỳ nguồn chưa mở đợt vẫn áp dụng được")
    void copiesAdditivelyIntoOverlappingTargets() {
        when(repository.findByPeriodId(quy4.getId())).thenReturn(List.of(
                cell(100, quy4, bienHoa, bieu1a),
                cell(101, quy4, bienHoa, bieu1b),
                cell(102, quy4, longKhanh, bieu1a)));
        // Tháng 11 đã có sẵn một ô trùng với kỳ nguồn — giữ nguyên, không ghi lại.
        when(repository.findByPeriodId(thang11.getId())).thenReturn(List.of(cell(200, thang11, bienHoa, bieu1a)));
        // Sau khi ghi, cả hai kỳ đích đều có ô dùng được.
        when(repository.countUsableByPeriodId(anyLong())).thenReturn(3L);

        PeriodAssignmentService.CopyResult result = service.copy(quy4.getId(), List.of(thang11.getId(), thang12.getId()));

        assertEquals(5, result.added());
        assertEquals(1, result.unchanged());
        assertEquals(0, result.skipped());
        assertEquals("Đã áp dụng 5 ô cho 2 kỳ.", result.message());

        ArgumentCaptor<PeriodAssignment> written = ArgumentCaptor.forClass(PeriodAssignment.class);
        verify(repository, times(5)).persist(written.capture());
        assertTrue(written.getAllValues().stream()
                .noneMatch(a -> a.getPeriod() == thang11 && a.getUnit() == bienHoa && a.getTemplate() == bieu1a));
        verify(repository, never()).remove(any());
        verify(periodService).transition(thang11.getId(), PeriodStatus.READY);
        verify(periodService).transition(thang12.getId(), PeriodStatus.READY);
    }

    @Test
    @DisplayName("Kỳ đích trùng một kỳ đã mở đợt: từ chối cả lượt với lý do khoá cả kỳ, không ghi gì")
    void refusesLockedTarget() {
        when(repository.findByPeriodId(quy4.getId())).thenReturn(List.of(cell(100, quy4, bienHoa, bieu1a)));
        when(publications.findOpenedPeriodsOverlapping(eq(PublicationStatus.PUBLISHED), anyCollection(), any(), any()))
                .thenReturn(List.of(quy3));

        ConflictException error = assertThrows(ConflictException.class,
                () -> service.copy(quy4.getId(), List.of(thang12.getId(), thang8.getId())));

        assertEquals("Chưa áp dụng được. Kỳ Tháng 8/2026 trùng thời gian với Quý III/2026 đã mở đợt nên "
                + "không thiết lập được. Hãy thiết lập ở Quý III/2026.", error.getMessage());
        verify(repository, never()).persist(any());
        verify(periodService, never()).transition(anyLong(), any());
    }

    @Test
    @DisplayName("Kỳ đích đã mở đợt / quá hạn thì không áp dụng được")
    void refusesTargetPastSetup() {
        when(repository.findByPeriodId(quy4.getId())).thenReturn(List.of(cell(100, quy4, bienHoa, bieu1a)));

        ConflictException error = assertThrows(ConflictException.class,
                () -> service.copy(quy4.getId(), List.of(quy3.getId())));

        assertTrue(error.getMessage().startsWith("Chỉ áp dụng được cho kỳ chưa mở đợt; kỳ Quý III/2026"));
        verify(repository, never()).persist(any());
    }

    @Test
    @DisplayName("Bỏ qua ô có đơn vị ngừng nhận báo cáo hoặc biểu không còn phiên bản ban hành")
    void skipsUnusableCells() {
        longKhanh.setReceivesReports(false);
        when(versions.findEffective(eq(bieu1b.getId()), any())).thenReturn(Optional.empty());
        when(repository.findByPeriodId(quy4.getId())).thenReturn(List.of(
                cell(100, quy4, bienHoa, bieu1a),
                cell(101, quy4, bienHoa, bieu1b),
                cell(102, quy4, longKhanh, bieu1a)));

        PeriodAssignmentService.CopyResult result = service.copy(quy4.getId(), List.of(thang12.getId()));

        assertEquals(1, result.added());
        assertEquals(2, result.skipped());
        verify(repository, times(1)).persist(any());
    }

    @Test
    @DisplayName("Kỳ nguồn chưa có thiết lập, hoặc không chọn kỳ đích nào: báo lỗi")
    void refusesEmptySourceOrTargets() {
        assertThrows(ConflictException.class, () -> service.copy(quy4.getId(), List.of(thang12.getId())));
        assertThrows(ConflictException.class, () -> service.copy(quy4.getId(), List.of(quy4.getId())));
        verify(repository, never()).persist(any());
    }
}
