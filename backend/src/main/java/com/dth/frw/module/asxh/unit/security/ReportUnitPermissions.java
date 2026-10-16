package com.dth.frw.module.asxh.unit.security;

/**
 * Mã quyền của resource {@code report_units}, seed ở {@code 101-seed-report-units.sql}.
 *
 * <p>Để riêng trong slice thay vì thêm vào {@code shared/security/Permissions} của
 * base (không sửa base). Cùng khuôn {@code resource:action}: nửa resource trùng
 * nguyên văn tên resource frontend khai trong {@code routes.tsx}.
 */
public final class ReportUnitPermissions {

    public static final String READ = "report_units:read";
    public static final String WRITE = "report_units:write";
    public static final String DELETE = "report_units:delete";

    private ReportUnitPermissions() {
    }
}
