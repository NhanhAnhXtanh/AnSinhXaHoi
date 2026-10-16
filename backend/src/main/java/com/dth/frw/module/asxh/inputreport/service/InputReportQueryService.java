package com.dth.frw.module.asxh.inputreport.service;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.module.asxh.inputreport.api.dto.InputReportHistoryResponse;
import com.dth.frw.module.asxh.inputreport.api.dto.InputReportSummaryResponse;
import com.dth.frw.module.asxh.inputreport.repo.InputReportRepository;
import com.dth.frw.module.asxh.inputreport.repo.InputReportSheetRepository;
import com.dth.frw.module.asxh.inputreport.repo.InputReportSpecifications;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

/**
 * Các câu hỏi chỉ đọc của hai màn danh sách phiếu và hộp lịch sử: số đếm thẻ lọc nhanh, lựa
 * chọn cho ô lọc, tên đơn vị cha, lịch sử phiên bản / thao tác (UC-33, UC-39, UC-44).
 *
 * <p>Tách khỏi {@link InputReportService} để máy trạng thái ở đó (nơi các hook ghi số liệu,
 * kiểm tra khi nộp, file kho bạc được chèn vào) không phình thêm phần chỉ đọc.
 */
@Service
@Transactional(readOnly = true)
public class InputReportQueryService {

    /** Thứ tự các khoá trạng thái hiển thị trả về ở {@code counts}. */
    public static final List<String> DISPLAY_KEYS = List.of(
            InputReportSpecifications.DISPLAY_DRAFT,
            InputReportSpecifications.DISPLAY_OVERDUE,
            "returned",
            "submitted",
            "approved",
            "locked");

    /** Tham số lọc trạng thái — bỏ đi khi đếm, vì số trên thẻ phải đếm trong phạm vi các lọc KHÁC. */
    private static final Set<String> STATUS_PARAMS = Set.of("status", "status_ne", "display");

    /** Chặn vòng lặp khi dữ liệu chuỗi phiên bản hỏng (không bao giờ nên chạm tới). */
    private static final int MAX_REVISIONS = 200;

    private final InputReportRepository repository;
    private final InputReportSheetRepository sheetRepository;
    private final InputReportService reportService;
    private final RowLevelSecurity rowLevel;

    public InputReportQueryService(InputReportRepository repository,
                                   InputReportSheetRepository sheetRepository,
                                   InputReportService reportService,
                                   RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.sheetRepository = sheetRepository;
        this.reportService = reportService;
        this.rowLevel = rowLevel;
    }

    // ------------------------------------------------------------ số đếm

    /**
     * Số đếm cho thẻ lọc nhanh + lựa chọn ô Kỳ / Bộ biểu mẫu.
     *
     * <p>Đếm theo MỌI lọc của màn trừ lọc trạng thái — thẻ "Chờ duyệt: 5" phải là số phiếu
     * chờ duyệt trong kỳ / khối / ô tìm đang chọn, bất kể thẻ nào đang bật.
     */
    public InputReportSummaryResponse summary(MultiValueMap<String, String> query) {
        MultiValueMap<String, String> withoutStatus = new LinkedMultiValueMap<>();
        query.forEach((key, values) -> {
            if (!STATUS_PARAMS.contains(key)) {
                withoutStatus.put(key, values);
            }
        });
        ListParams params = new ListParams(withoutStatus);
        Specification<InputReport> base = rowLevel.scope(InputReport.class, Action.READ)
                .and(InputReportSpecifications.from(params));

        Map<String, Long> counts = new LinkedHashMap<>();
        for (String key : DISPLAY_KEYS) {
            Specification<InputReport> display = InputReportSpecifications.displayKeySpec(key);
            counts.put(key, repository.count(base.and(display)));
        }
        long total = repository.count(base);

        Integer year = yearOf(withoutStatus);
        List<InputReportSummaryResponse.PeriodOption> periods = new ArrayList<>();
        List<InputReportSummaryResponse.TemplateSetOption> sets = new ArrayList<>();
        List<InputReportSummaryResponse.UnitOption> districts = new ArrayList<>();
        if (year != null) {
            for (ReportPeriod period : repository.findPeriodsOfYear(year)) {
                periods.add(new InputReportSummaryResponse.PeriodOption(
                        period.getId(), period.getName(), period.getFromDate(), period.getToDate(),
                        period.getStatus()));
            }
            for (Object[] row : sheetRepository.findTemplateSetsOfYear(year)) {
                sets.add(new InputReportSummaryResponse.TemplateSetOption((Long) row[0], (String) row[1]));
            }
            for (Object[] row : repository.findParentUnitsOfYear(year)) {
                districts.add(new InputReportSummaryResponse.UnitOption((Long) row[0], (String) row[1]));
            }
        }
        return new InputReportSummaryResponse(total, counts, periods, sets, districts);
    }

    /** Tên đơn vị cha theo id đơn vị, cho cả một trang phiếu trong một câu truy vấn. */
    public Map<Long, String> parentNames(Collection<Long> reportIds) {
        Map<Long, String> names = new HashMap<>();
        if (reportIds == null || reportIds.isEmpty()) {
            return names;
        }
        for (Object[] row : repository.findParentNames(reportIds)) {
            names.put((Long) row[0], (String) row[1]);
        }
        return names;
    }

    // ------------------------------------------------------------ lịch sử

