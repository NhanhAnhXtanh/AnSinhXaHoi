package com.dth.frw.module.asxh.inputreport.security;

/**
 * Mã quyền của slice phiếu nhập, seed ở {@code 122-seed-report-permissions.sql}.
 *
 * <p>Ba mã thay vì bộ read/write/delete chuẩn: phiếu không ai xoá tay (chỉ sinh từ đợt phát
 * hành, chỉ mất khi thu hồi kỳ), còn duyệt/trả lại là việc của Sở, khác hẳn việc nhập/nộp của
 * đơn vị — gộp chung vào {@code write} thì cán bộ đơn vị tự duyệt được phiếu của mình.
 *
 * <ul>
 *   <li>{@code input_reports:read} — xem phiếu, tờ biểu.</li>
 *   <li>{@code input_reports:write} — lưu số liệu, đánh dấu biểu, nộp phiếu (đơn vị).</li>
 *   <li>{@code input_reports:approve} — phê duyệt / trả lại phiếu (Sở).</li>
 * </ul>
 */
public final class InputReportPermissions {

    public static final String INPUT_REPORTS_READ = "input_reports:read";
    public static final String INPUT_REPORTS_WRITE = "input_reports:write";
    public static final String INPUT_REPORTS_APPROVE = "input_reports:approve";

    private InputReportPermissions() {
    }
}
