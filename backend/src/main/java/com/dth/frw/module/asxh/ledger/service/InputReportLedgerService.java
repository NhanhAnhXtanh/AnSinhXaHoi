package com.dth.frw.module.asxh.ledger.service;

import com.dth.frw.domain.asxh.ledger.LedgerSource;
import com.dth.frw.domain.asxh.ledger.LedgerWriteAudit;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.module.asxh.inputreport.service.InputReportService;
import com.dth.frw.module.asxh.inputreport.service.InputReportSheetService;
import com.dth.frw.module.asxh.ledger.api.dto.LedgerImportRequest;
import com.dth.frw.module.asxh.ledger.api.dto.LedgerImportResponse;
import com.dth.frw.module.asxh.script.ScriptRow;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.web.ListParams;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;

/**
 * Các thao tác số liệu đã lưu theo MỘT phiếu mà REST gọi trực tiếp: xem trước lúc duyệt, nạp
 * BHXH (UC-49), nhật ký ghi.
 *
 * <p>Tách khỏi {@link LedgerWriteService} vì lớp này phụ thuộc {@code InputReportService} (để nạp
 * phiếu qua phạm vi dữ liệu của người gọi), còn {@code InputReportService} lại phụ thuộc
 * {@link LedgerWriteService} qua {@link InputReportWorkflowHooks} — gộp vào là vòng phụ thuộc.
 *
 * <p>Phiếu và tờ biểu được nạp TRONG giao dịch của lớp này, để quan hệ LAZY của tờ biểu (phiên bản
 * mẫu chứa script) còn đọc được.
 */
@Service
public class InputReportLedgerService {

    /** Không nạp vào phiếu đã chốt số (BR-41.2 — đã duyệt là bất biến) hay phiếu đã bỏ. */
    private static final Set<ReportStatus> IMPORT_FORBIDDEN = EnumSet.of(
            ReportStatus.APPROVED, ReportStatus.LOCKED, ReportStatus.CANCELLED, ReportStatus.SUPERSEDED);

    private static final Set<String> PER_ROW_UNIT_SHORT_NAMES = Set.of("1g");

    private final InputReportService reportService;
    private final InputReportSheetService sheetService;
    private final LedgerWriteService writeService;
    private final LedgerReplaceService replaceService;
    private final LedgerAuditService auditService;

    public InputReportLedgerService(InputReportService reportService,
                                    InputReportSheetService sheetService,
                                    LedgerWriteService writeService,
                                    LedgerReplaceService replaceService,
                                    LedgerAuditService auditService) {
        this.reportService = reportService;
        this.sheetService = sheetService;
        this.writeService = writeService;
        this.replaceService = replaceService;
        this.auditService = auditService;
    }

    /** Xem trước số dòng sẽ lưu khi duyệt — không ghi gì. */
    @Transactional(readOnly = true)
    public LedgerWriteService.PreviewResult preview(Long reportId) {
        InputReport report = reportService.get(reportId);
        return writeService.preview(report, sheetsOf(reportId));
    }

    /** Phiếu nhập hộ cho những đơn vị nào (UC-46) — không ghi gì. Phiếu ngoài tầm nhìn → 404. */
    @Transactional(readOnly = true)
    public LedgerWriteService.DataUnitsResult dataUnits(Long reportId) {
        InputReport report = reportService.get(reportId);
        return writeService.dataUnits(report, sheetsOf(reportId));
    }

    /**
     * Nạp số liệu BHXH vào một biểu của phiếu (UC-49): kiểm như đường duyệt rồi THAY toàn bộ số liệu
     * đã lưu của tờ biểu đó. Không đổi trạng thái phiếu; số liệu chỉ được tổng hợp khi phiếu đã duyệt.
     *
     * @throws IllegalArgumentException biểu không thuộc phiếu, hoặc dòng không hợp lệ (→ 400)
     * @throws ConflictException        phiếu đã duyệt / đã khoá / đã huỷ / bản cũ (→ 409)
     */
    @Transactional
    public LedgerImportResponse importRows(Long reportId, LedgerImportRequest request) {
        InputReport report = reportService.get(reportId);
        if (IMPORT_FORBIDDEN.contains(report.getStatus())) {
            throw new ConflictException("Phiếu đã duyệt, đã khoá hoặc không còn hiệu lực nên không nạp thêm số liệu được.");
        }
        InputReportSheet sheet = sheetsOf(reportId).stream()
                .filter(s -> s.getTemplate() != null && s.getTemplate().getId().equals(request.templateId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Biểu cần nạp không thuộc phiếu này."));

        List<ScriptRow> rows = request.rows().stream().map(LedgerImportRequest.Row::toScriptRow).toList();
        String shortName = sheet.getTemplate().getShortName();
        boolean perRowUnit = shortName != null && PER_ROW_UNIT_SHORT_NAMES.contains(shortName.trim().toLowerCase())
                && rows.stream().anyMatch(r -> r.organizationCode() != null && !r.organizationCode().isBlank());

        LedgerReplaceService.UpsertResult result;
        try {
            result = replaceService.replace(report, sheet, rows, perRowUnit, LedgerSource.BHXH_IMPORT);
        } catch (IllegalArgumentException e) {
            auditService.recordFailed(report.getId(), sheet.getId(), sheet.getTemplate().getId(),
                    sheet.getTemplateVersionId(), LedgerSource.BHXH_IMPORT, e.getMessage());
            throw e;
        }
        auditService.recordSuccess(report.getId(), sheet.getId(), sheet.getTemplate().getId(),
                sheet.getTemplateVersionId(), LedgerSource.BHXH_IMPORT,
                result.added(), result.updated(), result.removed());
        return new LedgerImportResponse(report.getId(), sheet.getId(), sheet.getTemplate().getId(),
                result.added(), result.updated(), result.removed());
    }

    /** Nhật ký ghi số liệu của phiếu, mới trước. */
    @Transactional(readOnly = true)
    public List<LedgerWriteAudit> audits(Long reportId) {
        reportService.get(reportId); // phiếu ngoài tầm nhìn → 404
        return auditService.forReport(reportId);
    }

    private List<InputReportSheet> sheetsOf(Long reportId) {
        LinkedMultiValueMap<String, String> query = new LinkedMultiValueMap<>();
        query.add("report.id", String.valueOf(reportId));
        query.add("_start", "0");
        query.add("_end", "1000");
        return sheetService.list(new ListParams(query)).getContent();
    }
}
