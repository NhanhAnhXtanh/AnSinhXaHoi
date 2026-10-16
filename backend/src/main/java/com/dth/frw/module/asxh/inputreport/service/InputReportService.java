package com.dth.frw.module.asxh.inputreport.service;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.inputreport.repo.InputReportRepository;
import com.dth.frw.module.asxh.inputreport.repo.InputReportSheetRepository;
import com.dth.frw.module.asxh.inputreport.repo.InputReportSpecifications;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.CurrentUser;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phiếu nhập: tra cứu, máy trạng thái nộp / duyệt / trả lại (UC-38, 41, 42, 43), và các thao
 * tác hàng loạt mà slice thiết lập gọi khi mở đợt, chốt đợt, thu hồi kỳ.
 *
 * <p>Port {@code QtInputReportTransitionService} + {@code ReportRevisionService} +
 * {@code ReportPeriodInputAccessService} của bản Jmix. Phần CHƯA port (ghi TODO tại chỗ):
 * chạy script {@code validate} trên máy chủ, ghi sổ cái bằng script {@code getInputData} khi
 * duyệt, xác nhận kho bạc + file đính kèm, khoá năm khi đã nộp báo cáo năm lên UBND, phân biệt
 * tài khoản đơn vị / tài khoản Sở (đang dựa hoàn toàn vào mã quyền).
 */
@Service
@Transactional(readOnly = true)
public class InputReportService {

    private static final Set<String> SORTABLE = Set.of(
            "id", "status", "revisionNo", "submittedAt", "approvedAt", "returnedAt", "createdAt", "updatedAt");

