package com.dth.frw.module.asxh.notification.service;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.module.asxh.inputreport.repo.InputReportRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Nhắc đơn vị còn phiếu chưa nộp khi kỳ sắp đến hạn: 8 giờ sáng (giờ Việt Nam) các ngày còn 3 ngày,
 * còn 1 ngày và đúng ngày hạn.
 *
 * <p>Chỉ chạy theo lịch, không chạy bù khi khởi động — khởi động lại trong ngày sẽ nhắc trùng. Mỗi
 * mốc ngày chỉ trúng một lần nên không cần ghi nhớ đã nhắc. Phiếu đã nộp, đã duyệt hay kỳ đã
 * đóng không bị nhắc. Một đơn vị có nhiều phiếu trong cùng kỳ (đợt bổ sung) chỉ nhận một lời nhắc.
 *
 * <p>(Lập lịch đã bật ở {@code ReportPeriodStatusJob}.)
 */
@Component
public class ReportDeadlineReminderJob {

    private static final Logger log = LoggerFactory.getLogger(ReportDeadlineReminderJob.class);

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Còn bao nhiêu ngày thì nhắc. */
    static final List<Integer> REMIND_DAYS_BEFORE = List.of(3, 1, 0);

    private final InputReportRepository reports;
    private final AsxhNotifier notifier;

    public ReportDeadlineReminderJob(InputReportRepository reports, AsxhNotifier notifier) {
        this.reports = reports;
        this.notifier = notifier;
    }

    @Scheduled(cron = "0 0 8 * * *", zone = "Asia/Ho_Chi_Minh")
    public void remindDueSoon() {
        try {
            remindFor(LocalDate.now(VIETNAM));
        } catch (RuntimeException e) {
            log.warn("Không nhắc hạn nộp phiếu được: {}", e.getMessage(), e);
        }
    }

    /** @return số lời nhắc đã gửi đi (số đơn vị × kỳ) */
    @Transactional(readOnly = true)
    public int remindFor(LocalDate today) {
        List<LocalDate> dates = REMIND_DAYS_BEFORE.stream().map(today::plusDays).toList();
        Set<String> reminded = new HashSet<>();
        int sent = 0;
        for (InputReport report : reports.findEditableDueOn(ReportStatus.EDITABLE, PeriodStatus.OPEN, dates)) {
            if (!reminded.add(report.getPeriod().getId() + ":" + report.getUnit().getId())) {
                continue;
            }
            long daysLeft = ChronoUnit.DAYS.between(today, report.getPeriod().getDeadline());
            notifier.deadlineSoon(report, daysLeft);
            sent++;
        }
        return sent;
    }
}
