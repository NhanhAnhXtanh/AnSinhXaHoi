package com.dth.frw.module.asxh.setup.service;

import static com.dth.frw.module.asxh.setup.service.SetupTestData.cell;
import static com.dth.frw.module.asxh.setup.service.SetupTestData.period;
import static com.dth.frw.module.asxh.setup.service.SetupTestData.template;
import static com.dth.frw.module.asxh.setup.service.SetupTestData.unit;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.dept.DeptYearLockState;
import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
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
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Lưu ma trận thiết lập ({@code PUT /api/period_assignments/matrix}) và áp dụng sang kỳ khác —
 * hai luật máy chủ phải tự giữ, không trông vào màn hình:
 * <ul>
 *   <li>Khoá NĂM (năm đã nộp UBND) chặn cả gỡ ô; khoá vì trùng kỳ thì vẫn cho gỡ (UC-31 1a).</li>
 *   <li>Biểu tổng hợp không giao cho đơn vị nhập (BR-22.1).</li>
 * </ul>
 */
class PeriodAssignmentMatrixTest {

    private final ReportPeriod thang11 =
            period(11, "Tháng 11/2026", PeriodKind.THANG, "2026-11-01", "2026-11-30", PeriodStatus.READY);
    private final ReportPeriod thang12 =
            period(12, "Tháng 12/2026", PeriodKind.THANG, "2026-12-01", "2026-12-31", PeriodStatus.DRAFT);
    private final ReportPeriod quy4 = period(13, "Quý IV/2026", PeriodKind.QUY, "2026-10-01", "2026-12-31", PeriodStatus.OPEN);

    private final ReportUnit bienHoa = unit(1, "UBND TP. Biên Hoà");
    private final Template bieu1a = template(1, "1a");
    private final Template tongHop = summaryTemplate(9, "THNAM");

    private PeriodAssignmentRepository repository;
    private PublicationRepository publications;
    private DeptYearLockService yearLock;
    private ReportPeriodService periodService;
    private ReportUnitService unitService;
    private TemplateService templateService;
    private PeriodAssignmentService service;

    @BeforeEach
    void setUp() {
        repository = mock(PeriodAssignmentRepository.class);
        publications = mock(PublicationRepository.class);
        yearLock = mock(DeptYearLockService.class);
        periodService = mock(ReportPeriodService.class);
        unitService = mock(ReportUnitService.class);
        templateService = mock(TemplateService.class);
        TemplateVersionService versions = mock(TemplateVersionService.class);

        for (ReportPeriod p : List.of(thang11, thang12, quy4)) {
            when(periodService.get(p.getId())).thenReturn(p);
            when(repository.findByPeriodId(p.getId())).thenReturn(List.of());
        }
        when(yearLock.state(anyInt())).thenReturn(DeptYearLockState.OPEN);
        when(publications.findOpenedPeriodsOverlapping(eq(PublicationStatus.PUBLISHED), anyCollection(), any(), any()))
                .thenReturn(List.of());
        when(unitService.get(bienHoa.getId())).thenReturn(bienHoa);
        when(templateService.get(bieu1a.getId())).thenReturn(bieu1a);
        when(templateService.get(tongHop.getId())).thenReturn(tongHop);
        when(versions.findEffective(anyLong(), any())).thenReturn(Optional.of(mock(TemplateVersion.class)));

        service = new PeriodAssignmentService(
                repository,
                new PeriodSetupLockService(publications, yearLock),
                mock(PublicationService.class),
                mock(InputReportService.class),
                periodService,
                unitService,
                templateService,
                versions,
                mock(RowLevelSecurity.class));
    }

    private static Template summaryTemplate(long id, String shortName) {
        Template template = new Template(null, "BM-" + id, shortName, "Biểu " + shortName, TemplateKind.TONG_HOP, (int) id);
        ReflectionTestUtils.setField(template, "id", id);
        return template;
    }

    @Test
    @DisplayName("Năm đã nộp UBND: gỡ ô cũng bị từ chối, không xoá gì, kỳ giữ nguyên trạng thái")
    void yearLockRefusesRemoval() {
        when(yearLock.state(2026)).thenReturn(DeptYearLockState.SUBMITTED);
        when(repository.findByPeriodId(thang11.getId())).thenReturn(List.of(cell(100, thang11, bienHoa, bieu1a)));

        ConflictException error = assertThrows(ConflictException.class, () -> service.applyMatrix(
                thang11.getId(), List.of(), List.of(new PeriodAssignmentService.Cell(bienHoa.getId(), bieu1a.getId()))));

        assertEquals("Năm 2026 đã nộp UBND nên không sửa được số liệu các kỳ trong năm.", error.getMessage());
        verify(repository, never()).remove(any());
        verify(periodService, never()).transition(anyLong(), any());
    }

    @Test
    @DisplayName("Kỳ bị khoá vì trùng kỳ đã mở đợt: vẫn gỡ được thiết lập thừa")
    void overlapLockStillAllowsRemoval() {
        when(publications.findOpenedPeriodsOverlapping(eq(PublicationStatus.PUBLISHED), anyCollection(), any(), any()))
                .thenReturn(List.of(quy4));
        when(repository.findByPeriodId(thang11.getId())).thenReturn(List.of(cell(100, thang11, bienHoa, bieu1a)));
        when(periodService.transition(thang11.getId(), PeriodStatus.DRAFT)).thenReturn(thang11);

        PeriodAssignmentService.MatrixResult result = service.applyMatrix(
                thang11.getId(), List.of(), List.of(new PeriodAssignmentService.Cell(bienHoa.getId(), bieu1a.getId())));

        assertEquals(1, result.removed());
        verify(repository, times(1)).remove(any());
    }

    @Test
    @DisplayName("Gán biểu tổng hợp cho đơn vị qua API: từ chối, không ghi ô nào")
    void refusesSummaryTemplate() {
        ConflictException error = assertThrows(ConflictException.class, () -> service.applyMatrix(
                thang12.getId(),
                List.of(new PeriodAssignmentService.Cell(bienHoa.getId(), bieu1a.getId()),
                        new PeriodAssignmentService.Cell(bienHoa.getId(), tongHop.getId())),
                List.of()));

        assertEquals("Biểu THNAM là biểu tổng hợp, không giao cho đơn vị nhập được.", error.getMessage());
        verify(repository, never()).persist(any());
    }

    @Test
    @DisplayName("Áp dụng sang kỳ khác bỏ qua ô biểu tổng hợp lỡ có ở kỳ nguồn")
    void copySkipsSummaryTemplate() {
        when(repository.findByPeriodId(thang11.getId())).thenReturn(List.of(
                cell(100, thang11, bienHoa, bieu1a),
                cell(101, thang11, bienHoa, tongHop)));

        PeriodAssignmentService.CopyResult result = service.copy(thang11.getId(), List.of(thang12.getId()));

        assertEquals(1, result.added());
        assertEquals(1, result.skipped());
        verify(repository, times(1)).persist(any());
    }
}
