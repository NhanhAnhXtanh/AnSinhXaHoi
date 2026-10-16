package com.dth.frw.module.asxh.annual.service;

import com.dth.frw.domain.asxh.annual.AnnualReport;
import com.dth.frw.domain.asxh.annual.AnnualReportAttachment;
import com.dth.frw.domain.asxh.annual.AnnualReportSheet;
import com.dth.frw.domain.asxh.annual.AnnualReportStatus;
import com.dth.frw.domain.asxh.dept.DeptChangeAction;
import com.dth.frw.domain.asxh.dept.DeptYearLockState;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.annual.repo.AnnualReportAttachmentRepository;
import com.dth.frw.module.asxh.annual.repo.AnnualReportRepository;
import com.dth.frw.module.asxh.annual.repo.AnnualReportSheetRepository;
import com.dth.frw.module.asxh.annual.service.AnnualReportService.YearCheck;
import com.dth.frw.module.asxh.attachment.service.AttachmentFiles;
import com.dth.frw.module.asxh.attachment.service.AttachmentStorage;
import com.dth.frw.module.asxh.dept.service.DeptLedgerVersionService;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.module.asxh.summary.service.SummaryReportService;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.SheetOption;
import com.dth.frw.module.asxh.template.service.TemplateService;
import com.dth.frw.module.asxh.template.service.TemplateVersionService;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.CurrentUser;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Nộp báo cáo năm lên UBND và quyết định của UBND — port {@code DeptReportWorkflowService} bản Jmix.
 *
 * <ul>
 *   <li><b>Nộp / gửi lại</b> (UC-59, UC-66): lập "Phiếu n" ở Chờ UBND duyệt, ghim phiên bản số liệu
 *       tổng hợp hiện hành của năm và phiên bản mẫu các biểu năm, lưu số / ngày văn bản và file phiếu
 *       nộp, rồi KHOÁ NĂM ({@code DeptYearLockService.lock(SUBMITTED)}) — tất cả trong MỘT giao dịch,
 *       đã khoá dòng của năm trước khi chọn phiên bản ghim nên một lượt lưu số liệu không chen vào
 *       được.</li>
 *   <li><b>UBND duyệt</b> (UC-63): Chờ duyệt → Đã duyệt, năm khoá ở mức đã duyệt.</li>
 *   <li><b>UBND trả lại</b> (UC-64): Chờ duyệt → Trả lại kèm lý do, năm MỞ KHOÁ.</li>
 *   <li><b>Mở lại</b> (UC-65): Đã duyệt → Trả lại kèm lý do, năm mở khoá.</li>
 * </ul>
 * Mỗi mốc ghi một dòng lịch sử năm qua {@code DeptYearLockService.recordYearEvent}.
 *
 * <p>Quyền kiểm ở controller ({@code annual_reports:write} nộp, {@code annual_reports:approve} quyết
 * định — Sở và UBND tạm dùng chung, BR-61.2).
 */
@Service
public class AnnualReportWorkflowService {

    /** Một lần nộp cần ít file; 10 là trần phòng nhầm (port {@code MAX_ATTACHMENTS}). */
    public static final int MAX_ATTACHMENTS = 10;

    private static final DateTimeFormatter VI_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final int NOTE_MAX = 1000;

    /** Một file phiếu nộp gửi kèm lúc nộp. */
    public record SubmitFile(String fileName, byte[] content) {
    }

    private final AnnualReportRepository repository;
    private final AnnualReportSheetRepository sheetRepository;
    private final AnnualReportAttachmentRepository attachmentRepository;
    private final AnnualReportService reportService;
    private final DeptLedgerVersionService versionService;
    private final DeptYearLockService yearLockService;
    private final TemplateService templateService;
    private final TemplateVersionService templateVersionService;
    private final AttachmentStorage storage;

    public AnnualReportWorkflowService(AnnualReportRepository repository,
                                       AnnualReportSheetRepository sheetRepository,
                                       AnnualReportAttachmentRepository attachmentRepository,
                                       AnnualReportService reportService,
                                       DeptLedgerVersionService versionService,
                                       DeptYearLockService yearLockService,
                                       TemplateService templateService,
                                       TemplateVersionService templateVersionService,
                                       AttachmentStorage storage) {
        this.repository = repository;
        this.sheetRepository = sheetRepository;
        this.attachmentRepository = attachmentRepository;
        this.reportService = reportService;
        this.versionService = versionService;
        this.yearLockService = yearLockService;
        this.templateService = templateService;
        this.templateVersionService = templateVersionService;
        this.storage = storage;
    }

