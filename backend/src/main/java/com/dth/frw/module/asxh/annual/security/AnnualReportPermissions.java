package com.dth.frw.module.asxh.annual.security;

/**
 * Mã quyền của Báo cáo năm — đã seed ở {@code 165-seed-asxh-roles.sql} (ADMIN có cả ba;
 * DEPT_REPORT_SUBMITTER có cả ba; UBND_APPROVER có {@code read} + {@code approve};
 * DEPT_REPORT_COMPILER, AUDITOR có {@code read}).
 *
 * <ul>
 *   <li>{@code annual_reports:read} — xem danh sách, phiếu năm, bảng biểu đúng phiên bản đã ghim, file
 *       phiếu nộp, tình trạng nộp của năm ở màn Tổng hợp.</li>
 *   <li>{@code annual_reports:write} — nộp / gửi lại báo cáo năm (UC-59, UC-66).</li>
 *   <li>{@code annual_reports:approve} — phê duyệt, trả lại, mở lại (UC-63..65). Sở và UBND tạm dùng
 *       chung quyền này (UC-61 BR-61.2).</li>
 * </ul>
 */
public final class AnnualReportPermissions {

    public static final String ANNUAL_READ = "annual_reports:read";
    public static final String ANNUAL_WRITE = "annual_reports:write";
    public static final String ANNUAL_APPROVE = "annual_reports:approve";

    private AnnualReportPermissions() {
    }
}
