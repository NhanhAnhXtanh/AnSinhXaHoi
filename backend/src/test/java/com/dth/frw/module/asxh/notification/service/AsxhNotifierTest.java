package com.dth.frw.module.asxh.notification.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.annual.AnnualReport;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.PublicationKind;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.domain.system.notification.NotificationLevel;
import com.dth.frw.module.asxh.inputreport.repo.InputReportRepository;
import com.dth.frw.module.asxh.setup.service.PublicationItemService;
import com.dth.frw.module.security.user.repo.UserRepository;
import com.dth.frw.module.system.notification.service.NotificationService;
import java.time.LocalDate;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

@DisplayName("Thông báo của luồng báo cáo ASXH")
class AsxhNotifierTest {

    private NotificationService notifications;
    private UserRepository users;
    private PublicationItemService publicationItems;
    private AsxhNotifier notifier;

    @BeforeEach
    void setUp() {
        notifications = mock(NotificationService.class);
        users = mock(UserRepository.class);
        publicationItems = mock(PublicationItemService.class);
        notifier = new AsxhNotifier(notifications, users, publicationItems);
    }

    private static InputReport report(long id, long unitId, String unitName, String periodName) {
        ReportUnit unit = mock(ReportUnit.class);
        when(unit.getId()).thenReturn(unitId);
        when(unit.getName()).thenReturn(unitName);
        ReportPeriod period = mock(ReportPeriod.class);
        when(period.getName()).thenReturn(periodName);
        InputReport report = mock(InputReport.class);
        when(report.getId()).thenReturn(id);
        when(report.getUnit()).thenReturn(unit);
        when(report.getPeriod()).thenReturn(period);
        return report;
    }

    @Test
    @DisplayName("Đơn vị nộp phiếu: mọi cán bộ Sở duyệt phiếu nhận thông báo kèm đường dẫn vào màn duyệt")
    void submittedGoesToReviewers() {
        when(users.findActiveIdsByRoleCode("REPORT_APPROVER")).thenReturn(List.of(10L, 11L));

        notifier.reportSubmitted(report(5, 1, "UBND phường An Lộc", "Quý I/2026"));

        for (long reviewer : new long[] {10L, 11L}) {
            verify(notifications).notify(reviewer, NotificationLevel.INFO, "Có phiếu mới chờ duyệt",
                    "UBND phường An Lộc đã nộp phiếu Quý I/2026.", "/report-review/5");
        }
    }