    // Kỳ mới trước (BR-33 lưới "kỳ mới nhất trước"), rồi phiếu mới trước.
    private static final Sort DEFAULT_SORT = Sort.by(
            Sort.Order.desc("period.fromDate"), Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    private static final int RETURN_REASON_MAX = 1000;

    /** Phiếu không tính khi xét "cặp (đơn vị, biểu) đã phát trong kỳ". */
    private static final Set<ReportStatus> NOT_ISSUED = EnumSet.of(ReportStatus.CANCELLED);

    /** Một dòng cần phát: đơn vị nhận biểu {@code template} với phiên bản đã chọn theo ngày mở đợt. */
    public record IssueRequest(ReportUnit unit, Template template, TemplateVersion version) {
    }

    /** Kết quả phát một đợt — ghi lại lên bản ghi đợt. */
    public record IssueResult(int unitCount, int reportCount, int sheetCount, int existingCount) {
    }

    /** Tiến độ "đã nhập xong {done}/{total} biểu". */
    public record Progress(int done, int total) {
        public static final Progress EMPTY = new Progress(0, 0);
    }

    private final InputReportRepository repository;
    private final InputReportSheetRepository sheetRepository;
    private final RowLevelSecurity rowLevel;
    // Slice số liệu đã lưu (LEDGER): kiểm tra phía máy chủ khi nộp + lưu số liệu khi duyệt.
    private final com.dth.frw.module.asxh.ledger.service.InputReportWorkflowHooks workflowHooks;

    public InputReportService(InputReportRepository repository,
                              InputReportSheetRepository sheetRepository,
                              RowLevelSecurity rowLevel,
                              com.dth.frw.module.asxh.ledger.service.InputReportWorkflowHooks workflowHooks) {
        this.repository = repository;
        this.sheetRepository = sheetRepository;
        this.rowLevel = rowLevel;
        this.workflowHooks = workflowHooks;
    }

    // ------------------------------------------------------------------ đọc

    // TODO: tài khoản đơn vị chỉ thấy phiếu của đơn vị mình (BR-33.1). Cần liên kết người dùng
    // ↔ ReportUnit rồi khai InputReport là @RowLevelResource; khi đó rowLevel.scope tự gập vào.
    public Page<InputReport> list(ListParams params) {
        return repository.findAll(
                rowLevel.scope(InputReport.class, Action.READ).and(InputReportSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public InputReport get(Long id) {
        return repository.findOne(rowLevel.byId(InputReport.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException("InputReport", id));
    }

    public List<InputReport> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(InputReport.class, Action.READ, ids));
    }

    /** Tiến độ của nhiều phiếu trong một câu truy vấn; phiếu không có biểu nào là 0/0. */
    public Map<Long, Progress> progress(Collection<Long> reportIds) {
        Map<Long, Progress> result = new HashMap<>();
        if (reportIds == null || reportIds.isEmpty()) {
            return result;
        }
        for (Object[] row : sheetRepository.countProgress(reportIds)) {
            Long reportId = (Long) row[0];
            int total = ((Number) row[1]).intValue();
            int done = row[2] == null ? 0 : ((Number) row[2]).intValue();
            result.put(reportId, new Progress(done, total));
        }
        return result;
    }

    // ------------------------------------------------------- máy trạng thái

    /**
     * Nộp phiếu (UC-38, UC-43): DRAFT / RETURNED → SUBMITTED, nộp cả phiếu một lần.
     *
     * <p>Thứ tự kiểm giữ như bản Jmix: trạng thái → kỳ còn mở → đủ biểu. Thiếu biểu là việc
     * người nộp tự sửa ngay được nên báo trước lỗi dữ liệu.
     */
    @Transactional
    public InputReport submit(Long id) {
        InputReport report = repository.findOne(rowLevel.byId(InputReport.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("InputReport", id));
        if (!report.getStatus().isEditable()) {
            throw new ConflictException("Phiếu đã nộp hoặc đã chốt nên không nộp lại được.");
        }
        requirePeriodOpen(report, "Đợt báo cáo không còn mở để nộp số liệu.");

        List<InputReportSheet> sheets = sheetRepository.findByReportId(report.getId());
        long pending = sheets.stream().filter(sheet -> !sheet.getCompletion().isDone()).count();
        if (pending > 0) {
            throw new ConflictException("Còn %d/%d biểu chưa đánh dấu đã nhập xong, chưa nộp được phiếu."
                    .formatted(pending, sheets.size()));
        }
        // Xác nhận kho bạc (BR-38.1) rồi chạy lại hook validate của mẫu trên máy chủ (BR-35.1).
        workflowHooks.beforeSubmit(report, sheets);

        report.setStatus(ReportStatus.SUBMITTED);
        report.setSubmittedAt(Instant.now());
        report.setSubmittedBy(currentUsername());
        report.setReturnReason(null);
        return repository.persist(report);
    }

    /**
     * Phê duyệt (UC-41): SUBMITTED → APPROVED, bất biến về sau.
     *
     * <p>Khoá dòng phiếu tới hết giao dịch: lần bấm thứ hai chờ rồi rớt ở kiểm tra trạng thái.
     */
    @Transactional
    public InputReport approve(Long id) {
        InputReport report = repository.findForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("InputReport", id));
        if (report.getStatus() != ReportStatus.SUBMITTED) {
            throw new ConflictException("Phiếu phải đang chờ duyệt mới phê duyệt được.");
        }
        // TODO: khoá năm — năm đã nộp báo cáo lên UBND thì không duyệt (UC-41 3e).
        // Chống cộng đôi + chạy getInputData từng tờ biểu (bỏ qua NO_DATA) + lưu số liệu, cùng
        // giao dịch: lỗi bất kỳ → 409, phiếu vẫn chờ duyệt.
        workflowHooks.onApprove(report, sheetRepository.findByReportId(report.getId()));
        report.setStatus(ReportStatus.APPROVED);
        report.setApprovedAt(Instant.now());
        report.setApprovedBy(currentUsername());
        return repository.persist(report);
    }

    /**
     * Trả lại (UC-42): đóng băng bản đang chờ duyệt thành {@code SUPERSEDED} và sinh phiên bản
     * kế tiếp ở {@code RETURNED}, chép nguyên mọi tờ biểu (số liệu và dấu hoàn tất).
     *
     * @return PHIÊN BẢN MỚI — màn hình cần id này để chỉ người dùng sang phiếu đang sống
     */
    @Transactional
    public InputReport returnReport(Long id, String reason) {
        String trimmed = reason == null ? "" : reason.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Vui lòng nhập lý do trả lại phiếu");
        }
        if (trimmed.length() > RETURN_REASON_MAX) {
            throw new IllegalArgumentException("Lý do trả lại tối đa " + RETURN_REASON_MAX + " ký tự");
        }

        InputReport current = repository.findForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("InputReport", id));
        if (current.getStatus() != ReportStatus.SUBMITTED) {
            throw new ConflictException("Phiếu phải đang chờ duyệt mới trả lại được.");
        }
        // TODO: khoá năm — năm đã nộp báo cáo lên UBND thì không trả lại (UC-42 3b).

        Instant now = Instant.now();
        String user = currentUsername();

        InputReport next = new InputReport(current.getUnit(), current.getPeriod(), current.getPublication());
        next.setRevisionNo(current.getRevisionNo() + 1);
        next.setPreviousRevision(current);
        next.setStatus(ReportStatus.RETURNED);
        next.setReturnReason(trimmed);
        next.setReturnedAt(now);
        next.setReturnedBy(user);
        InputReport savedNext = repository.persist(next);

        for (InputReportSheet source : sheetRepository.findByReportId(current.getId())) {
            InputReportSheet copy = new InputReportSheet(savedNext, source.getTemplate(), source.getTemplateVersion());
            copy.setDataJson(source.getDataJson());
            copy.setDataUpdatedAt(source.getDataUpdatedAt());
            copy.setDataUpdatedBy(source.getDataUpdatedBy());
            // Giữ dấu "đã nhập xong": đơn vị chỉ phải mở lại biểu bị chê (BR-42.1).
            copy.setCompletion(source.getCompletion());
            copy.setCompletedAt(source.getCompletedAt());
            copy.setCompletedBy(source.getCompletedBy());
            sheetRepository.persist(copy);
        }

        current.setStatus(ReportStatus.SUPERSEDED);
        current.setReturnReason(trimmed);
        current.setReturnedAt(now);
        current.setReturnedBy(user);
        repository.persist(current);
        return savedNext;
    }

    // ------------------------------------------- dùng bởi slice thiết lập

    /**
     * Phát phiếu cho một đợt (UC-24, UC-26) — phiếu gộp.
     *
     * <ul>
     *   <li>Cặp (đơn vị, biểu) đã phát ở bất kỳ phiếu nào của kỳ thì bỏ qua (BR-24.2, BR-26.3).</li>
     *   <li>Đơn vị còn phiếu DRAFT / RETURNED: biểu mới thành tờ biểu mới trong phiếu đó.</li>
     *   <li>Ngược lại (chưa có phiếu, hoặc phiếu đã nộp trở lên — bất biến): tạo phiếu mới của
     *       chính đợt này (BR-26.2).</li>
     * </ul>
     *
     * <p>Chạy trong giao dịch của người gọi: lỗi ở bất kỳ dòng nào huỷ cả đợt.
     */
    @Transactional
    public IssueResult issue(Publication publication, List<IssueRequest> requests) {
        ReportPeriod period = publication.getPeriod();
        Long periodId = period.getId();

        Set<String> issued = new HashSet<>();
        for (Object[] row : sheetRepository.findIssuedPairs(periodId, NOT_ISSUED)) {
            issued.add(pairKey((Long) row[0], (Long) row[1]));
        }
        Map<Long, InputReport> openByUnit = new LinkedHashMap<>();
        for (InputReport report : repository.findByPeriodAndStatuses(periodId, ReportStatus.EDITABLE)) {
            openByUnit.putIfAbsent(report.getUnit().getId(), report);
        }

        Set<Long> touchedUnits = new LinkedHashSet<>();
        int createdReports = 0;
        int createdSheets = 0;
        int existing = 0;
        for (IssueRequest request : requests) {
            Long unitId = request.unit().getId();
            touchedUnits.add(unitId);
            String key = pairKey(unitId, request.template().getId());
            if (!issued.add(key)) {
                existing++;
                continue;
            }
            InputReport report = openByUnit.get(unitId);
            if (report == null) {
                report = repository.persist(new InputReport(request.unit(), period, publication));
                openByUnit.put(unitId, report);
                createdReports++;
            }
            sheetRepository.persist(new InputReportSheet(report, request.template(), request.version()));
            createdSheets++;
        }
        repository.flush();
        return new IssueResult(touchedUnits.size(), createdReports, createdSheets, existing);
    }

    /** Các cặp (đơn vị, biểu) đã phát trong kỳ, dạng {@code "unitId:templateId"}. */
    public Set<String> issuedPairs(Long periodId) {
        Set<String> pairs = new HashSet<>();
        for (Object[] row : sheetRepository.findIssuedPairs(periodId, NOT_ISSUED)) {
            pairs.add(pairKey((Long) row[0], (Long) row[1]));
        }
        return pairs;
    }

    /** Tên các đơn vị còn phiếu chờ duyệt trong kỳ — chặn chốt đợt (UC-27 3a). */
    public List<String> unitsAwaitingReview(Long periodId) {
        return repository.findUnitNamesByPeriodAndStatus(periodId, ReportStatus.SUBMITTED);
    }

    /** Chốt đợt: khoá mọi phiếu DRAFT / RETURNED của kỳ (UC-27 bước 3.2). Trả số phiếu đã khoá. */
    @Transactional
    public int lockOpenReports(Long periodId) {
        return repository.updateStatusForPeriod(
                periodId, ReportStatus.EDITABLE, ReportStatus.LOCKED, Instant.now());
    }

    /**
     * Thu hồi kỳ (UC-29): xoá mọi phiếu và tờ biểu của kỳ, mọi trạng thái kể cả đã duyệt.
     *
     * <p>Bản Jmix xoá MỀM; ở đây xoá cứng. Số liệu đã lưu khi duyệt (sổ cái) đi theo phiếu
     * nhờ khoá ngoại ON DELETE CASCADE, nên không cần xoá riêng.
     */
    @Transactional
    public int deleteAllForPeriod(Long periodId) {
        repository.detachRevisionsForPeriod(periodId);
        sheetRepository.deleteForPeriod(periodId);
        return repository.deleteForPeriod(periodId);
    }

    // ------------------------------------------------------------- nội bộ

    /** Chỉ kỳ ĐANG MỞ mới nhập / nộp được, kể cả phiếu bị trả lại (BR-34.2, BR-43.1). */
    static void requirePeriodOpen(InputReport report, String message) {
        if (report.getPeriod().getStatus() != PeriodStatus.OPEN) {
            throw new ConflictException(message);
        }
        // TODO: khoá năm — năm của kỳ đã nộp báo cáo lên UBND thì khoá mọi kỳ của năm (UC-31).
    }

    static String currentUsername() {
        return CurrentUser.username().orElse(null);
    }

    private static String pairKey(Long unitId, Long templateId) {
        return unitId + ":" + templateId;
    }

    /** Danh sách id của một trang — để hỏi tiến độ một lần cho cả trang. */
    public static List<Long> idsOf(Collection<InputReport> reports) {
        List<Long> ids = new ArrayList<>(reports.size());
        for (InputReport report : reports) {
            ids.add(report.getId());
        }
        return ids;
    }
}
