package com.dth.frw.module.asxh.dept.service;

import com.dth.frw.domain.asxh.dept.DeptChange;
import com.dth.frw.domain.asxh.dept.DeptChangeAction;
import com.dth.frw.domain.asxh.dept.DeptLedgerAudit;
import com.dth.frw.domain.asxh.dept.DeptLedgerLine;
import com.dth.frw.domain.asxh.dept.DeptLedgerSlot;
import com.dth.frw.domain.asxh.dept.DeptReport;
import com.dth.frw.domain.asxh.dept.DeptReportSheet;
import com.dth.frw.domain.asxh.dept.DeptSheetCompletion;
import com.dth.frw.domain.asxh.dept.MeasureKind;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.dept.query.DeptDataRow;
import com.dth.frw.module.asxh.dept.repo.DeptChangeRepository;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerAuditRepository;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerLineRepository;
import com.dth.frw.module.asxh.dept.repo.DeptReportRepository;
import com.dth.frw.module.asxh.dept.repo.DeptReportSheetRepository;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.Diff;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.Extracted;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.LineState;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.Plan;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.PreviewLine;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.RawLine;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.Totals;
import com.dth.frw.module.asxh.script.ServerScriptException;
import com.dth.frw.module.asxh.script.ServerScriptRunner;
import com.dth.frw.module.asxh.summary.query.UnitNode;
import com.dth.frw.module.asxh.summary.repo.SummaryQueries;
import com.dth.frw.module.asxh.summary.security.SummaryPermissions;
import com.dth.frw.module.asxh.summary.service.SummaryAggregator;
import com.dth.frw.module.asxh.template.service.TemplateScriptService;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.CurrentUser;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sở sửa số tổng hợp của một kỳ đã lưu (UC-55) và lịch sử / so sánh phiên bản (UC-56) — port
 * {@code DeptSheetService} bản Jmix (phần kỳ).
 *
 * <ul>
 *   <li><b>Lưu dữ liệu</b> ({@link #saveDraft}): cất bảng đang sửa lên máy chủ, CHƯA vào số liệu.</li>
 *   <li><b>Kiểm tra &amp; hoàn tất</b> ({@link #complete}): máy chủ chạy hook {@code getSummaryData}
 *       trên bảng đã cất, so với số liệu hiện hành; dòng đổi thì đóng dòng cũ, mở dòng mới ở phiên
 *       bản kế tiếp của năm, ghi nhật ký từng ô; rồi KHOÁ biểu.</li>
 *   <li><b>Sửa lại</b> ({@link #reopen}): mở khoá biểu; số đã lưu giữ nguyên tới lần hoàn tất sau.</li>
 * </ul>
 *
 * <p>Số Sở chốt KHÔNG do máy chủ đọc thẳng từ workbook: hook {@code getSummaryData} của script trích
 * (cùng khoá với số {@code afterInject} đã đổ). Biểu không có hook đó thì chỉ xem (UC-55 2a).
 */
@Service
public class DeptSheetService {

    private static final Logger log = LoggerFactory.getLogger(DeptSheetService.class);

    /** Tên hiển thị dòng "Sở điều chỉnh chung" khi trả số theo đơn vị. */
    public static final String MERGED_ADJUSTMENT_NAME = "Sở điều chỉnh chung";
    /** Lý do một lần lưu — cột ghi chú 1000 ký tự. */
    public static final int REASON_MAX_LENGTH = 1000;
    /** Biểu "nhập hộ" (mỗi dòng một đơn vị) — tổng hợp theo đơn vị thay vì một dòng mỗi chỉ tiêu. */
    private static final Set<String> PER_UNIT_SHORT_NAMES = Set.of("1g");

    private final DeptPeriodService periodService;
    private final DeptReportRepository reportRepository;
    private final DeptReportSheetRepository sheetRepository;
    private final DeptLedgerLineRepository lineRepository;
    private final DeptChangeRepository changeRepository;
    private final DeptLedgerAuditRepository auditRepository;
    private final DeptLedgerVersionService versionService;
    private final DeptYearLockService yearLockService;
    private final ServerScriptRunner scriptRunner;
    private final SummaryQueries queries;
    private final EntityManager entityManager;

    private final TemplateScriptService scriptService;

    public DeptSheetService(DeptPeriodService periodService,
                            DeptReportRepository reportRepository,
                            DeptReportSheetRepository sheetRepository,
                            DeptLedgerLineRepository lineRepository,
                            DeptChangeRepository changeRepository,
                            DeptLedgerAuditRepository auditRepository,
                            DeptLedgerVersionService versionService,
                            DeptYearLockService yearLockService,
                            ServerScriptRunner scriptRunner,
                            SummaryQueries queries,
                            EntityManager entityManager,
                            TemplateScriptService scriptService) {
        this.scriptService = scriptService;
        this.periodService = periodService;
        this.reportRepository = reportRepository;
        this.sheetRepository = sheetRepository;
        this.lineRepository = lineRepository;
        this.changeRepository = changeRepository;
        this.auditRepository = auditRepository;
        this.versionService = versionService;
        this.yearLockService = yearLockService;
        this.scriptRunner = scriptRunner;
        this.queries = queries;
        this.entityManager = entityManager;
    }

    // ------------------------------------------------------------------ kiểu trả về

    /** Một biểu của số liệu Sở kỳ. */
    public record SheetInfo(Long templateId, String templateCode, String shortName, String name,
                            Long templateVersionId, int displayOrder, DeptSheetCompletion completion,
                            boolean summaryHook, boolean pendingDraft, Instant draftUpdatedAt,
                            Instant completedAt, String completedBy) {
    }

    /**
     * Đầu số liệu Sở của kỳ + các biểu.
     *
     * @param createdAt lần lưu ĐẦU của kỳ
     * @param savedAt   giờ lưu của phiên bản HIỆN HÀNH ({@code null} nếu chưa có dòng lịch sử nào)
     * @param savedBy   người lưu phiên bản hiện hành
     */
    public record ReportDetail(Long id, Long periodId, String periodName, String periodKind, LocalDate fromDate,
                               LocalDate toDate, String periodStatus, int reportYear, int ledgerVersion,
                               int yearVersion, int sourceCount, boolean sourceStale, String yearLock,
                               boolean canEdit, Instant createdAt, String createdBy, Instant savedAt,
                               String savedBy, List<SheetInfo> sheets) {
    }

    /**
     * Mọi thứ màn cần để dựng một biểu của số liệu Sở: workbook mẫu đã ghim + bảng đang sửa dở + script +
     * số liệu (đổ vào {@code ctx.shared.rows}) + đường dẫn số liệu cho script ({@code summaryDataUrl}).
     *
     * @param version           phiên bản đang xem ({@code null} = hiện hành)
     * @param editable          Sở sửa được ngay bây giờ
     * @param readOnlyReason    vì sao chỉ xem ({@code null} khi sửa được)
     * @param groupByOrg        số theo từng đơn vị (biểu nhập hộ) thay vì một dòng mỗi chỉ tiêu
     */
    public record SheetRuntime(Long reportId, Long periodId, String periodName, int reportYear,
                               Long templateId, String sheetCode, String shortName, String sheetName,
                               String reportType, Long templateVersionId, String workbookJson,
                               String draftWorkbookJson, String scriptText, long revision,
                               DeptSheetCompletion completion, boolean summaryHook, boolean editable,
                               String readOnlyReason, boolean groupByOrg, Integer version, int ledgerVersion,
                               String summaryDataUrl, List<DeptDataRow> rows) {
    }

    public record DraftResult(Long reportId, Long templateId, long revision, Instant draftUpdatedAt) {
    }

    /** Một dòng sẽ đổi khi lưu — cho hộp xác nhận "Kiểm tra &amp; hoàn tất". */
    public record PendingChange(Long templateId, String sheetLabel, String indicatorCode, String indicatorName,
                                String unitName, BigDecimal currentQuantity, BigDecimal currentAmount,
                                BigDecimal quantity, BigDecimal amount) {
    }

    /** Kết quả lưu: phiên bản sau khi lưu, có sinh phiên bản mới không, các biểu có đổi số, số dòng đổi. */
    public record SaveResult(int ledgerVersion, boolean newVersion, List<String> changedSheets, int rowCount) {
    }

    /** Một phiên bản trong lịch sử của kỳ (gom mọi biểu cùng phiên bản). */
    public record VersionEntry(int versionNo, DeptChangeAction action, String actionLabel, List<String> sheets,
                               int rowCount, String note, String actor, Instant occurredAt, boolean current) {
    }

    /** Một chỉ tiêu (đã cộng qua đơn vị) ở hai phiên bản. */
    public record CompareRow(String indicatorCode, String indicatorName, Integer orderNo,
                             BigDecimal quantityA, BigDecimal amountA, BigDecimal quantityB, BigDecimal amountB,
                             boolean changed) {
    }

    /** Một ô theo đơn vị khác nhau giữa hai phiên bản. */
    public record UnitChange(String indicatorCode, String indicatorName, String unitName,
                             BigDecimal quantityA, BigDecimal amountA, BigDecimal quantityB, BigDecimal amountB) {
    }

    public record CompareSheet(Long templateId, String shortName, String name, List<CompareRow> rows,
                               List<UnitChange> unitChanges) {
    }

    public record CompareResult(int versionA, int versionB, List<CompareSheet> sheets) {
    }

    // ------------------------------------------------------------------ đọc

    @Transactional(readOnly = true)
    public ReportDetail detail(Long reportId) {
        DeptReport report = periodService.get(reportId);
        ReportPeriod period = report.getPeriod();
        String yearLock = yearLockService.lockReason(report.getReportYear()).orElse(null);
        List<SheetInfo> sheets = new ArrayList<>();
        for (DeptReportSheet sheet : sheetRepository.findByReport(reportId)) {
            sheets.add(sheetInfo(sheet));
        }
        VersionEntry current = versions(reportId).stream().filter(VersionEntry::current).findFirst().orElse(null);
        return new ReportDetail(report.getId(), period.getId(), period.getName(), period.getKind().name(),
                period.getFromDate(), period.getToDate(), period.getStatus().name(), report.getReportYear(),
                report.getLedgerVersion(), versionService.currentVersion(report.getReportYear()),
                report.getSourceCount(), periodService.isSourceStale(report), yearLock,
                yearLock == null && CurrentUser.has(SummaryPermissions.SUMMARY_WRITE),
                report.getCreatedAt(), report.getCreatedBy(),
                current == null ? null : current.occurredAt(), current == null ? null : current.actor(), sheets);
    }

    /**
     * Một biểu để dựng trên màn.
     *
     * @param sheetRef id biểu (số) hoặc mã nội bộ biểu
     * @param version  phiên bản cần xem; {@code null} = hiện hành
     */
    @Transactional(readOnly = true)
    public SheetRuntime runtime(Long reportId, String sheetRef, Integer version) {
        DeptReport report = periodService.get(reportId);
        DeptReportSheet sheet = sheetOf(report, sheetRef);
        checkVersion(report, version);
        Template template = sheet.getTemplate();
        String scriptText = scriptService.runtimeScriptText(sheet.getTemplateVersion());
        boolean hook = scriptService.hasSummaryHook(sheet.getTemplateVersion());
        String reason = readOnlyReason(report, sheet, hook, version);
        boolean perUnit = isPerUnit(template);
        List<DeptDataRow> rows = periodData(linesOf(sheet, version), null, perUnit);
        String dataUrl = "/api/dept_reports/" + report.getId() + "/sheets/" + template.getCode()
                + (version == null ? "" : "/versions/" + version) + "/data";
        return new SheetRuntime(report.getId(), report.getPeriod().getId(), report.getPeriod().getName(),
                report.getReportYear(), template.getId(), template.getCode(), template.getShortName(),
                template.getName(), template.getShortName(), sheet.getTemplateVersionId(),
                sheet.getTemplateVersion().getWorkbookJson(), version == null ? sheet.getDraftJson() : null,
                scriptText, sheet.getRevision(), sheet.getCompletion(), hook, reason == null, reason, perUnit,
                version, report.getLedgerVersion(), dataUrl, rows);
    }

    /**
     * Số liệu cho script {@code afterInject}: cùng dạng {@code /api/summary/data}.
     *
     * @param unitIds    {@code null} = mọi đơn vị (kể cả dòng điều chỉnh chung)
     * @param groupByOrg {@code true} = mỗi đơn vị một dòng; mặc định một dòng mỗi chỉ tiêu
     */
    @Transactional(readOnly = true)
    public List<DeptDataRow> data(Long reportId, String sheetRef, Integer version, Set<Long> unitIds,
                                  boolean groupByOrg) {
        DeptReport report = periodService.get(reportId);
        DeptReportSheet sheet = sheetOf(report, sheetRef);
        checkVersion(report, version);
        return periodData(linesOf(sheet, version), unitIds, groupByOrg);
    }

    /** Các phiên bản đã làm đổi số của kỳ, mới trước. */
    @Transactional(readOnly = true)
    public List<VersionEntry> versions(Long reportId) {
        DeptReport report = periodService.get(reportId);
        Map<Long, String> labels = sheetLabels(reportId);
        Map<Integer, List<DeptChange>> byVersion = new TreeMap<>(Comparator.reverseOrder());
        for (DeptChange change : changeRepository.findByReport(reportId)) {
            if (change.getVersionNo() != null) {
                byVersion.computeIfAbsent(change.getVersionNo(), key -> new ArrayList<>()).add(change);
            }
        }
        List<VersionEntry> result = new ArrayList<>();
        for (Map.Entry<Integer, List<DeptChange>> entry : byVersion.entrySet()) {
            List<DeptChange> group = entry.getValue();
            DeptChange first = group.getFirst();
            List<String> sheets = group.stream()
                    .map(change -> change.getTemplateId() == null ? null : labels.get(change.getTemplateId()))
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
            int rowCount = group.stream().mapToInt(change -> change.getRowCount() == null ? 0 : change.getRowCount())
                    .sum();
            result.add(new VersionEntry(entry.getKey(), first.getAction(),
                    DeptPeriodService.actionLabel(first.getAction()), sheets, rowCount, first.getNote(),
                    first.getActor(), first.getOccurredAt(), entry.getKey() == report.getLedgerVersion()));
        }
        return result;
    }

    /** So sánh số liệu MỌI biểu của kỳ ở hai phiên bản (UC-56). */
    @Transactional(readOnly = true)
    public CompareResult compare(Long reportId, int versionA, int versionB) {
        DeptReport report = periodService.get(reportId);
        checkVersion(report, versionA);
        checkVersion(report, versionB);
        List<CompareSheet> sheets = new ArrayList<>();
        for (DeptReportSheet sheet : sheetRepository.findByReport(reportId)) {
            List<LineState> left = states(lineRepository.findAt(sheet.getId(), versionA));
            List<LineState> right = states(lineRepository.findAt(sheet.getId(), versionB));
            sheets.add(compareSheet(sheet.getTemplate(), left, right, unitNames(sheet.getId(), versionA, versionB)));
        }
        return new CompareResult(versionA, versionB, sheets);
    }

    /** Các dòng sẽ đổi của MỘT biểu nếu hoàn tất bây giờ — KHÔNG ghi gì. */
    @Transactional(readOnly = true)
    public List<PendingChange> preview(Long reportId, String sheetRef) {
        DeptReport report = periodService.get(reportId);
        DeptReportSheet sheet = sheetOf(report, sheetRef);
        if (sheet.getDraftJson() == null || sheet.getDraftJson().isBlank()) {
            return List.of();
        }
        return pendingChanges(sheet, plan(report, sheet, null, false).plan().preview());
    }

    /** Các dòng sẽ đổi của mọi biểu đang sửa dở — KHÔNG ghi gì. */
    @Transactional(readOnly = true)
    public List<PendingChange> previewAll(Long reportId) {
        DeptReport report = periodService.get(reportId);
        List<PendingChange> result = new ArrayList<>();
        for (DeptReportSheet sheet : pendingSheets(reportId)) {
            result.addAll(pendingChanges(sheet, plan(report, sheet, null, false).plan().preview()));
        }
        return result;
    }

    // ------------------------------------------------------------------ ghi

    /**
     * Cất bảng đang sửa (chưa vào số liệu) — màn gọi khi đổi tab biểu giữa chừng, để không mất số đang gõ.
     * {@code revision} = số hiệu bản lưu màn đang giữ — khác thì từ chối (hai phiên sửa cùng biểu).
     */
    @Transactional
    public DraftResult saveDraft(Long reportId, String sheetRef, String workbookJson, long revision) {
        DeptReport report = lockReport(reportId);
        DeptReportSheet sheet = sheetOf(report, sheetRef);
        assertEditable(report);
        if (!scriptService.hasSummaryHook(sheet.getTemplateVersion())) {
            throw new ConflictException("Biểu này chưa được thiết lập để Sở sửa số trực tiếp.");
        }
        if (sheet.getRevision() != revision) {
            throw new ConflictException("Biểu " + sheet.getTemplate().getShortName()
                    + " vừa được lưu ở nơi khác. Bạn tải lại biểu rồi sửa tiếp.");
        }
        if (workbookJson == null || workbookJson.isBlank()) {
            throw new IllegalArgumentException("Bảng tính rỗng, chưa có gì để lưu.");
        }
        sheet.setDraftJson(workbookJson);
        sheet.setDraftUpdatedAt(Instant.now());
        sheet.setDraftUpdatedBy(CurrentUser.username().orElse(null));
        DeptReportSheet saved = sheetRepository.saveAndFlush(sheet);
        return new DraftResult(reportId, saved.getTemplate().getId(), saved.getRevision(), saved.getDraftUpdatedAt());
    }

    /**
     * "Lưu" số Sở sửa ở một biểu: trích số từ bảng đã cất, ghi phiên bản mới của năm nếu có ô đổi. Không
     * còn bước "hoàn tất / sửa lại" theo biểu — Sở sửa → Lưu là xong; lưu xong vẫn sửa tiếp được. Chưa có
     * bảng đã cất (không sửa gì) ⇒ không đổi gì.
     */
    @Transactional
    public SaveResult complete(Long reportId, String sheetRef, String reason) {
        String text = checkReason(reason);
        DeptReport report = lockReport(reportId);
        DeptReportSheet sheet = sheetOf(report, sheetRef);
        assertEditable(report);
        if (sheet.getDraftJson() == null || sheet.getDraftJson().isBlank()) {
            return new SaveResult(report.getLedgerVersion(), false, List.of(), 0);
        }
        PlannedSheet planned = plan(report, sheet, text, true);
        markCompleted(sheet);
        int before = report.getLedgerVersion();
        int version = write(report, List.of(planned), text, DeptChangeAction.SHEET_SAVED);
        int rows = planned.diff().rowCount();
        return new SaveResult(version, version != before,
                rows > 0 ? List.of(sheet.getTemplate().getShortName()) : List.of(), rows);
    }

    /** "Sửa lại": mở khoá biểu đã hoàn tất (số đã lưu giữ nguyên tới lần hoàn tất sau). */
    @Transactional
    public void reopen(Long reportId, String sheetRef) {
        DeptReport report = lockReport(reportId);
        DeptReportSheet sheet = sheetOf(report, sheetRef);
        assertEditable(report);
        if (sheet.getCompletion() != DeptSheetCompletion.COMPLETED) {
            return;
        }
        sheet.setCompletion(DeptSheetCompletion.IN_PROGRESS);
        sheet.setCompletedAt(null);
        sheet.setCompletedBy(null);
        sheetRepository.save(sheet);
    }

    /**
     * Lưu MỌI biểu đang sửa dở của kỳ trong một lần — một phiên bản mới, một lý do chung không bắt buộc.
     * Không dòng nào đổi thì không tiêu phiên bản, chỉ bỏ dấu "đang sửa".
     */
    @Transactional
    public SaveResult commitAll(Long reportId, String reason) {
        String text = checkReason(reason);
        DeptReport report = lockReport(reportId);
        assertEditable(report);
        List<PlannedSheet> planned = new ArrayList<>();
        for (DeptReportSheet sheet : pendingSheets(reportId)) {
            planned.add(plan(report, sheet, text, true));
        }
        int before = report.getLedgerVersion();
        int version = write(report, planned, text, DeptChangeAction.SHEET_SAVED);
        return new SaveResult(version, version != before,
                planned.stream().filter(p -> p.diff().rowCount() > 0)
                        .map(p -> p.sheet().getTemplate().getShortName()).toList(),
                planned.stream().mapToInt(p -> p.diff().rowCount()).sum());
    }

    /** Bỏ mọi bảng đang sửa dở của kỳ: lần mở sau dựng lại biểu từ số liệu hiện hành. */
    @Transactional
    public void discardPending(Long reportId) {
        DeptReport report = lockReport(reportId);
        assertEditable(report);
        for (DeptReportSheet sheet : pendingSheets(reportId)) {
            sheet.setDraftJson(null);
            sheet.setDraftUpdatedAt(null);
            sheet.setDraftUpdatedBy(null);
            sheetRepository.save(sheet);
        }
    }

    /**
     * Khôi phục số liệu MỌI biểu của kỳ về phiên bản {@code versionNo}, ghi thành phiên bản MỚI (các
     * phiên bản cũ vẫn giữ để đối chiếu). Phải không còn bảng sửa dở.
     */
    @Transactional
    public SaveResult restore(Long reportId, int versionNo, String reason) {
        String text = checkReason(reason);
        DeptReport report = lockReport(reportId);
        assertEditable(report);
        checkVersion(report, versionNo);
        assertRestorableVersion(report, versionNo);
        if (!pendingSheets(reportId).isEmpty()) {
            throw new ConflictException("Còn biểu đang sửa dở. Hoàn tất hoặc bỏ các số đang sửa trước rồi mới khôi phục.");
        }
        List<PlannedSheet> planned = new ArrayList<>();
        for (DeptReportSheet sheet : sheetRepository.findByReport(reportId)) {
            // Bảng đã cất mang số của bản hiện hành — sau khi khôi phục phải dựng lại từ số liệu.
            sheet.setDraftJson(null);
            List<DeptLedgerLine> current = lineRepository.findCurrent(sheet.getId());
            Map<String, LineState> targets = DeptLedgerPlanner.index(states(lineRepository.findAt(sheet.getId(), versionNo)));
            planned.add(new PlannedSheet(sheet, null, DeptLedgerPlanner.diff(states(current), targets), byId(current)));
        }
        String note = "Khôi phục số liệu phiên bản " + versionNo + (text == null ? "" : ": " + text);
        int before = report.getLedgerVersion();
        int version = write(report, planned, note, DeptChangeAction.RESTORED);
        return new SaveResult(version, version != before,
                planned.stream().filter(p -> p.diff().rowCount() > 0)
                        .map(p -> p.sheet().getTemplate().getShortName()).toList(),
                planned.stream().mapToInt(p -> p.diff().rowCount()).sum());
    }

    // ------------------------------------------------------------------ ghi số liệu

    /** Kế hoạch + thay đổi của một biểu, kèm dòng hiện hành theo id (để đóng). */
    private record PlannedSheet(DeptReportSheet sheet, Plan plan, Diff diff, Map<Long, DeptLedgerLine> currentById) {
    }

    /**
     * Ghi các biểu: có dòng đổi thì MỘT phiên bản mới của năm cho tất cả (mỗi biểu một mốc lịch sử cùng số
     * phiên bản). Bảng của mọi biểu giờ khớp số liệu (bỏ dấu "đang sửa").
     *
     * @return phiên bản của kỳ sau khi ghi
     */
    private int write(DeptReport report, List<PlannedSheet> planned, String note, DeptChangeAction action) {
        for (PlannedSheet entry : planned) {
            entry.sheet().setDraftUpdatedAt(null);
            entry.sheet().setDraftUpdatedBy(null);
            sheetRepository.save(entry.sheet());
        }
        if (planned.stream().allMatch(entry -> entry.diff().rowCount() == 0)) {
            return report.getLedgerVersion();
        }
        String actor = CurrentUser.username().orElse("hệ thống");
        Instant now = Instant.now();
        int version = versionService.nextVersion(report.getReportYear());
        Map<Long, ReportUnit> units = new HashMap<>();
        for (PlannedSheet entry : planned) {
            Diff diff = entry.diff();
            if (diff.rowCount() == 0) {
                continue;
            }
            DeptReportSheet sheet = entry.sheet();
            Long templateId = sheet.getTemplate().getId();
            DeptChange change = changeRepository.save(new DeptChange(report.getReportYear(), report.getId(),
                    templateId, action, version, diff.rowCount(), truncate(note), actor, now));
            for (int index = 0; index < diff.changed().size(); index++) {
                LineState target = diff.changed().get(index);
                LineState previous = diff.replaced().get(index);
                if (previous != null) {
                    close(entry.currentById(), previous, version);
                }
                ReportUnit unit = target.unitId() == null ? null
                        : units.computeIfAbsent(target.unitId(), id -> entityManager.getReference(ReportUnit.class, id));
                DeptLedgerLine line = new DeptLedgerLine(report, sheet, target.unitKey(), unit,
                        target.indicatorCode(), target.slot(), version);
                line.setIndicatorName(target.indicatorName());
                line.setMeasureKind(target.measureKind());
                line.setSourceQuantity(target.sourceQuantity());
                line.setSourceAmount(target.sourceAmount());
                line.setQuantity(target.quantity());
                line.setAmount(target.amount());
                line.setAllocatedAmount(target.allocatedAmount());
                line.setAdjustReason(target.reason());
                line.setOrderNo(target.orderNo());
                line.setChangeId(change.getId());
                lineRepository.save(line);
                if (previous == null || DeptLedgerPlanner.numbersChanged(previous, target)) {
                    auditRepository.save(audit(report, templateId, target.unitKey(), target.indicatorCode(),
                            target.slot(), previous == null ? DeptLedgerAudit.Action.ADDED : DeptLedgerAudit.Action.UPDATED,
                            previous, target, target.reason(), actor, now, change.getId()));
                }
            }
            for (LineState gone : diff.removed()) {
                close(entry.currentById(), gone, version);
                auditRepository.save(audit(report, templateId, gone.unitKey(), gone.indicatorCode(), gone.slot(),
                        DeptLedgerAudit.Action.REMOVED, gone, null, null, actor, now, change.getId()));
            }
        }
        report.setLedgerVersion(version);
        reportRepository.save(report);
        return version;
    }

    private void close(Map<Long, DeptLedgerLine> currentById, LineState state, int version) {
        DeptLedgerLine line = state.lineId() == null ? null : currentById.get(state.lineId());
        if (line != null) {
            line.setVersionTo(version);
            lineRepository.save(line);
        }
    }

    private static DeptLedgerAudit audit(DeptReport report, Long templateId, String unitKey, String indicatorCode,
                                         DeptLedgerSlot slot, DeptLedgerAudit.Action action, LineState before,
                                         LineState after, String reason, String actor, Instant now, Long changeId) {
        return new DeptLedgerAudit(report.getId(), templateId, unitKey, indicatorCode, slot, action,
                before == null ? null : before.quantity(), after == null ? null : after.quantity(),
                before == null ? null : before.amount(), after == null ? null : after.amount(),
                before == null ? null : before.allocatedAmount(), after == null ? null : after.allocatedAmount(),
                reason, actor, now, changeId);
    }

    // ------------------------------------------------------------------ lập kế hoạch

    /**
     * Chạy {@code getSummaryData} trên bảng đã cất rồi lập kế hoạch so với số liệu hiện hành.
     *
     * @param defaultReason  lý do chung cho mọi dòng đổi số
     * @param reasonOptional dòng thiếu lý do vẫn ghi
     */
    private PlannedSheet plan(DeptReport report, DeptReportSheet sheet, String defaultReason, boolean reasonOptional) {
        List<UnitNode> units = queries.units();
        List<Extracted> lines = DeptLedgerPlanner.extract(extract(report, sheet, units));
        Map<String, Long> unitIds = new HashMap<>();
        for (UnitNode unit : units) {
            unitIds.put(unit.budgetCode(), unit.id());
        }
        Set<String> unknown = new LinkedHashSet<>();
        for (Extracted line : lines) {
            if (!DeptLedgerLine.MERGED_UNIT_KEY.equals(line.unitKey()) && !unitIds.containsKey(line.unitKey())) {
                unknown.add(line.unitKey());
            }
        }
        if (!unknown.isEmpty()) {
            throw new IllegalArgumentException("Bảng có mã đơn vị không tồn tại: " + String.join(", ", unknown) + ".");
        }
        List<DeptLedgerLine> current = lineRepository.findCurrent(sheet.getId());
        List<LineState> currentStates = states(current);
        Plan plan = DeptLedgerPlanner.plan(lines, currentStates, unitIds, Map.of(), defaultReason, reasonOptional);
        if (!reasonOptional && !plan.missingReasons().isEmpty()) {
            // Xem trước: vẫn trả bảng; ghi thật luôn dùng reasonOptional = true (lý do chung không bắt buộc).
            log.debug("Có {} dòng điều chỉnh chưa có lý do ở biểu {}", plan.missingReasons().size(),
                    sheet.getTemplate().getShortName());
        }
        return new PlannedSheet(sheet, plan, DeptLedgerPlanner.diff(currentStates, plan.targets()), byId(current));
    }

    /** Chạy hook {@code getSummaryData} trên bảng Sở đã cất. */
    private List<RawLine> extract(DeptReport report, DeptReportSheet sheet, List<UnitNode> units) {
        String draft = sheet.getDraftJson();
        if (draft == null || draft.isBlank()) {
            throw new ConflictException("Biểu " + sheet.getTemplate().getShortName()
                    + " chưa có bảng đang sửa. Mở biểu, sửa số rồi bấm Lưu dữ liệu trước.");
        }
        Template template = sheet.getTemplate();
        ReportPeriod period = report.getPeriod();
        ServerScriptRunner.GetSummaryDataResult result;
        try {
            // Mọi kịch bản đang bật của phiên bản (thường: kịch bản đơn vị rồi kịch bản tổng hợp).
            result = scriptRunner.runGetSummaryData(draft,
                    scriptService.runtimeSources(sheet.getTemplateVersion()),
                    new ServerScriptRunner.ReportInfo(String.valueOf(report.getId()), template.getCode(), "DRAFT",
                            "", "", template.getShortName(), period.getName(), report.getReportYear()),
                    unitCodesByName(units));
        } catch (ServerScriptException e) {
            log.warn("Không trích được số liệu Sở biểu {} kỳ {}: {}", template.getShortName(), period.getName(),
                    e.getMessage());
            throw switch (e.kind()) {
                case DATA -> new IllegalArgumentException("Biểu " + template.getShortName()
                        + " có số liệu chưa hợp lệ: " + e.getMessage());
                case TIMEOUT -> new ConflictException("Biểu " + template.getShortName()
                        + " đọc số liệu quá lâu nên bị dừng. Vui lòng báo người quản trị mẫu biểu kiểm tra.");
                case MEMORY -> new ConflictException("Biểu " + template.getShortName()
                        + " có lượng dữ liệu quá lớn, máy chủ không đọc hết được nên đã dừng. Vui lòng báo người"
                        + " quản trị mẫu biểu kiểm tra.");
                case SCRIPT -> new ConflictException("Biểu " + template.getShortName()
                        + " chưa đọc được số liệu do mẫu biểu đang có lỗi. Vui lòng báo người quản trị mẫu biểu kiểm tra.");
            };
        }
        if (result.executedHookCount() == 0) {
            throw new ConflictException("Biểu này chưa được thiết lập để Sở sửa số trực tiếp.");
        }
        List<RawLine> rows = new ArrayList<>(result.rows().size());
        for (ServerScriptRunner.SummaryDataRow row : result.rows()) {
            rows.add(new RawLine(row.organizationCode(), row.indicatorCode(), row.indicatorName(), row.slot(),
                    row.quantity(), row.amount(), row.allocatedAmount(), row.orderNo()));
        }
        return rows;
    }

    /**
     * Tên đơn vị → mã cho {@code ctx.shared.orgCodeByName}. Tên trùng giữa hai đơn vị bị bỏ (không đoán) —
     * script gặp tên không dịch được phải tự báo lỗi.
     */
    private static Map<String, String> unitCodesByName(List<UnitNode> units) {
        Map<String, String> byName = new HashMap<>();
        Set<String> ambiguous = new HashSet<>();
        for (UnitNode unit : units) {
            if (unit.name() == null || unit.budgetCode() == null) {
                continue;
            }
            String name = unit.name().trim();
            if (byName.putIfAbsent(name, unit.budgetCode()) != null) {
                ambiguous.add(name);
            }
        }
        ambiguous.forEach(byName::remove);
        return byName;
    }

    // ------------------------------------------------------------------ số liệu kỳ

    /** Dòng số liệu của biểu ở phiên bản {@code version} ({@code null} = hiện hành). */
    private List<DeptLedgerLine> linesOf(DeptReportSheet sheet, Integer version) {
        return version == null ? lineRepository.findCurrent(sheet.getId()) : lineRepository.findAt(sheet.getId(), version);
    }

    /**
     * Số liệu kỳ dạng {@code /summary/data}: theo đơn vị (mỗi dòng số liệu một dòng; điều chỉnh chung thành
     * dòng {@code TONG_HOP} "Sở điều chỉnh chung") hoặc một dòng mỗi chỉ tiêu (đơn giá giữ một giá trị).
     */
    static List<DeptDataRow> periodData(List<DeptLedgerLine> ledger, Set<Long> unitIds, boolean groupByOrg) {
        List<DeptLedgerLine> rows = ledger.stream()
                .filter(row -> unitIds == null || (row.getUnitId() != null && unitIds.contains(row.getUnitId())))
                .sorted(Comparator.comparing((DeptLedgerLine row) -> row.getOrderNo() == null ? Integer.MAX_VALUE
                                : row.getOrderNo())
                        .thenComparing(DeptLedgerLine::getUnitKey))
                .toList();
        List<DeptDataRow> result = new ArrayList<>();
        if (groupByOrg) {
            for (DeptLedgerLine row : rows) {
                boolean merged = row.isMerged();
                result.add(new DeptDataRow(
                        merged ? SummaryAggregator.MERGED_CODE : row.getUnitKey(),
                        merged ? MERGED_ADJUSTMENT_NAME : row.getUnit() == null ? row.getUnitKey() : row.getUnit().getName(),
                        row.getIndicatorCode(), row.getIndicatorName(), row.getQuantity(), row.getAmount(),
                        row.getQuantity(), row.getQuantity(), measureKindName(row.getMeasureKind()), 1,
                        row.getAllocatedAmount(), row.getSourceQuantity(), row.getSourceAmount(),
                        DeptLedgerPlanner.isAdjusted(row.getSourceQuantity(), row.getSourceAmount(),
                                row.getQuantity(), row.getAmount()),
                        row.getAdjustReason(), row.getOrderNo(), row.getUnitId()));
            }
            return result;
        }
        Map<String, List<LineState>> byIndicator = new LinkedHashMap<>();
        for (DeptLedgerLine row : rows) {
            byIndicator.computeIfAbsent(row.getIndicatorCode(), key -> new ArrayList<>()).add(state(row));
        }
        for (List<LineState> group : byIndicator.values()) {
            LineState first = group.getFirst();
            Totals totals = DeptLedgerPlanner.totals(group, first.indicatorCode(), first.slot());
            Integer orderNo = group.stream().map(LineState::orderNo).filter(Objects::nonNull)
                    .min(Integer::compareTo).orElse(null);
            // Tên KHÔNG để null: script kiểm dòng số liệu chặt (organizationName là chuỗi).
            result.add(new DeptDataRow(SummaryAggregator.MERGED_CODE, SummaryAggregator.MERGED_NAME,
                    first.indicatorCode(), first.indicatorName(), totals.quantity(), totals.amount(),
                    totals.quantity(), totals.quantity(), measureKindName(totals.measureKind()), 1,
                    totals.allocatedAmount(), totals.sourceQuantity(), totals.sourceAmount(),
                    DeptLedgerPlanner.isAdjusted(totals.sourceQuantity(), totals.sourceAmount(),
                            totals.quantity(), totals.amount()),
                    totals.reason(), orderNo, null));
        }
        return result;
    }

    private static String measureKindName(MeasureKind kind) {
        return MeasureKind.orDefault(kind).name();
    }

    // ------------------------------------------------------------------ so sánh

    private CompareSheet compareSheet(Template template, List<LineState> left, List<LineState> right,
                                      Map<String, String> unitNames) {
        Map<String, String> names = new LinkedHashMap<>();
        Map<String, Integer> orders = new HashMap<>();
        for (List<LineState> side : List.of(left, right)) {
            for (LineState line : side) {
                names.putIfAbsent(line.indicatorCode(), line.indicatorName());
                if (line.orderNo() != null) {
                    orders.merge(line.indicatorCode(), line.orderNo(), Math::min);
                }
            }
        }
        List<CompareRow> rows = new ArrayList<>();
        for (Map.Entry<String, String> entry : names.entrySet()) {
            Totals a = DeptLedgerPlanner.totals(left, entry.getKey(), DeptLedgerSlot.ALL);
            Totals b = DeptLedgerPlanner.totals(right, entry.getKey(), DeptLedgerSlot.ALL);
            boolean changed = !DeptLedgerPlanner.sameNumber(a.quantity(), b.quantity())
                    || !DeptLedgerPlanner.sameNumber(a.amount(), b.amount());
            rows.add(new CompareRow(entry.getKey(), entry.getValue(), orders.get(entry.getKey()),
                    a.quantity(), a.amount(), b.quantity(), b.amount(), changed));
        }
        rows.sort(Comparator.comparing((CompareRow row) -> row.orderNo() == null ? Integer.MAX_VALUE : row.orderNo())
                .thenComparing(CompareRow::indicatorCode));

        Map<String, LineState> leftByKey = DeptLedgerPlanner.index(left);
        Map<String, LineState> rightByKey = DeptLedgerPlanner.index(right);
        Set<String> keys = new LinkedHashSet<>(leftByKey.keySet());
        keys.addAll(rightByKey.keySet());
        List<UnitChange> unitChanges = new ArrayList<>();
        for (String key : keys) {
            LineState a = leftByKey.get(key);
            LineState b = rightByKey.get(key);
            if (a != null && b != null && DeptLedgerPlanner.sameNumber(a.quantity(), b.quantity())
                    && DeptLedgerPlanner.sameNumber(a.amount(), b.amount())) {
                continue;
            }
            LineState row = b != null ? b : a;
            String unitName = row.merged() ? MERGED_ADJUSTMENT_NAME : unitNames.getOrDefault(row.unitKey(), row.unitKey());
            unitChanges.add(new UnitChange(row.indicatorCode(), row.indicatorName(), unitName,
                    a == null ? null : a.quantity(), a == null ? null : a.amount(),
                    b == null ? null : b.quantity(), b == null ? null : b.amount()));
        }
        return new CompareSheet(template.getId(), template.getShortName(), template.getName(), rows, unitChanges);
    }

    private Map<String, String> unitNames(Long sheetId, int versionA, int versionB) {
        Map<String, String> names = new HashMap<>();
        for (int version : new int[]{versionA, versionB}) {
            for (DeptLedgerLine line : lineRepository.findAt(sheetId, version)) {
                if (line.getUnit() != null) {
                    names.putIfAbsent(line.getUnitKey(), line.getUnit().getName());
                }
            }
        }
        return names;
    }

    // ------------------------------------------------------------------ tiện ích

    private SheetInfo sheetInfo(DeptReportSheet sheet) {
        Template template = sheet.getTemplate();
        return new SheetInfo(template.getId(), template.getCode(), template.getShortName(), template.getName(),
                sheet.getTemplateVersionId(), sheet.getDisplayOrder(), sheet.getCompletion(),
                scriptService.hasSummaryHook(sheet.getTemplateVersion()), sheet.hasPendingDraft(),
                sheet.getDraftUpdatedAt(), sheet.getCompletedAt(), sheet.getCompletedBy());
    }

    private String readOnlyReason(DeptReport report, DeptReportSheet sheet, boolean hook, Integer version) {
        if (version != null) {
            return "Đang xem phiên bản cũ — về bản hiện hành để sửa.";
        }
        String lock = yearLockService.lockReason(report.getReportYear()).orElse(null);
        if (lock != null) {
            return lock;
        }
        if (!hook) {
            return "Biểu này chưa được thiết lập để Sở sửa số trực tiếp.";
        }
        if (!CurrentUser.has(SummaryPermissions.SUMMARY_WRITE)) {
            return "Bạn chưa được giao quyền sửa số liệu tổng hợp.";
        }
        return null;
    }

    private List<PendingChange> pendingChanges(DeptReportSheet sheet, List<PreviewLine> preview) {
        Map<String, String> names = new HashMap<>();
        for (UnitNode unit : queries.units()) {
            names.put(unit.budgetCode(), unit.name());
        }
        Template template = sheet.getTemplate();
        List<PendingChange> result = new ArrayList<>();
        for (PreviewLine line : preview) {
            if (!line.changed()) {
                continue;
            }
            String unitName = line.merged() || DeptLedgerLine.MERGED_UNIT_KEY.equals(line.unitKey())
                    ? SummaryAggregator.MERGED_NAME : names.getOrDefault(line.unitKey(), line.unitKey());
            result.add(new PendingChange(template.getId(), template.getShortName(), line.indicatorCode(),
                    line.indicatorName(), unitName, line.currentQuantity(), line.currentAmount(), line.quantity(),
                    line.amount()));
        }
        return result;
    }

    private List<DeptReportSheet> pendingSheets(Long reportId) {
        return sheetRepository.findByReport(reportId).stream().filter(DeptReportSheet::hasPendingDraft).toList();
    }

    private Map<Long, String> sheetLabels(Long reportId) {
        Map<Long, String> labels = new HashMap<>();
        for (DeptReportSheet sheet : sheetRepository.findByReport(reportId)) {
            labels.put(sheet.getTemplate().getId(), sheet.getTemplate().getShortName());
        }
        return labels;
    }

    /** Biểu theo id (số) hoặc mã nội bộ. */
    private DeptReportSheet sheetOf(DeptReport report, String sheetRef) {
        if (sheetRef == null || sheetRef.isBlank()) {
            throw new ResourceNotFoundException("Biểu trong số liệu tổng hợp", sheetRef);
        }
        String ref = sheetRef.trim();
        Long templateId = ref.chars().allMatch(Character::isDigit) ? Long.valueOf(ref)
                : queries.templateByCode(ref).map(Template::getId).orElse(null);
        if (templateId == null) {
            throw new ResourceNotFoundException("Biểu trong số liệu tổng hợp", sheetRef);
        }
        return sheetRepository.findOne(report.getId(), templateId)
                .orElseThrow(() -> new ResourceNotFoundException("Biểu trong số liệu tổng hợp", sheetRef));
    }

    private DeptReport lockReport(Long reportId) {
        return reportRepository.lockById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Số liệu tổng hợp đã lưu của kỳ", reportId));
    }

    private void checkVersion(DeptReport report, Integer version) {
        if (version == null) {
            return;
        }
        int current = versionService.currentVersion(report.getReportYear());
        if (version < 1 || version > current) {
            throw new IllegalArgumentException("Số liệu năm " + report.getReportYear() + " không có phiên bản "
                    + version + ".");
        }
    }

    /**
     * Số phiên bản đánh chung cho CẢ NĂM, nên một phiên bản nhỏ hơn lần lưu đầu của kỳ vẫn qua được
     * {@link #checkVersion} — nhưng ở phiên bản đó kỳ chưa có dòng số liệu nào. Khôi phục về đó sẽ
     * đóng hết dòng hiện hành, tức xoá sạch số liệu kỳ dưới danh nghĩa "khôi phục". Chặn từ phiên bản
     * của lần lưu đầu (mốc sớm nhất trong lịch sử của kỳ) trở về trước.
     */
    private void assertRestorableVersion(DeptReport report, int versionNo) {
        Integer first = changeRepository.findByReport(report.getId()).stream()
                .map(DeptChange::getVersionNo)
                .filter(Objects::nonNull)
                .min(Integer::compare)
                .orElse(null);
        if (first != null && versionNo < first) {
            throw new ConflictException("Phiên bản " + versionNo + " có trước lần lưu số liệu đầu tiên của kỳ này"
                    + " nên không khôi phục được — khôi phục về đó sẽ xoá hết số liệu của kỳ. Hãy chọn một phiên"
                    + " bản trong lịch sử của kỳ (từ phiên bản " + first + " trở đi).");
        }
    }

    private void assertEditable(DeptReport report) {
        yearLockService.assertOpen(report.getReportYear());
    }

    private static void markCompleted(DeptReportSheet sheet) {
        sheet.setCompletion(DeptSheetCompletion.COMPLETED);
        sheet.setCompletedAt(Instant.now());
        sheet.setCompletedBy(CurrentUser.username().orElse(null));
    }

    private static String checkReason(String reason) {
        String text = DeptLedgerPlanner.trimToNull(reason);
        if (text != null && text.length() > REASON_MAX_LENGTH) {
            throw new IllegalArgumentException("Lý do dài quá " + REASON_MAX_LENGTH + " ký tự.");
        }
        return text;
    }

    private static String truncate(String note) {
        if (note == null || note.length() <= REASON_MAX_LENGTH) {
            return note;
        }
        return note.substring(0, REASON_MAX_LENGTH);
    }

    static boolean isPerUnit(Template template) {
        String shortName = template == null ? null : template.getShortName();
        return shortName != null && PER_UNIT_SHORT_NAMES.contains(shortName.trim().toLowerCase(Locale.ROOT));
    }

    static LineState state(DeptLedgerLine line) {
        return new LineState(line.getId(), line.getUnitKey(), line.getUnitId(), line.getIndicatorCode(),
                line.getIndicatorName(), line.getSlot(), line.getMeasureKind(), line.getSourceQuantity(),
                line.getSourceAmount(), line.getQuantity(), line.getAmount(), line.getAllocatedAmount(),
                line.getAdjustReason(), line.getOrderNo());
    }

    static List<LineState> states(List<DeptLedgerLine> lines) {
        List<LineState> result = new ArrayList<>(lines.size());
        for (DeptLedgerLine line : lines) {
            result.add(state(line));
        }
        return result;
    }

    private static Map<Long, DeptLedgerLine> byId(List<DeptLedgerLine> lines) {
        Map<Long, DeptLedgerLine> result = new HashMap<>();
        for (DeptLedgerLine line : lines) {
            result.put(line.getId(), line);
        }
        return result;
    }
}