    @Test
    @DisplayName("Sở duyệt: chỉ tài khoản của đúng đơn vị đó nhận thông báo")
    void approvedGoesToTheUnit() {
        when(users.findActiveIdsByReportUnitId(1L)).thenReturn(List.of(20L));

        notifier.reportApproved(report(5, 1, "UBND phường An Lộc", "Quý I/2026"));

        verify(notifications).notify(20L, NotificationLevel.SUCCESS, "Phiếu đã được duyệt",
                "Phiếu Quý I/2026 của UBND phường An Lộc đã được Sở duyệt.", "/input-reports/5");
        verify(notifications, never()).notify(eq(10L), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Sở trả lại: thông báo ghi lý do và trỏ tới phiên bản phiếu mới")
    void returnedCarriesTheReason() {
        when(users.findActiveIdsByReportUnitId(1L)).thenReturn(List.of(20L));
        InputReport returned = report(9, 1, "UBND phường An Lộc", "Quý I/2026");
        when(returned.getReturnReason()).thenReturn("Thiếu số liệu biểu 1c");

        notifier.reportReturned(returned);

        verify(notifications).notify(20L, NotificationLevel.WARNING, "Phiếu bị trả lại",
                "Sở trả lại phiếu Quý I/2026 của UBND phường An Lộc. Lý do: Thiếu số liệu biểu 1c."
                        + " Bạn sửa rồi nộp lại.",
                "/input-reports/9");
    }

    @Test
    @DisplayName("Một người nhận hỏng không làm mất thông báo của những người còn lại")
    void oneFailureDoesNotStopTheRest() {
        when(users.findActiveIdsByRoleCode("REPORT_APPROVER")).thenReturn(List.of(10L, 11L));
        doThrow(new IllegalStateException("hỏng")).when(notifications)
                .notify(eq(10L), any(), any(), any(), any());

        notifier.reportSubmitted(report(5, 1, "UBND phường An Lộc", "Quý I/2026"));

        verify(notifications).notify(eq(11L), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Mở đợt lần đầu: báo tài khoản của từng đơn vị có biểu trong đợt, kèm hạn nộp")
    void openedGoesToEachUnitOfThePublication() {
        ReportPeriod period = mock(ReportPeriod.class);
        when(period.getName()).thenReturn("Quý II/2026");
        when(period.getDeadline()).thenReturn(LocalDate.of(2026, 7, 25));
        Publication publication = mock(Publication.class);
        when(publication.getId()).thenReturn(3L);
        when(publication.getPeriod()).thenReturn(period);
        when(publication.getKind()).thenReturn(PublicationKind.LAN_DAU);
        Set<Long> units = new LinkedHashSet<>(List.of(1L, 2L));
        when(publicationItems.unitIds(3L)).thenReturn(units);
        when(users.findActiveIdsByReportUnitId(1L)).thenReturn(List.of(20L));
        when(users.findActiveIdsByReportUnitId(2L)).thenReturn(List.of(21L, 22L));

        notifier.publicationOpened(publication);

        for (long account : new long[] {20L, 21L, 22L}) {
            verify(notifications).notify(account, NotificationLevel.INFO, "Đã mở kỳ báo cáo",
                    "Quý II/2026 đã mở, bạn có phiếu cần nhập. Hạn nộp: 25/07/2026.", "/input-reports");
        }
    }

    @Test
    @DisplayName("Đợt bổ sung dùng lời riêng, không nói là mở kỳ mới")
    void supplementHasItsOwnWording() {
        ReportPeriod period = mock(ReportPeriod.class);
        when(period.getName()).thenReturn("Quý I/2026");
        Publication publication = mock(Publication.class);
        when(publication.getId()).thenReturn(4L);
        when(publication.getPeriod()).thenReturn(period);
        when(publication.getKind()).thenReturn(PublicationKind.BO_SUNG);
        when(publicationItems.unitIds(4L)).thenReturn(Set.of(1L));
        when(users.findActiveIdsByReportUnitId(1L)).thenReturn(List.of(20L));

        notifier.publicationOpened(publication);

        verify(notifications).notify(20L, NotificationLevel.INFO, "Có biểu bổ sung cần nhập",
                "Sở vừa bổ sung biểu cho Quý I/2026.", "/input-reports");
    }

    @Test
    @DisplayName("Báo cáo năm: Sở nộp thì UBND nhận; UBND trả lại hoặc duyệt thì cán bộ Sở nộp báo cáo năm nhận")
    void annualFlow() {
        AnnualReport report = mock(AnnualReport.class);
        when(report.getId()).thenReturn(7L);
        when(report.getReportYear()).thenReturn(2026);
        when(users.findActiveIdsByRoleCode("UBND_APPROVER")).thenReturn(List.of(30L));
        when(users.findActiveIdsByRoleCode("DEPT_REPORT_SUBMITTER")).thenReturn(List.of(40L));

        notifier.annualSubmitted(report);
        notifier.annualApproved(report);
        notifier.annualReturned(report, "Số liệu giáo dục chưa khớp");

        verify(notifications).notify(30L, NotificationLevel.INFO, "Có báo cáo năm chờ duyệt",
                "Sở đã nộp báo cáo năm 2026, đang chờ UBND duyệt.", "/annual-review/7");
        verify(notifications).notify(40L, NotificationLevel.SUCCESS, "UBND đã duyệt báo cáo năm",
                "Báo cáo năm 2026 đã được UBND duyệt.", "/annual-review/7");
        verify(notifications).notify(40L, NotificationLevel.WARNING, "UBND trả lại báo cáo năm",
                "Báo cáo năm 2026 bị UBND trả lại. Lý do: Số liệu giáo dục chưa khớp. Bạn chỉnh rồi nộp lại.",
                "/annual-review/7");
    }

    @Test
    @DisplayName("Nhắc hạn: mỗi đơn vị trong một kỳ chỉ nhận một lời nhắc dù có nhiều phiếu")
    void reminderIsOncePerUnitAndPeriod() {
        LocalDate today = LocalDate.of(2026, 10, 22);
        InputReport first = report(1, 1, "UBND phường An Lộc", "Quý III/2026");
        InputReport second = report(2, 1, "UBND phường An Lộc", "Quý III/2026");
        InputReport other = report(3, 2, "UBND phường Xuân Bình", "Quý III/2026");
        for (InputReport r : List.of(first, second, other)) {
            ReportPeriod period = r.getPeriod();
            when(period.getId()).thenReturn(100L);
            when(period.getDeadline()).thenReturn(LocalDate.of(2026, 10, 25));
        }
        InputReportRepository repository = mock(InputReportRepository.class);
        ArgumentCaptor<Collection<LocalDate>> dates = ArgumentCaptor.captor();
        when(repository.findEditableDueOn(any(), eq(PeriodStatus.OPEN), dates.capture()))
                .thenReturn(List.of(first, second, other));
        when(users.findActiveIdsByReportUnitId(anyLong())).thenReturn(List.of(20L));

        int sent = new ReportDeadlineReminderJob(repository, notifier).remindFor(today);

        assertEquals(2, sent);
        assertEquals(List.of(today.plusDays(3), today.plusDays(1), today), List.copyOf(dates.getValue()));
        verify(notifications, org.mockito.Mockito.times(2)).notify(eq(20L), eq(NotificationLevel.WARNING),
                eq("Phiếu sắp đến hạn nộp"), any(), any());
        verify(notifications).notify(eq(20L), eq(NotificationLevel.WARNING), eq("Phiếu sắp đến hạn nộp"),
                eq("Phiếu Quý III/2026 của UBND phường An Lộc chưa nộp. Còn 3 ngày đến hạn nộp (25/10/2026)."),
                eq("/input-reports/1"));
    }
}
