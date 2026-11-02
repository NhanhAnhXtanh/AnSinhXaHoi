package com.dth.frw.module.asxh.inputreport.service;

import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.module.asxh.inputreport.repo.InputReportSheetRepository;
import com.dth.frw.module.asxh.inputreport.repo.InputReportSheetSpecifications;
import com.dth.frw.module.asxh.ledger.service.ReportSubmitValidationService;
import com.dth.frw.module.asxh.script.WorkbookJsonCellReader;
import com.dth.frw.module.asxh.template.service.TemplateScriptService;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tờ biểu: lưu số liệu (UC-34), hoàn tất (UC-35), không phát sinh (UC-36), sửa lại (UC-37).
 *
 * <p>Port {@code QtInputReportDraftService.saveDraftSheet} + {@code SheetCompletionService}.
 * Mọi thao tác ghi đều qua cùng một cổng {@link #loadEditable}: phiếu còn DRAFT / RETURNED
 * và kỳ đang mở — kiểm ở đây chứ không chỉ ở giao diện, vì phiếu đã nộp thì không ai được
 * động vào nữa.
 */
@Service
@Transactional(readOnly = true)
public class InputReportSheetService {

    private static final Set<String> SORTABLE = Set.of("id", "completion", "dataUpdatedAt", "completedAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("template.shortName"), Sort.Order.asc("id"));

    /** Không dồn quá nhiều lỗi vào một thông báo — người dùng sửa vài dòng đầu rồi đánh dấu lại. */
    private static final int MAX_REPORTED_ISSUES = 10;

    private final InputReportSheetRepository repository;
    private final RowLevelSecurity rowLevel;
    private final ReportSubmitValidationService validation;
    // Khoá năm theo báo cáo năm (slice dept, UC-60).
    private final DeptYearLockService yearLockService;

    private final TemplateScriptService scriptService;

    public InputReportSheetService(InputReportSheetRepository repository, RowLevelSecurity rowLevel,
                                   ReportSubmitValidationService validation,
                                   DeptYearLockService yearLockService,
                                   TemplateScriptService scriptService) {
        this.scriptService = scriptService;
        this.repository = repository;
        this.rowLevel = rowLevel;
        this.validation = validation;
        this.yearLockService = yearLockService;
    }

    public Page<InputReportSheet> list(ListParams params) {
        return repository.findAll(
                rowLevel.scope(InputReportSheet.class, Action.READ).and(InputReportSheetSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public InputReportSheet get(Long id) {
        return repository.findOne(rowLevel.byId(InputReportSheet.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException("InputReportSheet", id));
    }

    public List<InputReportSheet> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(InputReportSheet.class, Action.READ, ids));
    }

    /**
     * Tờ biểu kèm nội dung phiên bản mẫu đã ghim, nạp TRONG giao dịch (phiên bản là LAZY và
     * {@code open-in-view=false}).
     *
     * @param templateWorkbookJson workbook khung — chỉ khi tờ biểu chưa có số liệu
     * @param scriptText           kịch bản đang bật của phiên bản mẫu, dạng mảng JSON (rỗng nếu
     *                             mẫu không có kịch bản nào)
     */
    public record SheetContent(InputReportSheet sheet, String templateWorkbookJson, String scriptText) {
    }

    public SheetContent getWithContent(Long id) {
        InputReportSheet sheet = get(id);
        TemplateVersion version = sheet.getTemplateVersion();
        // Workbook rỗng (`"sheets":{}` — dữ liệu mẫu cũ) cũng coi như chưa nhập: gửi khung.
        boolean hasData = !WorkbookJsonCellReader.isEmptyWorkbook(sheet.getDataJson());
        return new SheetContent(
                sheet,
                hasData ? null : version.getWorkbookJson(),
                scriptService.runtimeScriptText(version));
    }

    /**
     * Lưu số liệu của biểu (UC-34). Chỉ ghi bản nháp của tờ biểu — không ghi sổ cái (BR-34.1).
     *
     * @param expectedVersion số hiệu bản lưu frontend đang cầm; khác bản trong CSDL nghĩa là
     *                        phiên khác đã lưu đè trước → từ chối (UC-34 5a). {@code null} bỏ
     *                        qua kiểm tra.
     */
    @Transactional
    public InputReportSheet saveData(Long id, String dataJson, Long expectedVersion) {
        InputReportSheet sheet = loadEditable(id, "lưu số liệu");
        if (sheet.getCompletion().isDone()) {
            throw new ConflictException(
                    "Biểu đã đánh dấu xong nên đang chỉ xem; bấm \"Sửa lại\" nếu cần nhập tiếp.");
        }
        if (expectedVersion != null && expectedVersion != sheet.getVersion()) {
            throw new ConflictException("Số liệu của biểu đã được lưu ở phiên làm việc khác. "
                    + "Hãy tải lại trang rồi nhập lại.");
        }
        // Trần 20MB như bản Jmix: chặn ở config/WorkbookBodySizeFilter (413) và @Size của SheetDataRequest.
        // Thân không đọc được thì không lưu: lưu vào là biểu hỏng, lần mở sau không hiện được số liệu.
        if (!WorkbookJsonCellReader.isReadableWorkbook(dataJson)) {
            throw new IllegalArgumentException("Số liệu của biểu không đúng định dạng nên chưa lưu được. "
                    + "Số bạn vừa nhập vẫn còn trên màn hình, bạn bấm Lưu lại. "
                    + "Nếu vẫn không lưu được, bạn báo cán bộ hỗ trợ của Sở.");
        }
        sheet.setDataJson(dataJson);
        sheet.setDataUpdatedAt(Instant.now());
        sheet.setDataUpdatedBy(InputReportService.currentUsername());
        if (sheet.getCompletion() == SheetCompletion.NOT_STARTED) {
            sheet.setCompletion(SheetCompletion.IN_PROGRESS);
        }
        InputReportSheet saved = repository.persist(sheet);
        // Đẩy xuống ngay để số hiệu bản lưu trả về là số mới, không phải số trước khi tăng.
        repository.flush();
        return saved;
    }

    /** Kiểm tra & hoàn tất (UC-35): biểu chuyển sang chỉ xem. */
    @Transactional
    public InputReportSheet complete(Long id) {
        InputReportSheet sheet = loadEditable(id, "đổi đánh dấu của biểu");
        String data = sheet.getDataJson();
        if (data == null || data.isBlank()) {
            throw new ConflictException("Biểu này chưa có số liệu. Hãy nhập số liệu rồi đánh dấu, "
                    + "hoặc chọn \"Không phát sinh số liệu\" nếu kỳ này đơn vị không có số liệu.");
        }
        // Cùng hàng rào như lúc nộp (BR-35.1): hook validate của phiên bản mẫu chạy trên bản đã
        // lưu; còn lỗi mức ERROR thì không đánh dấu xong được.
        List<String> errors = validation.validateSheet(sheet.getReport(), sheet);
        if (!errors.isEmpty()) {
            List<String> shown = errors.size() > MAX_REPORTED_ISSUES ? errors.subList(0, MAX_REPORTED_ISSUES) : errors;
            throw new ConflictException("Số liệu của biểu chưa hợp lệ (" + errors.size() + " lỗi). "
                    + "Hãy sửa rồi đánh dấu lại: " + String.join("; ", shown)
                    + (errors.size() > shown.size() ? "; …" : "."));
        }
        return mark(sheet, SheetCompletion.COMPLETED);
    }

    /** Không phát sinh số liệu (UC-36): không kiểm tra, vẫn tính là xong; số đã gõ được giữ lại. */
    @Transactional
    public InputReportSheet markNoData(Long id) {
        return mark(loadEditable(id, "đổi đánh dấu của biểu"), SheetCompletion.NO_DATA);
    }

    /** Sửa lại (UC-37): bỏ đánh dấu để nhập tiếp. */
    @Transactional
    public InputReportSheet reopen(Long id) {
        InputReportSheet sheet = loadEditable(id, "đổi đánh dấu của biểu");
        if (!sheet.getCompletion().isDone()) {
            // Đã đang nhập: không có gì để mở lại, trả nguyên trạng thay vì báo lỗi.
            return sheet;
        }
        sheet.setCompletion(sheet.getDataJson() == null || sheet.getDataJson().isBlank()
                ? SheetCompletion.NOT_STARTED
                : SheetCompletion.IN_PROGRESS);
        sheet.setCompletedAt(null);
        sheet.setCompletedBy(null);
        // TODO: nhật ký thay đổi đánh dấu (BR-35.2) cho lịch sử thao tác của phiếu (UC-44).
        return repository.persist(sheet);
    }

    private InputReportSheet mark(InputReportSheet sheet, SheetCompletion completion) {
        sheet.setCompletion(completion);
        sheet.setCompletedAt(Instant.now());
        sheet.setCompletedBy(InputReportService.currentUsername());
        // TODO: nhật ký thay đổi đánh dấu (BR-35.2).
        return repository.persist(sheet);
    }

    /**
     * Tờ biểu sau khi đã kiểm phiếu còn sửa được và kỳ đang mở.
     *
     * @param action cụm động từ ghép vào câu báo, ví dụ "lưu số liệu"
     */
    private InputReportSheet loadEditable(Long id, String action) {
        // Khoá dòng phiếu TRƯỚC khi nạp tờ biểu (cùng khoá với nộp): nạp tờ biểu trước thì phiếu đã
        // nằm trong phiên với trạng thái cũ, câu khoá không đọc lại nữa — lưu đè lọt sau khi phiếu
        // vừa nộp xong. Phạm vi kiểm ngay sau: tờ biểu ngoài phạm vi vẫn là 404.
        repository.lockReportOfSheet(id)
                .orElseThrow(() -> new ResourceNotFoundException("InputReportSheet", id));
        InputReportSheet sheet = repository.findOne(rowLevel.byId(InputReportSheet.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("InputReportSheet", id));
        InputReport report = sheet.getReport();
        if (!report.getStatus().isEditable()) {
            throw new ConflictException("Phiếu đã nộp hoặc đã chốt nên không " + action + " được nữa.");
        }
        InputReportService.requirePeriodOpen(report, "Đợt báo cáo không còn mở nên không " + action + " được.");
        InputReportService.requireYearOpen(yearLockService, report, action);
        return sheet;
    }
}
