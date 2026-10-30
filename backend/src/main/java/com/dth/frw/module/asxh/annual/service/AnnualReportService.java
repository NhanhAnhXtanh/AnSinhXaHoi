package com.dth.frw.module.asxh.annual.service;

import com.dth.frw.domain.asxh.annual.AnnualReport;
import com.dth.frw.domain.asxh.annual.AnnualReportAttachment;
import com.dth.frw.domain.asxh.annual.AnnualReportSheet;
import com.dth.frw.domain.asxh.annual.AnnualReportStatus;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.annual.repo.AnnualReportAttachmentRepository;
import com.dth.frw.module.asxh.annual.repo.AnnualReportRepository;
import com.dth.frw.module.asxh.annual.repo.AnnualReportSheetRepository;
import com.dth.frw.module.asxh.annual.security.AnnualReportPermissions;
import com.dth.frw.module.asxh.attachment.service.AttachmentStorage;
import com.dth.frw.module.asxh.dept.query.DeptDataRow;
import com.dth.frw.module.asxh.dept.query.DeptYearDataQuery;
import com.dth.frw.module.asxh.dept.query.DeptYearPeriod;
import com.dth.frw.module.asxh.summary.query.ScopeKind;
import com.dth.frw.module.asxh.summary.service.SummaryAggregationService;
import com.dth.frw.module.asxh.summary.service.SummaryReportService;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.SheetOption;
import com.dth.frw.module.asxh.summary.service.SummaryReportService.YearOverview;
import com.dth.frw.module.asxh.template.service.TemplateScriptService;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.CurrentUser;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phần ĐỌC của báo cáo năm (UC-59 kiểm trước khi nộp, UC-61 danh sách, UC-62 xem phiếu, UC-67 lịch
 * sử các lần nộp) — port phần đọc của {@code DeptReportService} / {@code DeptReportWorkflowService}
 * bản Jmix cho phiếu loại {@code YEAR}.
 *
 * <p>Số trong bảng biểu năm luôn đọc từ số liệu tổng hợp ở <b>phiên bản đã ghim</b> của phiếu
 * ({@link AnnualReport#getLedgerVersion()}) qua {@link DeptYearDataQuery} — nên phiếu cũ vẫn hiện
 * đúng số đã nộp dù Sở sửa kỳ về sau (BR-59.2, BR-62.1).
 *
 * <p>Không kiểm quyền ở đây — controller kiểm {@code annual_reports:*} bằng {@code @PreAuthorize}.
 */
@Service
@Transactional(readOnly = true)
public class AnnualReportService {

    /** Tên dòng gộp của biểu năm — cùng chữ màn Tổng hợp đang dùng. */
    private static final String ROLLUP_ORG_NAME = "Tổng hợp theo năm";
    private static final String MERGED_CODE = "TONG_HOP";

    /**
     * Kiểm trước khi nộp báo cáo năm (UC-59 bước 2) và tình trạng nộp của năm cho màn Tổng hợp.
     *
     * @param ledgerVersion    phiên bản số liệu năm sẽ được ghim
     * @param blocker          lý do KHÔNG nộp được ({@code null} = nộp được); câu cho người dùng
     * @param warnings         kỳ chưa lưu số liệu / thiếu biểu — chỉ cảnh báo, vẫn nộp được (2d)
     * @param unfinishedSheets biểu đang sửa dở ("biểu 1a của Quý I/2026") — chặn nộp (2c)
     * @param sheets           biểu tổng hợp năm sẽ ghim (phiên bản theo mốc 01/07)
     * @param latest           phiếu năm mới nhất ({@code null} = năm chưa nộp lần nào)
     */
    public record YearCheck(int year, int ledgerVersion, int savedPeriods, int totalPeriods, String lockReason,
                            String blocker, List<String> warnings, List<String> unfinishedSheets,
                            List<SheetOption> sheets, AnnualReport latest) {
    }

    /** Một phiếu năm kèm phần suy ra cho màn hình. */
    public record ReportView(AnnualReport report, boolean latest, int sheetCount, int attachmentCount,
                             List<String> actions) {
    }

    /**
     * Một biểu năm của phiếu để dựng bảng — cùng dạng {@code SummaryReportService.YearSheet} để script
     * tổng hợp năm chạy y nguyên, nhưng ở phiên bản mẫu + phiên bản số liệu ĐÃ GHIM.
     *
     * @param summaryDataUrl endpoint số liệu cho script ({@code ctx.shared.summaryDataUrl}) — đọc ở phiên
     *                       bản đã ghim, chỉ cần {@code annual_reports:read} (UBND không có quyền Tổng hợp)
     * @param a              năm cho script cũ ({@code ctx.shared.a/b}, a = b = năm)
     */
    public record SheetRuntime(Long reportId, int year, int revisionNo, Long templateId, String sheetCode,
                               String shortName, String sheetName, Long versionId, Integer versionNo,
                               String workbookJson, String scriptText, int ledgerVersion, String summaryDataUrl,
                               int a, int b, List<Map<String, Object>> rows) {
    }

    private static final Set<AnnualReportStatus> ACTIVE =
            EnumSet.of(AnnualReportStatus.SUBMITTED, AnnualReportStatus.APPROVED);

    private final AnnualReportRepository repository;
    private final AnnualReportSheetRepository sheetRepository;
    private final AnnualReportAttachmentRepository attachmentRepository;
    private final SummaryReportService summaryReports;
    private final SummaryAggregationService aggregation;
    private final DeptYearDataQuery yearData;
    private final AttachmentStorage storage;

    private final TemplateScriptService scriptService;

    public AnnualReportService(AnnualReportRepository repository,
                               AnnualReportSheetRepository sheetRepository,
                               AnnualReportAttachmentRepository attachmentRepository,
                               SummaryReportService summaryReports,
                               SummaryAggregationService aggregation,
                               DeptYearDataQuery yearData,
                               AttachmentStorage storage,
                               TemplateScriptService scriptService) {
        this.scriptService = scriptService;
        this.repository = repository;
        this.sheetRepository = sheetRepository;
        this.attachmentRepository = attachmentRepository;
        this.summaryReports = summaryReports;
        this.aggregation = aggregation;
        this.yearData = yearData;
        this.storage = storage;
    }

    // ------------------------------------------------------------------ danh sách / một phiếu

    /**
     * Phiếu năm, năm mới trước rồi phiếu mới trước.
     *
     * @param year   {@code null} = mọi năm
     * @param status {@code null} = mọi trạng thái
     */
    public List<ReportView> list(Integer year, AnnualReportStatus status) {
        List<AnnualReport> all = year == null ? repository.findAllOrdered() : repository.findByYear(year);
        Map<Integer, Integer> latestByYear = new HashMap<>();
        for (AnnualReport report : all) {
            latestByYear.merge(report.getReportYear(), report.getRevisionNo(), Math::max);
        }
        List<AnnualReport> rows = all.stream()
                .filter(report -> status == null || report.getStatus() == status)
                .toList();
        List<Long> ids = rows.stream().map(AnnualReport::getId).toList();
        Map<Long, Integer> sheetCounts = counts(ids.isEmpty() ? List.of() : sheetRepository.countByReports(ids));
        Map<Long, Integer> fileCounts = counts(ids.isEmpty() ? List.of() : attachmentRepository.countByReports(ids));
        List<ReportView> result = new ArrayList<>(rows.size());
        for (AnnualReport report : rows) {
            boolean latest = latestByYear.get(report.getReportYear()) == report.getRevisionNo();
            result.add(new ReportView(report, latest, sheetCounts.getOrDefault(report.getId(), 0),
                    fileCounts.getOrDefault(report.getId(), 0), actions(report, latest)));
        }
        return result;
    }

    public AnnualReport get(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Phiếu báo cáo năm", id));
    }

    /** Một phiếu kèm phần suy ra (mới nhất của năm chưa, số biểu, số file, thao tác được phép). */
    public ReportView view(AnnualReport report) {
        boolean latest = repository.maxRevision(report.getReportYear()) == report.getRevisionNo();
        return new ReportView(report, latest, sheetRepository.findByReport(report.getId()).size(),
                attachmentRepository.findByReport(report.getId()).size(), actions(report, latest));
    }

    public List<AnnualReportSheet> sheets(Long reportId) {
        return sheetRepository.findByReport(reportId);
    }

    /** Đầu phiếu + biểu (phiên bản mẫu đã nạp) + file phiếu nộp, trong một giao dịch đọc. */
    public record Detail(ReportView view, List<AnnualReportSheet> sheets, List<AnnualReportAttachment> attachments) {
    }

    public Detail detail(Long id) {
        AnnualReport report = get(id);
        List<AnnualReportSheet> sheets = sheetRepository.findByReport(id);
        List<AnnualReportAttachment> files = attachmentRepository.findByReport(id);
        boolean latest = repository.maxRevision(report.getReportYear()) == report.getRevisionNo();
        return new Detail(new ReportView(report, latest, sheets.size(), files.size(), actions(report, latest)),
                sheets, files);
    }

    /**
     * Thao tác người đang đăng nhập làm được trên phiếu — gợi ý cho giao diện bật nút; máy chủ vẫn kiểm
     * lại khi bấm. Sở và UBND dùng chung quyền quyết định (BR-61.2).
     */
    public static List<String> actions(AnnualReport report, boolean latest) {
        List<String> actions = new ArrayList<>();
        if (!latest || !CurrentUser.has(AnnualReportPermissions.ANNUAL_APPROVE)) {
            return actions;
        }
        if (report.getStatus() == AnnualReportStatus.SUBMITTED) {
            actions.add("approve");
            actions.add("return");
        } else if (report.getStatus() == AnnualReportStatus.APPROVED) {
            actions.add("reopen");
        }
        return actions;
    }

    /** Phiếu còn hiệu lực của năm (đang chờ / đã duyệt); {@code null} = nộp được phiếu mới. */
    public AnnualReport activeReport(int year) {
        List<AnnualReport> active = repository.findByYearAndStatusIn(year, ACTIVE);
        // Đã duyệt thắng chờ duyệt nếu (bất thường) có cả hai — BR-60.1.
        return active.stream().filter(report -> report.getStatus() == AnnualReportStatus.APPROVED).findFirst()
                .orElse(active.isEmpty() ? null : active.get(0));
    }

    /** Phiếu mới nhất của năm ở bất kỳ trạng thái nào; {@code null} = năm chưa nộp lần nào. */
    public AnnualReport latestReport(int year) {
        List<AnnualReport> reports = repository.findByYear(year);
        return reports.isEmpty() ? null : reports.get(0);
    }

    // ------------------------------------------------------------------ kiểm trước khi nộp

    /**
     * Kiểm trước khi nộp năm (UC-59 bước 2, port {@code checkSubmit}). Gọi trong giao dịch nộp SAU khi đã
     * khoá dòng của năm thì phiên bản trả về chính là phiên bản sẽ ghim.
     */
    public YearCheck check(int year) {
        SummaryReportService.checkYear(year);
        YearOverview overview = summaryReports.year(year);
        List<String> warnings = new ArrayList<>();
        for (DeptYearPeriod period : overview.periods()) {
            if (period.deptReportId() == null) {
                warnings.add(period.periodName() + ": chưa lưu số liệu tổng hợp nên chưa được tính vào báo cáo năm");
            } else if (!period.unsavedSheets().isEmpty()) {
                warnings.add(period.periodName() + ": số liệu đã lưu thiếu biểu "
                        + String.join(", ", period.unsavedSheets()));
            }
        }
        AnnualReport active = activeReport(year);
        String blocker = null;
        if (overview.ledgerVersion() < 1 || overview.savedPeriods() == 0) {
            blocker = "Năm " + year + " chưa có kỳ nào lưu số liệu tổng hợp — chốt đợt báo cáo ở Theo kỳ trước khi nộp.";
        } else if (active != null) {
            blocker = "Báo cáo năm " + year + " đã nộp (Phiếu " + active.getRevisionNo() + " — "
                    + (active.getStatus() == AnnualReportStatus.APPROVED ? "UBND đã duyệt" : "đang chờ UBND duyệt")
                    + "). Một năm chỉ nộp một phiếu; nộp lại được khi UBND trả lại hoặc mở lại phiếu đó.";
        } else if (!overview.unfinishedSheets().isEmpty()) {
            blocker = "Còn " + joinVi(overview.unfinishedSheets())
                    + " đang sửa dở. Hoàn tất các biểu này ở Theo kỳ rồi nộp báo cáo năm.";
        } else if (overview.sheets().isEmpty()) {
            blocker = "Năm " + year + " chưa có biểu tổng hợp năm nào được ban hành nên chưa nộp được.";
        } else if (overview.lockReason() != null) {
            // Năm đang khoá mà không có phiếu còn hiệu lực — dữ liệu khoá lệch; không cho nộp chồng.
            blocker = overview.lockReason();
        }
        return new YearCheck(year, overview.ledgerVersion(), overview.savedPeriods(), overview.totalPeriods(),
                overview.lockReason(), blocker, warnings, overview.unfinishedSheets(), overview.sheets(),
                latestReport(year));
    }

    // ------------------------------------------------------------------ bảng biểu năm

    /** Một biểu năm của phiếu, ở phiên bản mẫu và phiên bản số liệu đã ghim (UC-62 bước 3). */
    public SheetRuntime sheet(Long reportId, Long templateId) {
        AnnualReport report = get(reportId);
        AnnualReportSheet sheet = sheetRepository.findByReportAndTemplate(reportId, templateId)
                .orElseThrow(() -> new ResourceNotFoundException("Biểu của phiếu báo cáo năm", templateId));
        Template template = sheet.getTemplate();
        TemplateVersion version = sheet.getTemplateVersion();
        int year = report.getReportYear();
        return new SheetRuntime(report.getId(), year, report.getRevisionNo(), template.getId(), template.getCode(),
                template.getShortName(), template.getName(), version.getId(), version.getVersionNo(),
                version.getWorkbookJson(), scriptService.runtimeScriptText(version), report.getLedgerVersion(),
                dataUrl(report.getId()), year, year, rollupRows(year, report.getLedgerVersion()));
    }

    /** Đường dẫn số liệu cho script của phiếu ({@code ctx.shared.summaryDataUrl}). */
    public static String dataUrl(Long reportId) {
        return "/api/annual_reports/" + reportId + "/data";
    }

    /**
     * Số liệu năm ở phiên bản ĐÃ GHIM của phiếu — cùng tham số / dạng {@code /api/dept_years/{year}/data}
     * (script tổng hợp năm gọi qua {@code ctx.shared.summaryDataUrl}).
     */
    public List<DeptDataRow> data(Long reportId, LocalDate from, LocalDate to, String scopeKind, Long organizationId,
                                  String orgType, String block, String sourceSheetCode, boolean groupByUnit) {
        AnnualReport report = get(reportId);
        Set<Long> unitIds = aggregation.resolveScope(ScopeKind.parse(scopeKind), organizationId, orgType, block);
        Long templateId = aggregation.resolveTemplateCode(sourceSheetCode).orElse(null);
        if (templateId != null && templateId < 0) {
            return List.of();
        }
        return yearData.data(report.getReportYear(), report.getLedgerVersion(), from, to, unitIds, templateId,
                groupByUnit);
    }

    // ------------------------------------------------------------------ file phiếu nộp

    public List<AnnualReportAttachment> attachments(Long reportId) {
        get(reportId);
        return attachmentRepository.findByReport(reportId);
    }

    public AnnualReportAttachment attachment(Long reportId, Long attachmentId) {
        return attachmentRepository.findInReport(reportId, attachmentId)
                .orElseThrow(() -> new ResourceNotFoundException("File phiếu nộp", attachmentId));
    }

    /** Mở luồng đọc nội dung file; người gọi đóng luồng. */
    public InputStream openContent(AnnualReportAttachment attachment) {
        return storage.open(attachment.getStoragePath());
    }

    // ------------------------------------------------------------------ nội bộ

    /**
     * Dòng {@code ctx.shared.rows} cho biểu năm: mỗi chỉ tiêu hai dòng {@code <mã>#HK1} / {@code <mã>#HK2}
     * như màn Tổng hợp → Theo năm, nhưng ở phiên bản đã ghim.
     */
    private List<Map<String, Object>> rollupRows(int year, int version) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (DeptDataRow row : yearData.data(year, version, LocalDate.of(year, 1, 1), LocalDate.of(year, 6, 30),
                null, null, false)) {
            rows.add(tempRow(row.indicatorCode() + "#HK1", row.indicatorName(), row.quantity(), row.amount()));
        }
        for (DeptDataRow row : yearData.data(year, version, LocalDate.of(year, 7, 1), LocalDate.of(year, 12, 31),
                null, null, false)) {
            rows.add(tempRow(row.indicatorCode() + "#HK2", row.indicatorName(), row.quantity(), row.amount()));
        }
        return rows;
    }

    private static Map<String, Object> tempRow(String code, String name, BigDecimal quantity, BigDecimal amount) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("organizationCode", MERGED_CODE);
        row.put("organizationName", ROLLUP_ORG_NAME);
        row.put("indicatorCode", code);
        row.put("indicatorName", name == null ? code : name);
        row.put("quantity", quantity);
        row.put("amount", amount);
        return row;
    }

    private static Map<Long, Integer> counts(Collection<Object[]> rows) {
        Map<Long, Integer> result = new HashMap<>();
        for (Object[] row : rows) {
            result.put((Long) row[0], ((Number) row[1]).intValue());
        }
        return result;
    }

    /** ["a","b","c"] → "a, b và c". */
    static String joinVi(List<String> items) {
        if (items.size() <= 1) {
            return String.join("", items);
        }
        return String.join(", ", items.subList(0, items.size() - 1)) + " và " + items.get(items.size() - 1);
    }
}