    // ------------------------------------------------------------------ nộp

    /**
     * Nộp (hoặc gửi lại) báo cáo năm: lập phiếu năm mới ghim phiên bản số liệu hiện hành và khoá năm.
     *
     * @throws IllegalArgumentException thiếu / sai số, ngày văn bản; quá số file; file không hợp lệ (→ 400)
     * @throws ConflictException        năm chưa có số liệu; đã có phiếu còn hiệu lực; còn biểu sửa dở; chưa
     *                                  có biểu tổng hợp năm (→ 409)
     */
    @Transactional
    public AnnualReport submit(int year, String docNo, LocalDate docDate, List<SubmitFile> files) {
        SummaryReportService.checkYear(year);
        String number = docNo == null ? "" : docNo.trim();
        if (number.isEmpty() || docDate == null) {
            throw new IllegalArgumentException("Cần nhập số và ngày văn bản phiếu nộp.");
        }
        if (number.length() > AnnualReport.DOC_NO_MAX_LENGTH) {
            throw new IllegalArgumentException("Số văn bản dài quá " + AnnualReport.DOC_NO_MAX_LENGTH + " ký tự.");
        }
        List<SubmitFile> uploads = files == null ? List.of() : files;
        if (uploads.size() > MAX_ATTACHMENTS) {
            throw new IllegalArgumentException("Mỗi lần nộp chỉ đính kèm tối đa " + MAX_ATTACHMENTS + " file.");
        }
        // Kiểm HẾT mọi file trước khi ghi file nào: file hỏng ở giữa danh sách không để lại file mồ côi.
        List<String> fileNames = new ArrayList<>(uploads.size());
        for (SubmitFile file : uploads) {
            fileNames.add(AttachmentFiles.validate(file.fileName(), file.content()));
        }

        // Khoá dòng của năm (cùng ổ khoá mọi lượt ghi số liệu Sở đi qua) TRƯỚC khi đọc phiên bản để ghim.
        versionService.lockYear(year);
        YearCheck check = reportService.check(year);
        if (check.blocker() != null) {
            throw new ConflictException(check.blocker());
        }

        int revisionNo = repository.maxRevision(year) + 1;
        AnnualReport report = new AnnualReport(year, revisionNo, check.ledgerVersion(), number, docDate);
        report.setStatus(AnnualReportStatus.SUBMITTED);
        report.setSubmittedAt(Instant.now());
        report.setSubmittedBy(CurrentUser.username().orElse(null));
        try {
            report = repository.saveAndFlush(report);
        } catch (DataIntegrityViolationException e) {
            // Chỉ mục "một năm một phiếu còn hiệu lực" — một người khác vừa nộp cùng lúc.
            throw new ConflictException("Báo cáo năm " + year + " vừa được nộp ở nơi khác. Tải lại trang để xem phiếu.");
        }

        int order = 0;
        for (SheetOption option : check.sheets()) {
            if (option.versionId() == null) {
                continue;
            }
            Template template = templateService.get(option.templateId());
            TemplateVersion version = templateVersionService.get(option.versionId());
            sheetRepository.save(new AnnualReportSheet(report, template, version, order++));
        }

        saveFiles(report, uploads, fileNames);

        yearLockService.lock(year, DeptYearLockState.SUBMITTED,
                "Báo cáo năm " + year + " đã nộp UBND (Phiếu " + revisionNo
                        + ") và đang chờ duyệt nên chưa sửa được số liệu.");
        yearLockService.recordYearEvent(year, report.getId(), DeptChangeAction.YEAR_SUBMITTED,
                report.getLedgerVersion(), note("Phiếu " + revisionNo + " — văn bản " + number + " ngày "
                        + VI_DATE.format(docDate)));
        return report;
    }

    // ------------------------------------------------------------------ UBND

    /** UBND phê duyệt (UC-63): Chờ duyệt → Đã duyệt; năm tiếp tục khoá ở mức đã duyệt. */
    @Transactional
    public AnnualReport approve(Long id) {
        AnnualReport report = loadForUpdate(id);
        if (report.getStatus() != AnnualReportStatus.SUBMITTED) {
            throw new ConflictException("Chỉ phê duyệt được báo cáo năm đang chờ UBND duyệt.");
        }
        report.setStatus(AnnualReportStatus.APPROVED);
        report.setDecidedAt(Instant.now());
        report.setDecidedBy(CurrentUser.username().orElse(null));
        report.setReturnReason(null);
        report.setReopened(false);
        report = repository.save(report);
        yearLockService.lock(report.getReportYear(), DeptYearLockState.APPROVED,
                "UBND đã duyệt báo cáo năm " + report.getReportYear() + " (Phiếu " + report.getRevisionNo()
                        + ") nên số liệu đã chốt, không sửa được. Muốn sửa thì UBND phải mở lại.");
        yearLockService.recordYearEvent(report.getReportYear(), report.getId(), DeptChangeAction.YEAR_APPROVED,
                report.getLedgerVersion(), "Phiếu " + report.getRevisionNo());
        return report;
    }

