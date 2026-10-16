package com.dth.frw.module.asxh.period.security;

/**
 * Mã quyền của resource {@code report_calendars} và {@code report_periods}, seed ở
 * {@code 103-seed-report-calendars.sql}.
 *
 * <p>Để riêng trong slice (không sửa {@code shared/security/Permissions} của base).
 * Slice thiết lập kỳ có thể dùng {@link #PERIODS_WRITE} cho các thao tác đổi
 * trạng thái kỳ nếu không khai mã riêng.
 */
public final class ReportPeriodPermissions {

    public static final String CALENDARS_READ = "report_calendars:read";
    public static final String CALENDARS_WRITE = "report_calendars:write";
    public static final String CALENDARS_DELETE = "report_calendars:delete";

    public static final String PERIODS_READ = "report_periods:read";
    public static final String PERIODS_WRITE = "report_periods:write";
    public static final String PERIODS_DELETE = "report_periods:delete";

    private ReportPeriodPermissions() {
    }
}
