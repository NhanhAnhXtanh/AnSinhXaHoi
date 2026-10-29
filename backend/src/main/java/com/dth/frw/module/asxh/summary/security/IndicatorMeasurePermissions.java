package com.dth.frw.module.asxh.summary.security;

/**
 * Mã quyền của màn "Bản chất chỉ tiêu" (resource REST {@code indicator_measures}) — seed ở
 * {@code 168-seed-asxh-indicator-measure-permissions.sql}.
 *
 * <ul>
 *   <li>{@code indicator_measures:read} — xem danh mục chỉ tiêu và bản chất đã khai (ADMIN,
 *       TEMPLATE_ADMIN, DEPT_REPORT_COMPILER, DEPT_REPORT_SUBMITTER, AUDITOR).</li>
 *   <li>{@code indicator_measures:write} — khai / đổi / bỏ bản chất của chỉ tiêu (ADMIN, TEMPLATE_ADMIN,
 *       DEPT_REPORT_COMPILER). Đổi bản chất làm đổi số tổng hợp nhiều kỳ của mọi năm chưa lưu số liệu
 *       Sở, nên chỉ cấp cho người dựng mẫu và người tổng hợp.</li>
 * </ul>
 */
public final class IndicatorMeasurePermissions {

    public static final String READ = "indicator_measures:read";
    public static final String WRITE = "indicator_measures:write";

    private IndicatorMeasurePermissions() {
    }
}
