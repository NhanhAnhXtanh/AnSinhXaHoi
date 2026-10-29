package com.dth.frw.module.asxh.template.service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Ngày theo giờ Việt Nam và cách viết ngày trong câu báo cho cán bộ.
 *
 * <p>"Hôm nay" của nghiệp vụ là hôm nay ở Đồng Nai, không phải theo múi giờ của
 * máy chủ (máy chủ chạy UTC thì từ 0h đến 7h sáng sẽ lệch một ngày).
 */
public final class TemplateDates {

    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private static final DateTimeFormatter DISPLAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private TemplateDates() {
    }

    public static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    /** Ngày 1 của tháng sau — ngày áp dụng gợi ý cho phiên bản mới (form cũ UC-10). */
    public static LocalDate firstDayOfNextMonth() {
        return today().withDayOfMonth(1).plusMonths(1);
    }

    public static String format(LocalDate date) {
        return date == null ? "" : DISPLAY.format(date);
    }
}
