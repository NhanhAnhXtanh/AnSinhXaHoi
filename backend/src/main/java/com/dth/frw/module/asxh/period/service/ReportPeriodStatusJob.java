package com.dth.frw.module.asxh.period.service;

import java.time.LocalDate;
import java.time.ZoneId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
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
 * <p><b>Chạy bù khi khởi động:</b> máy chủ tắt qua 00:05 (bảo trì, khởi động lại buổi sáng) thì
 * trước đây cả ngày kỳ vẫn giữ trạng thái cũ — kỳ đến ngày mở vẫn "Chưa mở" nên đơn vị không nhập
 * được, kỳ quá hạn vẫn "Đang mở" nên vẫn nộp được — tới 00:05 hôm sau mới tự chữa. Giờ chạy thêm
 * một lần khi ứng dụng sẵn sàng. Tắt bằng {@code asxh.period-status-job.run-on-startup=false}
 * (cấu hình test đặt false: dữ liệu thử có kỳ theo ngày cố định mà test dựa vào).
 *
 * <p>{@code @EnableScheduling} đặt ở đây vì base chưa bật lập lịch ở đâu cả; nếu sau này
 * base có cấu hình lập lịch chung thì gỡ annotation này.
 */
@Configuration
@EnableScheduling
public class ReportPeriodStatusJob {

    private static final Logger log = LoggerFactory.getLogger(ReportPeriodStatusJob.class);

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ReportPeriodService periodService;
    private final boolean runOnStartup;

    public ReportPeriodStatusJob(ReportPeriodService periodService,
                                 @Value("${asxh.period-status-job.run-on-startup:true}") boolean runOnStartup) {
        this.periodService = periodService;
        this.runOnStartup = runOnStartup;
    }

    @Scheduled(cron = "0 5 0 * * *", zone = "Asia/Ho_Chi_Minh")
    public void updatePeriodStatuses() {
        periodService.applyDateStatuses(LocalDate.now(VIETNAM));
    }

    /**
     * Chạy bù một lần khi ứng dụng đã sẵn sàng. Lỗi chỉ ghi log, không làm hỏng khởi động — lần
     * chạy 00:05 kế tiếp tự chữa.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void catchUpOnStartup() {
        if (!runOnStartup) {
            return;
        }
        try {
            updatePeriodStatuses();
        } catch (RuntimeException e) {
            log.warn("Không cập nhật được trạng thái kỳ theo ngày khi khởi động: {}", e.getMessage(), e);
        }
    }
}
