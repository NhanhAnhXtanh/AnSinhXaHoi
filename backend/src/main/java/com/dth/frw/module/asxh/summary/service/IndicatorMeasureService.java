package com.dth.frw.module.asxh.summary.service;

import com.dth.frw.domain.asxh.dept.IndicatorMeasure;
import com.dth.frw.domain.asxh.dept.MeasureKind;
import com.dth.frw.module.asxh.ledger.query.EffectiveLedgerQuery;
import com.dth.frw.module.asxh.ledger.query.IndicatorUsage;
import com.dth.frw.module.asxh.summary.repo.IndicatorMeasureRepository;
import com.dth.frw.shared.web.ListParams;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Danh mục chỉ tiêu + bản chất đã khai (màn "Bản chất chỉ tiêu", UC-50 / BR-50.3).
 *
 * <p>Bản React chưa có bảng danh mục chỉ tiêu ({@code QT_CRITERION} của bản Jmix), nên danh mục là
 * HỢP của hai nguồn: mọi mã chỉ tiêu đã có trong số liệu còn hiệu lực (qua {@link EffectiveLedgerQuery}
 * của slice số liệu — mã do script {@code getInputData} của mẫu sinh ra) và mọi mã đã khai ở
 * {@code asxh_indicator_measures} (kể cả mã chưa có số liệu, vd khai trước khi kỳ đầu được duyệt).
 *
 * <p>Danh mục cỡ vài trăm mã nên lọc / phân trang trong bộ nhớ.
 */
@Service
@Transactional(readOnly = true)
public class IndicatorMeasureService {

    /** Giá trị lọc "chưa khai" của tham số {@code measureKind}. */
    public static final String UNSET = "UNSET";

    /** Số mã tối đa một lần khai — đủ cho cả danh mục, chặn thân yêu cầu vô hạn. */
    public static final int MAX_CODES_PER_UPDATE = 1_000;

    private static final int NOTE_MAX_LENGTH = 1_000;
    private static final Locale VI = Locale.forLanguageTag("vi");

    private final IndicatorMeasureRepository repository;
    private final EffectiveLedgerQuery ledgerQuery;

    public IndicatorMeasureService(IndicatorMeasureRepository repository, EffectiveLedgerQuery ledgerQuery) {
        this.repository = repository;
        this.ledgerQuery = ledgerQuery;
    }

    /**
     * Một chỉ tiêu của danh mục.
     *
     * @param sheets      tên ngắn các biểu có số liệu mang mã này, theo thứ tự biểu ("1a"); rỗng = chưa có
     *                    số liệu
     * @param measureKind bản chất đã khai; {@code null} = chưa khai (tính như {@link MeasureKind#DEFAULT})
     * @param entryCount  số dòng số liệu đã duyệt mang mã này
     */
    public record IndicatorItem(String indicatorCode, String indicatorName, List<String> sheets,
                                MeasureKind measureKind, String note, long entryCount, Instant updatedAt,
                                int sheetOrder, int orderNo) {

        /** Bản chất dùng khi tổng hợp — đã khai, hoặc mặc định. */
        public MeasureKind effectiveKind() {
            return MeasureKind.orDefault(measureKind);
        }
    }

    public record Page(List<IndicatorItem> rows, long total) {
    }

    /** Tên ngắn các biểu có chỉ tiêu trong danh mục, theo thứ tự biểu — cho ô lọc Biểu. */
    public List<String> sheets() {
        Set<String> sheets = new LinkedHashSet<>();
        for (IndicatorItem item : catalog()) {
            sheets.addAll(item.sheets());
        }
        return List.copyOf(sheets);
    }

