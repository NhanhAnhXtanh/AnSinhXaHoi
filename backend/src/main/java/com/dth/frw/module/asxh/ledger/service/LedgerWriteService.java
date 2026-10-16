package com.dth.frw.module.asxh.ledger.service;

import com.dth.frw.domain.asxh.ledger.LedgerSource;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.ledger.repo.LedgerEntryRepository;
import com.dth.frw.module.asxh.script.ScriptRow;
import com.dth.frw.module.asxh.script.ServerScriptException;
import com.dth.frw.module.asxh.script.ServerScriptRunner;
import com.dth.frw.module.asxh.script.WorkbookJsonCellReader;
import com.dth.frw.shared.exception.ConflictException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ghi số liệu đã lưu khi Sở PHÊ DUYỆT phiếu (UC-41) — port {@code LedgerWriteService} của bản Jmix.
 *
 * <p><b>Giao dịch:</b> {@link #writeOnApprove} chạy TRONG giao dịch duyệt của người gọi
 * ({@code InputReportService.approve}); ném lỗi là huỷ cả phiếu — phiếu vẫn chờ duyệt, không còn
 * dòng số liệu dở dang. Nhật ký lỗi sống sót nhờ {@link LedgerAuditService#recordFailed}
 * ({@code REQUIRES_NEW}).
 *
 * <p>Lỗi trả cho cán bộ Sở là câu tiếng Việt không thuật ngữ kỹ thuật (409); chi tiết kỹ thuật
 * nằm trong nhật ký ghi ({@code asxh_ledger_write_audits}) và log máy chủ.
 */
@Service
public class LedgerWriteService {

    private static final Logger log = LoggerFactory.getLogger(LedgerWriteService.class);

    /** Biểu "nhập hộ": một phiếu nhập cho NHIỀU đơn vị, đơn vị lấy theo từng dòng (UC-46). */
    private static final Set<String> PER_ROW_UNIT_SHORT_NAMES = Set.of("1g");

    private final LedgerEntryRepository entryRepository;
    private final LedgerReplaceService replaceService;
    private final LedgerAuditService auditService;
    private final ServerScriptRunner scriptRunner;

    public LedgerWriteService(LedgerEntryRepository entryRepository,
                              LedgerReplaceService replaceService,
                              LedgerAuditService auditService,
                              ServerScriptRunner scriptRunner) {
        this.entryRepository = entryRepository;
        this.replaceService = replaceService;
        this.auditService = auditService;
        this.scriptRunner = scriptRunner;
    }

    // ------------------------------------------------------------------ kiểu kết quả

    /** Số dòng dự kiến của MỘT biểu khi xem trước. {@code missingScript} = mẫu thiếu phần đọc số liệu. */
    public record SheetPreview(Long sheetId, Long templateId, String templateShortName, int rowCount,
                               boolean skipped, boolean missingScript) {
    }

    /** Kết quả xem trước toàn phiếu — KHÔNG ghi gì. */
    public record PreviewResult(int totalRows, List<SheetPreview> sheets, boolean hasError, boolean timeout,
                                String errorTemplateShortName, String errorMessage) {
    }

    private enum RunStatus { SKIP, NO_HOOK, OK }

    private record SheetRun(RunStatus status, List<ScriptRow> rows) {
    }

    // ------------------------------------------------------------------ ghi khi duyệt

    /**
     * Chống cộng đôi rồi chạy {@code getInputData} cho từng tờ biểu và thay số liệu đã lưu của
     * tờ biểu đó.
     *
     * @param report phiếu đang được duyệt (đã khoá dòng, đang {@code SUBMITTED})
     * @param sheets mọi tờ biểu của phiếu
     * @throws ConflictException lỗi bất kỳ — người gọi để giao dịch huỷ
     */
    @Transactional
    public void writeOnApprove(InputReport report, List<InputReportSheet> sheets) {
        assertNoOverlappingApproved(report, sheets);
        for (InputReportSheet sheet : sheets) {
            Template template = sheet.getTemplate();
            Long versionId = sheet.getTemplateVersionId();
            String label = sheetLabel(template);

            SheetRun run;
            try {
                run = runSheet(report, sheet);
            } catch (ServerScriptException e) {
                auditService.recordFailed(report.getId(), sheet.getId(), template.getId(), versionId,
                        LedgerSource.SCRIPT, e.getMessage());
                throw approveFailure(label, e);
            }
            switch (run.status()) {
                case SKIP -> {
                    // Biểu "không phát sinh" hoặc chưa có workbook: không có gì để lưu.
                }
                case NO_HOOK -> {
                    String reason = "Phiên bản mẫu không có hook getInputData.";
                    auditService.recordFailed(report.getId(), sheet.getId(), template.getId(), versionId,
                            LedgerSource.SCRIPT, reason);
                    throw new ConflictException("Không duyệt được: mẫu " + label
                            + " chưa được cấu hình phần đọc số liệu nên chưa lưu được số liệu. Vui lòng báo"
                            + " người quản trị mẫu biểu bổ sung rồi duyệt lại; phiếu vẫn ở trạng thái chờ duyệt.");
                }
                case OK -> {
                    // "Nhập hộ" khi mẫu là 1g VÀ script thật sự trả mã đơn vị theo dòng (BR-46.1).
                    boolean perRowUnit = isPerRowUnitTemplate(template) && hasAnyUnitCode(run.rows());
                    LedgerReplaceService.UpsertResult result;
                    try {
                        result = replaceService.replace(report, sheet, run.rows(), perRowUnit, LedgerSource.SCRIPT);
                    } catch (IllegalArgumentException | IllegalStateException e) {
                        auditService.recordFailed(report.getId(), sheet.getId(), template.getId(), versionId,
                                LedgerSource.SCRIPT, e.getMessage());
                        throw new ConflictException("Không duyệt được: " + label + " có số liệu chưa hợp lệ — "
                                + e.getMessage() + " Cần sửa biểu trước khi duyệt; phiếu vẫn ở trạng thái chờ duyệt.");
                    }
                    auditService.recordSuccess(report.getId(), sheet.getId(), template.getId(), versionId,
                            LedgerSource.SCRIPT, result.added(), result.updated(), result.removed());
                }
            }
        }
    }

    /**
     * Xem trước: chạy CÙNG vòng {@code getInputData} như {@link #writeOnApprove} nhưng không ghi số
     * liệu, không ghi nhật ký — để màn duyệt báo trước "biểu nào đọc được bao nhiêu dòng".
     */
    @Transactional(readOnly = true)
    public PreviewResult preview(InputReport report, List<InputReportSheet> sheets) {
        List<SheetPreview> previews = new ArrayList<>();
        int total = 0;
        for (InputReportSheet sheet : sheets) {
            Template template = sheet.getTemplate();
            SheetRun run;
            try {
                run = runSheet(report, sheet);
            } catch (ServerScriptException e) {
                return new PreviewResult(total, previews, true, e.isTimeout(), template.getShortName(),
                        userMessage(sheetLabel(template), e));
            }
            int count = run.rows() == null ? 0 : run.rows().size();
            total += count;
            previews.add(new SheetPreview(sheet.getId(), template.getId(), template.getShortName(), count,
                    run.status() == RunStatus.SKIP, run.status() == RunStatus.NO_HOOK));
        }
        return new PreviewResult(total, previews, false, false, null, null);
    }

    // ------------------------------------------------------------------ chống cộng đôi

    /**
     * Từ chối duyệt nếu CÙNG biểu của CÙNG đơn vị (số liệu hoặc nộp) đã được duyệt ở một kỳ KHÁC
     * cùng năm mà khoảng thời gian giao nhau (vd 1a tháng 11 và 1a quý IV). Chỉ so cùng biểu —
     * nhiều biểu khác nhau trong một kỳ là bình thường. Kỳ thiếu mốc ngày thì không chặn oan.
     */
    void assertNoOverlappingApproved(InputReport report, List<InputReportSheet> sheets) {
        ReportPeriod period = report.getPeriod();
        if (period == null || report.getUnit() == null) {
            return;
        }
        LocalDate from = period.getFromDate();
        LocalDate to = period.getToDate();
        Integer year = period.getYear();
        if (from == null || to == null || to.isBefore(from) || year == null) {
            return;
        }
        Set<Long> templateIds = new LinkedHashSet<>();
        for (InputReportSheet sheet : sheets) {
            if (sheet.getTemplate() != null) {
                templateIds.add(sheet.getTemplate().getId());
            }
        }
        if (templateIds.isEmpty()) {
            return;
        }
        long conflicts = entryRepository.countOverlappingEffective(
                report.getUnit().getId(), report.getId(), templateIds, period.getId(), year, from, to,
                ReportStatus.APPROVED, ReportStatus.LOCKED);
        if (conflicts > 0) {
            throw new ConflictException("Không duyệt được: biểu của đơn vị này đã được duyệt ở một kỳ khác"
                    + " trùng khoảng thời gian, duyệt tiếp sẽ cộng trùng số liệu. Vui lòng liên hệ người quản trị"
                    + " để xử lý trùng kỳ.");
        }
    }

    // ------------------------------------------------------------------ nội bộ

    /** Chạy MỘT tờ biểu, dùng chung cho ghi thật và xem trước để hai đường không lệch nhau. */
    private SheetRun runSheet(InputReport report, InputReportSheet sheet) {
        // Đơn vị đã tuyên bố "không phát sinh": biểu KHÔNG có số liệu, kể cả số nhập dở còn nằm lại
        // trong workbook (cố ý giữ phòng khi đơn vị đổi ý).
        if (sheet.getCompletion() == SheetCompletion.NO_DATA) {
            return new SheetRun(RunStatus.SKIP, List.of());
        }
        String workbookJson = sheet.getDataJson();
        // Chưa nhập gì (kể cả workbook rỗng {"sheets":{}} do seed / khởi tạo ghi): không có gì để lưu.
        if (WorkbookJsonCellReader.isEmptyWorkbook(workbookJson)) {
            return new SheetRun(RunStatus.SKIP, List.of());
        }
        TemplateVersion version = sheet.getTemplateVersion();
        String scriptText = version == null ? null : version.getScriptText();
        // Biểu ĐÃ CÓ số liệu mà mẫu không có script: KHÔNG được duyệt với số liệu rỗng.
        if (scriptText == null || scriptText.isBlank()) {
            return new SheetRun(RunStatus.NO_HOOK, null);
        }
        Template template = sheet.getTemplate();
        ServerScriptRunner.GetInputDataResult result = scriptRunner.runGetInputData(
                workbookJson,
                List.of(new ServerScriptRunner.ScriptSource(sheetLabel(template), scriptText)),
                reportInfo(report, template, ReportStatus.APPROVED));
        // Hook xác định bằng việc THỰC SỰ chạy được, không bằng tìm chuỗi "getInputData" trong mã.
        if (result.executedHookCount() == 0) {
            return new SheetRun(RunStatus.NO_HOOK, null);
        }
        return new SheetRun(RunStatus.OK, result.rows());
    }

    static ServerScriptRunner.ReportInfo reportInfo(InputReport report, Template template, ReportStatus status) {
        ReportPeriod period = report.getPeriod();
        return new ServerScriptRunner.ReportInfo(
                String.valueOf(report.getId()),
                template == null ? null : template.getCode(),
                status == null ? null : status.name(),
                report.getUnit() == null ? null : report.getUnit().getBudgetCode(),
                report.getUnit() == null ? null : report.getUnit().getName(),
                template == null ? null : template.getShortName(),
                period == null ? null : period.getName(),
                period == null ? null : period.getYear());
    }

    /** "biểu 1a" — tên người dùng thấy (không dùng mã máy BM-…). */
    static String sheetLabel(Template template) {
        if (template == null) {
            return "biểu";
        }
        String shortName = template.getShortName();
        return shortName == null || shortName.isBlank() ? "biểu " + template.getName() : "biểu " + shortName;
    }

    private ConflictException approveFailure(String label, ServerScriptException e) {
        log.warn("Không ghi được số liệu {} khi duyệt: {}", label, e.getMessage());
        return new ConflictException("Không duyệt được: " + userMessage(label, e)
                + " Phiếu vẫn ở trạng thái chờ duyệt.");
    }

    /** Câu cho cán bộ: lỗi số liệu thì nêu lỗi; lỗi mẫu / quá giờ thì không lộ chi tiết kỹ thuật. */
    private static String userMessage(String label, ServerScriptException e) {
        return switch (e.kind()) {
            case DATA -> label + " có số liệu không đọc được (" + e.getMessage() + "). Cần sửa biểu trước khi duyệt.";
            case TIMEOUT -> label + " đọc số liệu quá lâu nên bị dừng. Vui lòng báo người quản trị mẫu biểu"
                    + " kiểm tra.";
            case SCRIPT -> label + " có số liệu không đọc được do mẫu biểu đang có lỗi. Vui lòng báo người quản"
                    + " trị mẫu biểu kiểm tra.";
        };
    }

    private static boolean isPerRowUnitTemplate(Template template) {
        String shortName = template == null ? null : template.getShortName();
        return shortName != null && PER_ROW_UNIT_SHORT_NAMES.contains(shortName.trim().toLowerCase());
    }

    private static boolean hasAnyUnitCode(List<ScriptRow> rows) {
        return rows != null && rows.stream()
                .anyMatch(row -> row.organizationCode() != null && !row.organizationCode().isBlank());
    }
}
