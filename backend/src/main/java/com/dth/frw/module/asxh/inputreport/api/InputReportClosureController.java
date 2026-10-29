package com.dth.frw.module.asxh.inputreport.api;

import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.module.asxh.inputreport.api.dto.InputReportResponse;
import com.dth.frw.module.asxh.inputreport.service.InputReportClosureService;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.ledger.security.LedgerPermissions;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code POST /api/input_reports/{id}/lock|cancel} — khoá phiếu đã duyệt / huỷ phiếu (UC-47).
 * Chỉ qua REST, không có nút trên giao diện. Trả phiếu sau khi đổi trạng thái, cùng dạng với các
 * action khác của {@code /api/input_reports}.
 */
@RestController
@RequestMapping("/api/input_reports")
public class InputReportClosureController {

    private final InputReportClosureService closureService;
    private final InputReportService reportService;

    public InputReportClosureController(InputReportClosureService closureService, InputReportService reportService) {
        this.closureService = closureService;
        this.reportService = reportService;
    }

    @PostMapping("/{id}/lock")
    @PreAuthorize("hasAuthority('" + LedgerPermissions.INPUT_REPORTS_LOCK + "')")
    public InputReportResponse lock(@PathVariable Long id) {
        return one(closureService.lock(id));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('" + LedgerPermissions.INPUT_REPORTS_CANCEL + "')")
    public InputReportResponse cancel(@PathVariable Long id) {
        return one(closureService.cancel(id));
    }

    private InputReportResponse one(InputReport report) {
        return InputReportResponse.from(report, reportService.progress(List.of(report.getId())).get(report.getId()));
    }
}
