package com.dth.frw.module.asxh.ledger.api;

import com.dth.frw.module.asxh.inputreport.security.InputReportPermissions;
import com.dth.frw.module.asxh.ledger.api.dto.LedgerImportRequest;
import com.dth.frw.module.asxh.ledger.api.dto.LedgerImportResponse;
import com.dth.frw.module.asxh.ledger.api.dto.LedgerWriteAuditResponse;
import com.dth.frw.module.asxh.ledger.security.LedgerPermissions;
import com.dth.frw.module.asxh.ledger.service.InputReportLedgerService;
import com.dth.frw.module.asxh.ledger.service.LedgerWriteService;
import com.dth.frw.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Thao tác số liệu đã lưu theo một phiếu:
 * <ul>
 *   <li>{@code POST /api/input_reports/{id}/ledger_preview} — xem trước khi duyệt: mỗi biểu đọc
 *       được bao nhiêu dòng, biểu nào lỗi (không ghi gì). Quyền duyệt phiếu.</li>
 *   <li>{@code GET /api/input_reports/{id}/data_units} — phiếu nhập hộ (biểu 1g) mang số liệu của
 *       những đơn vị nào: đã duyệt thì theo số liệu đã lưu, chưa duyệt thì theo số trên biểu.</li>
 *   <li>{@code POST /api/input_reports/{id}/ledger_imports} — nạp số liệu BHXH vào một biểu
 *       (UC-49, chỉ REST). Body {@code {templateId, rows: [...]}}.</li>
 *   <li>{@code GET /api/input_reports/{id}/ledger_audits} — nhật ký ghi số liệu (kể cả lần duyệt
 *       thất bại và lý do).</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/input_reports/{reportId}")
public class InputReportLedgerController {

    private final InputReportLedgerService service;

    public InputReportLedgerController(InputReportLedgerService service) {
        this.service = service;
    }

    @PostMapping("/ledger_preview")
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_APPROVE + "')")
    public LedgerWriteService.PreviewResult preview(@PathVariable Long reportId) {
        return service.preview(reportId);
    }

    // Đọc được phiếu là đọc được phiếu đó nhập hộ cho ai — cả cán bộ đơn vị lẫn Sở (UC-46).
    @GetMapping("/data_units")
    @PreAuthorize("hasAuthority('" + InputReportPermissions.INPUT_REPORTS_READ + "')")
    public LedgerWriteService.DataUnitsResult dataUnits(@PathVariable Long reportId) {
        return service.dataUnits(reportId);
    }

    @PostMapping("/ledger_imports")
    @PreAuthorize("hasAuthority('" + LedgerPermissions.LEDGER_ENTRIES_IMPORT + "')")
    public LedgerImportResponse importRows(@PathVariable Long reportId,
                                           @Valid @RequestBody LedgerImportRequest request) {
        return service.importRows(reportId, request);
    }

    @GetMapping("/ledger_audits")
    @PreAuthorize("hasAuthority('" + LedgerPermissions.LEDGER_ENTRIES_READ + "')")
    public ResponseEntity<List<LedgerWriteAuditResponse>> audits(@PathVariable Long reportId) {
        List<LedgerWriteAuditResponse> body = service.audits(reportId).stream()
                .map(LedgerWriteAuditResponse::from)
                .toList();
        return ListResponse.of(body, body.size());
    }
}
