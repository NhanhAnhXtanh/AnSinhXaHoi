package com.dth.frw.module.asxh.period.service;

import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Job hằng ngày 00:05 (giờ Việt Nam): tự chuyển kỳ Chưa mở → Đang mở → Quá hạn theo
 * {@code openFrom}/{@code deadline}. Port từ {@code ReportingPeriodStatusJob} (RPT-08).
 *
 * <p>Thread của scheduler không có người dùng đăng nhập nên row-level trả phạm vi đầy
 * đủ — đúng ý, job phải thấy mọi kỳ. Chạy trên nhiều node thì mỗi node chạy một lần,
 * vô hại vì phép chuyển là idempotent.
 *
 * <p>{@code @EnableScheduling} đặt ở đây vì base chưa bật lập lịch ở đâu cả; nếu sau này
 * base có cấu hình lập lịch chung thì gỡ annotation này.
 */
@Configuration
@EnableScheduling
public class ReportPeriodStatusJob {

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ReportPeriodService periodService;

    public ReportPeriodStatusJob(ReportPeriodService periodService) {
        this.periodService = periodService;
    }

    @Scheduled(cron = "0 5 0 * * *", zone = "Asia/Ho_Chi_Minh")
    public void updatePeriodStatuses() {
        periodService.applyDateStatuses(LocalDate.now(VIETNAM));
    }
}