    /**
     * Danh mục đã lọc và phân trang. Lọc: {@code q} (tên hoặc mã chứa), {@code sheet} (tên ngắn biểu),
     * {@code measureKind} (tên hằng, hoặc {@value #UNSET} = chưa khai).
     */
    public Page list(ListParams params) {
        List<IndicatorItem> all = catalog();

        String q = params.search().map(term -> term.toLowerCase(VI)).orElse(null);
        String sheet = null;
        String kind = null;
        for (ListParams.Criterion criterion : params.filters()) {
            switch (criterion.field()) {
                case "sheet" -> sheet = criterion.value().trim();
                case "measureKind" -> kind = criterion.value().trim();
                default -> {
                    // trường lọc lạ bị bỏ qua như mọi resource khác
                }
            }
        }

        List<IndicatorItem> matched = new ArrayList<>();
        for (IndicatorItem item : all) {
            if (q != null && !matches(item, q)) {
                continue;
            }
            if (sheet != null && !item.sheets().contains(sheet)) {
                continue;
            }
            if (kind != null && !kindMatches(item, kind)) {
                continue;
            }
            matched.add(item);
        }

        Pageable pageable = params.pageable(Set.of(), Sort.unsorted());
        int from = (int) Math.min(pageable.getOffset(), matched.size());
        int to = Math.min(from + pageable.getPageSize(), matched.size());
        return new Page(List.copyOf(matched.subList(from, to)), matched.size());
    }

    /**
     * Khai cùng một bản chất cho các mã. {@code measureKind == null} = bỏ khai (về mặc định, xoá dòng
     * — kể cả ghi chú). {@code note == null} giữ ghi chú cũ; chuỗi rỗng xoá ghi chú.
     *
     * @return các chỉ tiêu sau khi ghi, theo thứ tự danh mục
     */
    @Transactional
    public List<IndicatorItem> declare(Collection<String> indicatorCodes, String measureKind, String note) {
        Set<String> codes = normalizeCodes(indicatorCodes);
        MeasureKind kind = null;
        if (measureKind != null && !measureKind.isBlank()) {
            kind = MeasureKind.parse(measureKind);
            if (kind == null) {
                throw new IllegalArgumentException("Bản chất chỉ tiêu không hợp lệ.");
            }
        }
        String cleanNote = note == null ? null : note.trim();
        if (cleanNote != null && cleanNote.length() > NOTE_MAX_LENGTH) {
            throw new IllegalArgumentException("Ghi chú dài quá " + NOTE_MAX_LENGTH + " ký tự.");
        }

        Map<String, IndicatorMeasure> existing = new HashMap<>();
        for (IndicatorMeasure measure : repository.findByIndicatorCodeIn(codes)) {
            existing.put(measure.getIndicatorCode(), measure);
        }
        Set<String> known = new HashSet<>(existing.keySet());
        for (IndicatorUsage usage : ledgerQuery.indicatorUsages()) {
            known.add(usage.indicatorCode());
        }
        for (String code : codes) {
            if (!known.contains(code)) {
                throw new IllegalArgumentException("Không tìm thấy chỉ tiêu trong danh mục. Bạn tải lại danh sách"
                        + " rồi chọn lại.");
            }
        }

        for (String code : codes) {
            IndicatorMeasure measure = existing.get(code);
            if (kind == null) {
                if (measure != null) {
                    repository.delete(measure);
                }
                continue;
            }
            if (measure == null) {
                measure = new IndicatorMeasure(code, kind);
            }
            measure.setMeasureKind(kind);
            if (cleanNote != null) {
                measure.setNote(cleanNote.isEmpty() ? null : cleanNote);
            }
            repository.save(measure);
        }
        repository.flush();

        List<IndicatorItem> result = new ArrayList<>();
        for (IndicatorItem item : catalog()) {
            if (codes.contains(item.indicatorCode())) {
                result.add(item);
            }
        }
        return result;
    }

    // ------------------------------------------------------------------ nội bộ

