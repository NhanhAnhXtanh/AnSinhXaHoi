package com.dth.frw.module.asxh.summary.api;

import com.dth.frw.module.asxh.summary.security.SummaryPermissions;
import com.dth.frw.module.asxh.summary.service.SummaryReportService;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.UnitOption;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/master/organization-units?orgType=SO&orgType=XA} — danh mục đơn vị cho script tổng
 * hợp năm của bản Jmix (chia Khối tỉnh / Khối xã theo {@code orgType}; script gọi
 * {@code /rest/qt/master/organization-units}, phía trình duyệt đổi thành đường dẫn này).
 *
 * <p>{@code orgType} trả mã kiểu bản Jmix ({@code TINH, SO, XA, HUYEN, TRUONG, KHAC}). Chỉ đọc, quyền
 * {@code summary:read} — các màn khác dùng {@code /api/report_units}.
 */
@RestController
@RequestMapping("/api/master")
public class SummaryMasterDataController {

    private final SummaryReportService reportService;

    public SummaryMasterDataController(SummaryReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/organization-units")
    @PreAuthorize("hasAuthority('" + SummaryPermissions.SUMMARY_READ + "')")
    public List<UnitOption> organizationUnits(@RequestParam(required = false) List<String> orgType) {
        return reportService.organizationUnits(orgType);
    }
}