    /** UBND trả lại kèm lý do (UC-64): Chờ duyệt → Trả lại; phiếu dừng, năm mở khoá. */
    @Transactional
    public AnnualReport returnReport(Long id, String reason) {
        String text = requireReason(reason, "Cần ghi lý do trả lại.");
        AnnualReport report = loadForUpdate(id);
        if (report.getStatus() != AnnualReportStatus.SUBMITTED) {
            throw new ConflictException("Chỉ trả lại được báo cáo năm đang chờ UBND duyệt.");
        }
        return decideReturned(report, text, false);
    }

    /** Mở lại phiếu đã duyệt kèm lý do (UC-65): Đã duyệt → Trả lại; năm mở khoá để Sở sửa rồi gửi lại. */
    @Transactional
    public AnnualReport reopen(Long id, String reason) {
        String text = requireReason(reason, "Cần ghi lý do mở lại.");
        AnnualReport report = loadForUpdate(id);
        if (report.getStatus() != AnnualReportStatus.APPROVED) {
            throw new ConflictException("Chỉ mở lại được báo cáo năm UBND đã duyệt.");
        }
        return decideReturned(report, text, true);
    }

    // ------------------------------------------------------------------ nội bộ

    private AnnualReport decideReturned(AnnualReport report, String reason, boolean reopened) {
        report.setStatus(AnnualReportStatus.RETURNED);
        report.setReturnReason(reason);
        report.setReopened(reopened);
        report.setDecidedAt(Instant.now());
        report.setDecidedBy(CurrentUser.username().orElse(null));
        report = repository.save(report);
        yearLockService.unlock(report.getReportYear(), null);
        yearLockService.recordYearEvent(report.getReportYear(), report.getId(),
                reopened ? DeptChangeAction.YEAR_REOPENED : DeptChangeAction.YEAR_RETURNED,
                report.getLedgerVersion(), note("Phiếu " + report.getRevisionNo() + " — Lý do: " + reason));
        return report;
    }

    private AnnualReport loadForUpdate(Long id) {
        return repository.findForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Phiếu báo cáo năm", id));
    }

    private static String requireReason(String reason, String emptyMessage) {
        String text = reason == null ? "" : reason.trim();
        if (text.isEmpty()) {
            throw new IllegalArgumentException(emptyMessage);
        }
        if (text.length() > AnnualReport.REASON_MAX_LENGTH) {
            throw new IllegalArgumentException("Lý do dài quá " + AnnualReport.REASON_MAX_LENGTH + " ký tự.");
        }
        return text;
    }

    /**
     * Ghi file phiếu nộp. Giao dịch nộp huỷ (ở bất kỳ bước nào sau đây, kể cả lúc commit) thì xoá các file
     * đã ghi — huỷ giao dịch không xoá được file trên đĩa (UC-59 4c).
     */
    private void saveFiles(AnnualReport report, List<SubmitFile> uploads, List<String> fileNames) {
        if (uploads.isEmpty()) {
            return;
        }
        List<String> written = new ArrayList<>(uploads.size());
        boolean synced = TransactionSynchronizationManager.isSynchronizationActive();
        if (synced) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) {
                        written.forEach(storage::deleteQuietly);
                    }
                }
            });
        }
        String actor = CurrentUser.username().orElse(null);
        try {
            for (int index = 0; index < uploads.size(); index++) {
                SubmitFile file = uploads.get(index);
                String fileName = fileNames.get(index);
                String path = storage.save(file.content(), AttachmentFiles.extensionOf(fileName));
                written.add(path);
                AnnualReportAttachment attachment = new AnnualReportAttachment(report, fileName,
                        AttachmentFiles.contentTypeOf(fileName), file.content().length, path);
                attachment.setCreatedBy(actor);
                attachmentRepository.save(attachment);
            }
        } catch (RuntimeException e) {
            if (!synced) {
                written.forEach(storage::deleteQuietly);
            }
            throw e;
        }
    }

    private static String note(String text) {
        return text.length() > NOTE_MAX ? text.substring(0, NOTE_MAX) : text;
    }
}
