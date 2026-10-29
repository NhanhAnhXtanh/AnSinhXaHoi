package com.dth.frw.module.asxh.home.security;

import com.dth.frw.module.asxh.inputreport.security.InputReportPermissions;
import com.dth.frw.module.asxh.setup.security.SetupPermissions;
import java.util.function.Predicate;

/**
 * Quyền của trang chủ. Không có mã quyền riêng — trang chủ là một cách nhìn lên phiếu nhập và
 * kỳ, nên dùng lại mã của các slice đó (không cần seed thêm).
 *
 * <ul>
 *   <li>{@link #READ} — gọi được {@code /api/asxh_dashboard}.</li>
 *   <li>{@link #APPROVE} — việc "chờ duyệt" dẫn sang màn Duyệt phiếu thay vì màn Nhập liệu.</li>
 *   <li>{@link #canViewUnits} — được xem chế độ "Theo đơn vị" (người điều hành, UC-76).</li>
 * </ul>
 */
public final class HomeDashboardPermissions {

    public static final String READ = InputReportPermissions.INPUT_REPORTS_READ;
    public static final String APPROVE = InputReportPermissions.INPUT_REPORTS_APPROVE;

    private HomeDashboardPermissions() {
    }

    /** Có quyền màn Thiết lập &amp; điều hành: xem ma trận thiết lập hoặc xem các đợt. */
    public static boolean canViewUnits(Predicate<String> has) {
        return has.test(SetupPermissions.PERIOD_ASSIGNMENTS_READ) || has.test(SetupPermissions.PUBLICATIONS_READ);
    }
}
