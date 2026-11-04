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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.module.asxh.setup.repo.PeriodAssignmentRepository;
import com.dth.frw.module.asxh.setup.repo.PublicationRepository;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * Mở đợt không phát phiếu cho biểu đang khoá (để sửa): ô của biểu đó bị bỏ qua, không chọn
 * phiên bản nào của nó; các biểu còn lại phát bình thường.
 */
class PublicationLockedFormTest {

    private final ReportPeriod quy1 = period(21, "Quý I/2024", PeriodKind.QUY, "2024-01-01", "2024-03-31", PeriodStatus.READY);
    private final ReportUnit bienHoa = unit(1, "UBND phường Biên Hoà");
    private final Template bieu1c = template(3, "1c");
    private final Template bieuTest = template(7, "test");

    private PeriodAssignmentRepository assignments;
    private InputReportService inputReports;
    private TemplateVersionService versions;
    private PublicationService service;

    @BeforeEach
    void setUp() {
        bieuTest.lockForm("admin", Instant.now());

        assignments = mock(PeriodAssignmentRepository.class);
        PublicationRepository publications = mock(PublicationRepository.class);
        when(publications.findOpenedPeriodsOverlapping(eq(PublicationStatus.PUBLISHED), anyCollection(), any(), any()))
                .thenReturn(List.of());
        when(publications.persist(any(Publication.class))).thenAnswer(call -> call.getArgument(0));
        inputReports = mock(InputReportService.class);
        when(inputReports.issue(any(), any())).thenReturn(new InputReportService.IssueResult(1, 1, 1, 0));
        versions = mock(TemplateVersionService.class);
        when(versions.findEffective(anyLong(), any())).thenReturn(Optional.of(mock(TemplateVersion.class)));

        service = new PublicationService(
                publications,
                assignments,
                new PeriodSetupLockService(publications),
                inputReports,
                mock(ReportPeriodService.class),
                versions,
                mock(RowLevelSecurity.class));
    }

    @Test
    @DisplayName("Kỳ có cả biểu thường và biểu đang khoá: chỉ phát phiếu biểu thường")
    @SuppressWarnings("unchecked")
    void skipsLockedForm() {
        when(assignments.findByPeriodId(quy1.getId())).thenReturn(List.of(
                cell(100, quy1, bienHoa, bieu1c),
                cell(101, quy1, bienHoa, bieuTest)));

        service.publishInitial(quy1);

        ArgumentCaptor<List<InputReportService.IssueRequest>> requests = ArgumentCaptor.forClass(List.class);
        verify(inputReports).issue(any(), requests.capture());
        assertEquals(1, requests.getValue().size());
        assertEquals("1c", requests.getValue().get(0).template().getShortName());
        verify(versions, never()).findEffective(eq(bieuTest.getId()), any());
    }

    @Test
    @DisplayName("Mọi biểu đã gán đều đang khoá: không mở đợt, không phát phiếu nào")
    void refusesWhenOnlyLockedForms() {
        when(assignments.findByPeriodId(quy1.getId())).thenReturn(List.of(cell(101, quy1, bienHoa, bieuTest)));

        ConflictException error = assertThrows(ConflictException.class, () -> service.publishInitial(quy1));

        assertTrue(error.getMessage().contains("đang khoá"), error.getMessage());
        verify(inputReports, never()).issue(any(), any());
    }
}
