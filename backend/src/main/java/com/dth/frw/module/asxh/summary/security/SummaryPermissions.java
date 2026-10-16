package com.dth.frw.module.asxh.summary.security;

/**
 * Mã quyền của màn Tổng hợp báo cáo — đã seed ở {@code 165-seed-asxh-roles.sql} (ADMIN,
 * DEPT_REPORT_COMPILER có cả hai; REPORT_ADMIN, DEPT_REPORT_SUBMITTER, AUDITOR có {@code read}).
 *
 * <ul>
 *   <li>{@code summary:read} — xem số liệu tổng hợp theo kỳ / theo năm, lịch sử và so sánh số liệu
 *       Sở đã lưu, endpoint số liệu cho script ({@code /api/summary/data}…).</li>
 *   <li>{@code summary:write} — lưu số liệu tổng hợp của kỳ đã chốt (UC-54), Sở sửa số (UC-55),
 *       khôi phục phiên bản, lưu ảnh chụp (UC-57).</li>
 * </ul>
 */
public final class SummaryPermissions {

    public static final String SUMMARY_READ = "summary:read";
    public static final String SUMMARY_WRITE = "summary:write";

    private SummaryPermissions() {
    }
}
