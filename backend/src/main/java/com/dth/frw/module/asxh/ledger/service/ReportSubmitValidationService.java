package com.dth.frw.module.asxh.ledger.service;

import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.attachment.service.InputReportAttachmentService;
import com.dth.frw.module.asxh.script.ServerScriptRunner;
import com.dth.frw.module.asxh.script.WorkbookJsonCellReader;
import com.dth.frw.shared.exception.ConflictException;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kiểm tra phía máy chủ khi đơn vị NỘP phiếu (UC-38 bước 4) — port
 * {@code ReportSubmitValidationService} + {@code assertTreasuryConfirmationReady} của bản Jmix.
 *
 * <p>Thứ tự như bản Jmix (người gọi đã kiểm "đủ biểu" trước): xác nhận Kho bạc → chạy lại hook
 * {@code validate} của mẫu cho từng biểu. Hàng rào ở trình duyệt vẫn giữ (phản hồi tức thì), nhưng
 * không còn là lớp DUY NHẤT — gọi thẳng REST hay script không tải được đều không lọt qua đây.
 *
 * <p><b>Giới hạn có chủ đích:</b> script lỗi KỸ THUẬT trên máy chủ (vd dùng {@code ctx.api} chỉ
 * có ở trình duyệt) được ghi log và BỎ QUA — chặn thì cả tỉnh không nộp được phiếu. Chỉ lỗi số
 * liệu do chính script báo mới chặn.
 */
@Service
public class ReportSubmitValidationService {

    private static final Logger log = LoggerFactory.getLogger(ReportSubmitValidationService.class);

    /** Không dồn quá nhiều lỗi vào một thông báo — người dùng sửa vài dòng đầu rồi nộp lại. */
    private static final int MAX_REPORTED_ISSUES = 10;

    private final ServerScriptRunner scriptRunner;
    private final InputReportAttachmentService attachmentService;

    public ReportSubmitValidationService(ServerScriptRunner scriptRunner,
                                         InputReportAttachmentService attachmentService) {
        this.scriptRunner = scriptRunner;
        this.attachmentService = attachmentService;
    }

    /**
     * @throws ConflictException thiếu xác nhận Kho bạc, hoặc script kiểm tra của mẫu báo lỗi (→ 409)
     */
    @Transactional
    public void assertReadyForSubmit(InputReport report, List<InputReportSheet> sheets) {
        // Xác nhận Kho bạc là điều kiện hành chính — người nộp tự xử lý ngay được, nên báo trước.
        attachmentService.assertTreasuryConfirmationReady(report);

        List<String> problems = new ArrayList<>();
        for (InputReportSheet sheet : sheets) {
            // Biểu "không phát sinh" thì không kiểm — giống lúc đánh dấu.
            if (sheet.getCompletion() == SheetCompletion.NO_DATA) {
                continue;
            }
            String label = LedgerWriteService.sheetLabel(sheet.getTemplate());
            for (String error : validateSheet(report, sheet)) {
                problems.add(capitalize(label) + ": " + error);
            }
        }
        if (problems.isEmpty()) {
            return;
        }
        List<String> shown = problems.size() > MAX_REPORTED_ISSUES ? problems.subList(0, MAX_REPORTED_ISSUES) : problems;
        throw new ConflictException("Không thể nộp phiếu: số liệu chưa hợp lệ theo kiểm tra của biểu mẫu ("
                + problems.size() + " lỗi). " + String.join("; ", shown)
                + (problems.size() > shown.size() ? "; …" : "."));
    }

    /**
     * Chạy hook {@code validate} cho MỘT biểu, trả các lỗi mức ERROR (rỗng = sạch).
     *
     * <p>Dùng được cho cả đường "đánh dấu đã nhập xong" một biểu (UC-35) để không có chuyện đánh
     * dấu xong được mà nộp lại vướng. Biểu chưa nhập gì, mẫu không có script, hoặc script lỗi kỹ
     * thuật đều trả rỗng.
     */
    @Transactional(readOnly = true)
    public List<String> validateSheet(InputReport report, InputReportSheet sheet) {
        String workbookJson = sheet.getDataJson();
        if (WorkbookJsonCellReader.isEmptyWorkbook(workbookJson)) {
            return List.of();
        }
        TemplateVersion version = sheet.getTemplateVersion();
        String scriptText = version == null ? null : version.getScriptText();
        if (scriptText == null || scriptText.isBlank()) {
            return List.of();
        }
        Template template = sheet.getTemplate();
        ServerScriptRunner.ValidateResult result = scriptRunner.runValidate(
                workbookJson,
                List.of(new ServerScriptRunner.ScriptSource(LedgerWriteService.sheetLabel(template), scriptText)),
                LedgerWriteService.reportInfo(report, template, ReportStatus.SUBMITTED));
        for (String failure : result.scriptFailures()) {
            log.warn("Hook validate của {} (phiếu {}) không chạy được trên máy chủ, bỏ qua: {}",
                    LedgerWriteService.sheetLabel(template), report.getId(), failure);
        }
        return result.errors();
    }

    private static String capitalize(String text) {
        return text == null || text.isEmpty() ? text : Character.toUpperCase(text.charAt(0)) + text.substring(1);
    }
}
