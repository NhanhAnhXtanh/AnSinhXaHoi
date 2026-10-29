package com.dth.frw.module.asxh.setup.service;

import static com.dth.frw.module.asxh.setup.service.SetupTestData.cell;
import static com.dth.frw.module.asxh.setup.service.SetupTestData.period;
import static com.dth.frw.module.asxh.setup.service.SetupTestData.template;
import static com.dth.frw.module.asxh.setup.service.SetupTestData.unit;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.period.service.ReportPeriodService;
import com.dth.frw.module.asxh.setup.repo.PeriodAssignmentRepository;
import com.dth.frw.module.asxh.setup.repo.PublicationRepository;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.TimeZone;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * Mở đợt ghim phiên bản mẫu theo "hôm nay" của Đồng Nai, không theo múi giờ máy chủ (BR-24.1).
 *
 * <p>Máy chủ đặt UTC−12 (lệch Việt Nam 19 giờ): từ 0h đến 19h giờ Việt Nam, ngày của máy chủ
 * còn là hôm qua — đúng ngày bản mới có hiệu lực, mở đợt sẽ ghim nhầm bản cũ nếu đọc ngày máy.
 */
class PublicationVersionDateTest {

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    private TimeZone originalZone;

    @BeforeEach
    void setUp() {
        originalZone = TimeZone.getDefault();
        TimeZone.setDefault(TimeZone.getTimeZone("Etc/GMT+12"));
    }

    @AfterEach
    void tearDown() {
        TimeZone.setDefault(originalZone);
    }

    @Test
    @DisplayName("Phiên bản mẫu được chọn theo ngày Việt Nam, kể cả khi máy chủ chạy múi giờ khác")
    void resolvesVersionOnVietnamDate() {
        ReportPeriod thang11 = period(11, "Tháng 11/2026", PeriodKind.THANG, "2026-11-01", "2026-11-30", PeriodStatus.READY);
        Template bieu1a = template(1, "1a");

        PeriodAssignmentRepository assignments = mock(PeriodAssignmentRepository.class);
        when(assignments.findByPeriodId(thang11.getId()))
                .thenReturn(List.of(cell(100, thang11, unit(1, "UBND TP. Biên Hoà"), bieu1a)));
        PublicationRepository publications = mock(PublicationRepository.class);
        when(publications.findOpenedPeriodsOverlapping(eq(PublicationStatus.PUBLISHED), anyCollection(), any(), any()))
                .thenReturn(List.of());
        TemplateVersionService versions = mock(TemplateVersionService.class);
        // Không có bản nào: mở đợt dừng ở bước kiểm phiên bản, trước khi ghi gì.
        when(versions.findEffective(anyLong(), any())).thenReturn(Optional.empty());

        PublicationService service = new PublicationService(
                publications,
                assignments,
                new PeriodSetupLockService(publications),
                mock(InputReportService.class),
                mock(ReportPeriodService.class),
                versions,
                mock(RowLevelSecurity.class));

        LocalDate before = LocalDate.now(VIETNAM);
        assertThrows(ConflictException.class, () -> service.publishInitial(thang11));
        LocalDate after = LocalDate.now(VIETNAM);

        ArgumentCaptor<LocalDate> date = ArgumentCaptor.forClass(LocalDate.class);
        verify(versions).findEffective(eq(bieu1a.getId()), date.capture());
        // Chạy đúng lúc nửa đêm Việt Nam thì chấp nhận một trong hai ngày.
        LocalDate used = date.getValue();
        assertTrue(used.equals(before) || used.equals(after),
                "ngày chọn phiên bản " + used + " phải là hôm nay theo giờ Việt Nam (" + before + ")");
    }
}
