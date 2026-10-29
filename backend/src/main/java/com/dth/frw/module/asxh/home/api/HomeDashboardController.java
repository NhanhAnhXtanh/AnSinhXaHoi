package com.dth.frw.module.asxh.home.api;

import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse;
import com.dth.frw.module.asxh.home.api.dto.HomeDashboardResponse.Capabilities;
import com.dth.frw.module.asxh.home.security.HomeDashboardPermissions;
import com.dth.frw.module.asxh.home.service.HomeDashboardService;
import com.dth.frw.shared.security.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/asxh_dashboard?year=2026[&units=true]} — số liệu trang chủ.
 *
 * <p>Không thuộc dialect danh sách của data provider: màn đọc bằng {@code useCustom}, một đối
 * tượng duy nhất (cấu trúc ở {@link HomeDashboardResponse}). Chỉ đọc.
 *
 * <p>Quyền: {@code input_reports:read} — trang chủ chỉ là một cách nhìn khác lên phiếu nhập.
 * Phần "Theo đơn vị" ({@code units=true}) thêm điều kiện có quyền màn Thiết lập &amp; điều hành
 * ({@code period_assignments:read} hoặc {@code publications:read}); thiếu thì {@code units}
 * trả {@code null} chứ không báo lỗi, và {@code capabilities.viewUnits = false} để màn ẩn nút
 * chuyển chế độ.
 */
@RestController
@RequestMapping("/api/asxh_dashboard")
public class HomeDashboardController {

    private static final int MIN_YEAR = 2000;
    private static final int MAX_YEAR = 2100;

    private final HomeDashboardService service;

    public HomeDashboardController(HomeDashboardService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + HomeDashboardPermissions.READ + "')")
    public HomeDashboardResponse get(@RequestParam(required = false) Integer year,
                                     @RequestParam(required = false, defaultValue = "false") boolean units) {
        int resolvedYear = year == null ? service.currentYear() : year;
        if (resolvedYear < MIN_YEAR || resolvedYear > MAX_YEAR) {
            throw new IllegalArgumentException("Năm báo cáo không hợp lệ.");
        }
        Capabilities capabilities = new Capabilities(
                HomeDashboardPermissions.canViewUnits(CurrentUser::has),
                CurrentUser.has(HomeDashboardPermissions.APPROVE));
        return service.load(resolvedYear, units && capabilities.viewUnits(), capabilities);
    }
}