    /** Toàn bộ danh mục, xếp theo biểu rồi theo vị trí dòng trong biểu; mã chỉ khai (chưa có số) cuối. */
    List<IndicatorItem> catalog() {
        Map<String, IndicatorMeasure> declared = new LinkedHashMap<>();
        for (IndicatorMeasure measure : repository.findAllByOrderByIndicatorCodeAsc()) {
            declared.put(measure.getIndicatorCode(), measure);
        }

        Map<String, Builder> byCode = new LinkedHashMap<>();
        for (IndicatorUsage usage : ledgerQuery.indicatorUsages()) {
            byCode.computeIfAbsent(usage.indicatorCode(), Builder::new).add(usage);
        }
        for (String code : declared.keySet()) {
            byCode.computeIfAbsent(code, Builder::new);
        }

        List<IndicatorItem> items = new ArrayList<>(byCode.size());
        for (Builder builder : byCode.values()) {
            items.add(builder.build(declared.get(builder.code)));
        }
        items.sort((a, b) -> {
            if (a.sheetOrder() != b.sheetOrder()) {
                return Integer.compare(a.sheetOrder(), b.sheetOrder());
            }
            String sa = a.sheets().isEmpty() ? "" : a.sheets().getFirst();
            String sb = b.sheets().isEmpty() ? "" : b.sheets().getFirst();
            int bySheet = sa.compareTo(sb);
            if (bySheet != 0) {
                return bySheet;
            }
            if (a.orderNo() != b.orderNo()) {
                return Integer.compare(a.orderNo(), b.orderNo());
            }
            return a.indicatorCode().compareTo(b.indicatorCode());
        });
        return items;
    }

    private static boolean matches(IndicatorItem item, String q) {
        return item.indicatorCode().toLowerCase(VI).contains(q)
                || (item.indicatorName() != null && item.indicatorName().toLowerCase(VI).contains(q));
    }

    private static boolean kindMatches(IndicatorItem item, String kind) {
        if (UNSET.equalsIgnoreCase(kind)) {
            return item.measureKind() == null;
        }
        MeasureKind wanted = MeasureKind.parse(kind);
        return wanted != null && wanted == item.measureKind();
    }

    private static Set<String> normalizeCodes(Collection<String> indicatorCodes) {
        Set<String> codes = new LinkedHashSet<>();
        if (indicatorCodes != null) {
            for (String code : indicatorCodes) {
                if (code != null && !code.isBlank()) {
                    codes.add(code.trim());
                }
            }
        }
        if (codes.isEmpty()) {
            throw new IllegalArgumentException("Hãy chọn ít nhất một chỉ tiêu.");
        }
        if (codes.size() > MAX_CODES_PER_UPDATE) {
            throw new IllegalArgumentException("Mỗi lần chỉ khai được tối đa " + MAX_CODES_PER_UPDATE + " chỉ tiêu.");
        }
        return codes;
    }

    /** Gom các dòng {@link IndicatorUsage} cùng mã (một mã có thể nằm ở nhiều biểu). */
    private static final class Builder {
        private final String code;
        private final List<String> sheets = new ArrayList<>();
        private String name;
        private long entryCount;
        private int sheetOrder = Integer.MAX_VALUE;
        private int orderNo = Integer.MAX_VALUE;

        Builder(String code) {
            this.code = code;
        }

        void add(IndicatorUsage usage) {
            if (name == null || name.isBlank()) {
                name = usage.indicatorName();
            }
            String sheet = usage.templateShortName();
            if (sheet != null && !sheet.isBlank() && !sheets.contains(sheet)) {
                sheets.add(sheet);
            }
            entryCount += usage.entryCount() == null ? 0 : usage.entryCount();
            if (usage.templateSortOrder() < sheetOrder) {
                sheetOrder = usage.templateSortOrder();
                orderNo = usage.orderNo() == null ? Integer.MAX_VALUE : usage.orderNo();
            } else if (usage.templateSortOrder() == sheetOrder && usage.orderNo() != null
                    && usage.orderNo() < orderNo) {
                orderNo = usage.orderNo();
            }
        }

        IndicatorItem build(IndicatorMeasure measure) {
            String displayName = name == null || name.isBlank() ? code : name;
            if (measure == null) {
                return new IndicatorItem(code, displayName, List.copyOf(sheets), null, null, entryCount, null,
                        sheetOrder, orderNo);
            }
            Instant changedAt = measure.getUpdatedAt() != null ? measure.getUpdatedAt() : measure.getCreatedAt();
            return new IndicatorItem(code, displayName, List.copyOf(sheets), measure.getMeasureKind(),
                    measure.getNote(), entryCount, changedAt, sheetOrder, orderNo);
        }
    }
}
