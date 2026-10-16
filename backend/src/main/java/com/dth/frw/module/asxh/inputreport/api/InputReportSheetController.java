package com.dth.frw.module.asxh.inputreport.api;

import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.module.asxh.inputreport.api.dto.InputReportSheetResponse;
import com.dth.frw.module.asxh.inputreport.api.dto.SheetDataRequest;
import com.dth.frw.module.asxh.inputreport.security.InputReportPermissions;
import com.dth.frw.module.asxh.inputreport.service.InputReportSheetService;
import com.dth.frw.shared.web.ListParams;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/input_report_sheets} — tờ biểu của phiếu.
 *
 * <p>{@code GET ?report.id=} liệt kê các tab của một phiếu (không kèm số liệu);
 * {@code GET /{id}} trả cả {@code dataJson}. {@code PUT}/{@code PATCH /{id}} lưu số liệu;
 * đánh dấu là các action {@code POST /{id}/complete|no_data|reopen}.
 */
@RestController
@RequestMapping("/api/input_report_sheets")
public class InputReportSheetController {

    private final InputReportSheetService service;

    public InputReportSheetController(InputReportSheetService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_READ + "')")
    public ResponseEntity<List<InputReportSheetResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<InputReportSheetResponse> rows = service.getMany(ids).stream()
                    .map(row -> InputReportSheetResponse.from(row, false))
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<InputReportSheet> page = service.list(params);
        return ListResponse.of(
                page.map(row -> InputReportSheetResponse.from(row, false)).getContent(),
                page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_READ + "')")
    public InputReportSheetResponse get(@PathVariable Long id) {
        return InputReportSheetResponse.from(service.get(id), true);
    }

    /** Lưu số liệu (UC-34). Trả tờ biểu với số hiệu bản lưu mới, không dội lại số liệu. */
    @RequestMapping(value = "/{id}", method = {RequestMethod.PUT, RequestMethod.PATCH})
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_WRITE + "')")
    public InputReportSheetResponse save(@PathVariable Long id, @Valid @RequestBody SheetDataRequest request) {
        return InputReportSheetResponse.from(service.saveData(id, request.dataJson(), request.version()), false);
    }

    /** Kiểm tra &amp; hoàn tất (UC-35). */
    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_WRITE + "')")
    public InputReportSheetResponse complete(@PathVariable Long id) {
        return InputReportSheetResponse.from(service.complete(id), false);
    }

    /** Không phát sinh số liệu (UC-36). */
    @PostMapping("/{id}/no_data")
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_WRITE + "')")
    public InputReportSheetResponse noData(@PathVariable Long id) {
        return InputReportSheetResponse.from(service.markNoData(id), false);
    }

    /** Sửa lại (UC-37). */
    @PostMapping("/{id}/reopen")
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_WRITE + "')")
    public InputReportSheetResponse reopen(@PathVariable Long id) {
        return InputReportSheetResponse.from(service.reopen(id), false);
    }
}