    /**
     * Lịch sử phiên bản + thao tác của phiếu (UC-44), tính từ BẤT KỲ phiên bản nào trong chuỗi.
     *
     * <p>Mốc của tờ biểu chỉ lấy khi xảy ra SAU lúc phiên bản đó được tạo: trả lại chép nguyên
     * tờ biểu (kể cả dấu lưu / hoàn tất) sang bản mới, lấy cả bản chép sẽ nhân đôi mốc cũ.
     */
    public InputReportHistoryResponse history(Long id) {
        List<InputReport> chain = chainOf(reportService.get(id));

        List<InputReportHistoryResponse.Revision> revisions = new ArrayList<>(chain.size());
        List<InputReportHistoryResponse.Event> events = new ArrayList<>();
        for (InputReport revision : chain) {
            revisions.add(new InputReportHistoryResponse.Revision(
                    revision.getId(),
                    revision.getRevisionNo(),
                    revision.getStatus(),
                    revision.getCreatedAt(),
                    revision.getSubmittedAt(),
                    revision.getSubmittedBy(),
                    revision.getApprovedAt(),
                    revision.getApprovedBy(),
                    revision.getReturnedAt(),
                    revision.getReturnedBy(),
                    revision.getReturnReason()));
            collectEvents(revision, events);
        }
        revisions.sort(Comparator.comparingInt(InputReportHistoryResponse.Revision::revisionNo).reversed());
        events.sort(Comparator.comparing(InputReportHistoryResponse.Event::at,
                Comparator.nullsLast(Comparator.naturalOrder())).reversed());
        return new InputReportHistoryResponse(revisions, events);
    }

    /** Chuỗi phiên bản từ bản đầu tới bản mới nhất. */
    private List<InputReport> chainOf(InputReport start) {
        InputReport oldest = start;
        Set<Long> seen = new HashSet<>();
        seen.add(oldest.getId());
        while (oldest.getPreviousRevision() != null && seen.size() < MAX_REVISIONS) {
            oldest = oldest.getPreviousRevision();
            if (!seen.add(oldest.getId())) {
                break;
            }
        }

        List<InputReport> chain = new ArrayList<>();
        chain.add(oldest);
        Set<Long> inChain = new HashSet<>();
        inChain.add(oldest.getId());
        InputReport current = oldest;
        while (chain.size() < MAX_REVISIONS) {
            List<InputReport> next = repository.findNextRevisions(current.getId());
            if (next.isEmpty() || !inChain.add(next.getFirst().getId())) {
                break;
            }
            current = next.getFirst();
            chain.add(current);
        }
        return chain;
    }

    private void collectEvents(InputReport revision, List<InputReportHistoryResponse.Event> events) {
        int no = revision.getRevisionNo();
        if (no == 1) {
            events.add(event("ISSUED", revision.getCreatedAt(), null, no, null, null, false));
        }
        if (revision.getSubmittedAt() != null) {
            events.add(event("SUBMITTED", revision.getSubmittedAt(), revision.getSubmittedBy(), no, null, null, false));
        }
        // Trả lại ghi trên CẢ bản cũ lẫn bản mới; chỉ lấy ở bản cũ để không nhân đôi.
        if (revision.getStatus() == ReportStatus.SUPERSEDED && revision.getReturnedAt() != null) {
            events.add(event("RETURNED", revision.getReturnedAt(), revision.getReturnedBy(), no, null,
                    revision.getReturnReason(), false));
        }
        if (revision.getApprovedAt() != null) {
            events.add(event("APPROVED", revision.getApprovedAt(), revision.getApprovedBy(), no, null, null, false));
        }
        if (revision.getStatus() == ReportStatus.LOCKED || revision.getStatus() == ReportStatus.CANCELLED) {
            // Chốt / huỷ không có cột thời điểm riêng: lấy lần sửa cuối của phiếu.
            Instant at = revision.getUpdatedAt() != null ? revision.getUpdatedAt() : revision.getCreatedAt();
            events.add(event(revision.getStatus().name(), at, null, no, null, null, true));
        }

        Instant createdAt = revision.getCreatedAt();
        for (InputReportSheet sheet : sheetRepository.findByReportId(revision.getId())) {
            String code = sheet.getTemplate().getShortName();
            if (after(sheet.getDataUpdatedAt(), createdAt)) {
                events.add(event("SHEET_SAVED", sheet.getDataUpdatedAt(), sheet.getDataUpdatedBy(), no, code,
                        null, false));
            }
            if (sheet.getCompletion().isDone() && after(sheet.getCompletedAt(), createdAt)) {
                String action = sheet.getCompletion() == SheetCompletion.NO_DATA ? "SHEET_NO_DATA" : "SHEET_COMPLETED";
                events.add(event(action, sheet.getCompletedAt(), sheet.getCompletedBy(), no, code, null, false));
            }
        }
    }

    private static boolean after(Instant at, Instant reference) {
        return at != null && (reference == null || at.isAfter(reference));
    }

    private static InputReportHistoryResponse.Event event(String action, Instant at, String by, int revisionNo,
                                                          String sheet, String note, boolean derived) {
        return new InputReportHistoryResponse.Event(action, at, by, revisionNo, sheet, note, derived);
    }

    private static Integer yearOf(MultiValueMap<String, String> query) {
        String raw = query.getFirst("year");
        if (raw == null || raw.isBlank()) {
            raw = query.getFirst("period.calendar.year");
        }
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
