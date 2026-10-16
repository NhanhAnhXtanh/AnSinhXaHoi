package com.dth.frw.module.asxh.summary.service;

import com.dth.frw.domain.asxh.dept.MeasureKind;
import com.dth.frw.domain.asxh.dept.TimeAggregation;
import com.dth.frw.module.asxh.summary.query.PeriodCell;
import com.dth.frw.module.asxh.summary.query.SummaryRow;
import com.dth.frw.module.asxh.summary.query.YearRollupRow;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * Phép gộp số liệu tổng hợp — HÀM THUẦN (không Spring, không CSDL) để test được trực tiếp. Port lõi
 * của {@code SummaryAggregationService} bản Jmix.
 *
 * <p>Gộp trên hai trục, và THỨ TỰ quyết định con số (BR-50.3):
 * <ol>
 *   <li><b>Trục thời gian</b> ({@link #aggregateCells}): gộp các kỳ con TRONG TỪNG đơn vị theo
 *       {@link MeasureKind} của chỉ tiêu (người = MAX, lượt / thời gian / tiền = cộng, đơn giá = kỳ
 *       cuối). Trong CÙNG một kỳ, nhiều dòng của cùng đơn vị × chỉ tiêu được cộng trước.</li>
 *   <li><b>Trục đơn vị</b>: cộng qua các đơn vị — bình thường do CÔNG THỨC của mẫu; khi bảng cần
 *       đúng một dòng mỗi chỉ tiêu thì {@link #mergeByIndicator} (đơn giá giữ một giá trị).</li>
 * </ol>
 * Làm ngược (cộng đơn vị trước rồi MAX theo kỳ) sẽ mất phần chênh của những đơn vị không đạt đỉnh
 * cùng kỳ.
 */
public final class SummaryAggregator {

    /** Mã / tên dòng đã cộng qua nhiều đơn vị — không được rỗng (script cũ đòi chuỗi khác rỗng). */
    public static final String MERGED_CODE = "TONG_HOP";
    public static final String MERGED_NAME = "Tổng hợp các đơn vị";

    private static final String SEP = "\u001e";

    private SummaryAggregator() {
    }

    /**
     * Gộp theo (đơn vị, chỉ tiêu) qua các kỳ. Thứ tự kết quả = thứ tự xuất hiện đầu tiên trong
     * {@code cells}.
     *
     * @param kinds     bản chất của mã chỉ tiêu ({@code null} → {@link MeasureKind#DEFAULT})
     * @param deltaUnit khoá đơn vị mà ô mang PHẦN CHÊNH chứ không mang số (dòng "Sở điều chỉnh chung"):
     *                  MAX của các phần chênh vô nghĩa nên quy tắc MAX đổi thành lấy kỳ cuối
     */
    public static List<SummaryRow> aggregateCells(List<PeriodCell> cells,
                                                  Function<String, MeasureKind> kinds,
                                                  Predicate<String> deltaUnit) {
        Map<Long, LocalDate> periodOrder = new HashMap<>();
        Map<String, Aggregate> aggregated = new LinkedHashMap<>();
        for (PeriodCell cell : cells) {
            if (cell.periodFrom() != null) {
                periodOrder.put(cell.periodId(), cell.periodFrom());
            }
            Aggregate aggregate = aggregated.computeIfAbsent(cell.unitKey() + SEP + cell.indicatorCode(),
                    ignored -> new Aggregate(cell));
            aggregate.add(cell);
        }
        List<SummaryRow> result = new ArrayList<>(aggregated.size());
        for (Aggregate aggregate : aggregated.values()) {
            MeasureKind kind = MeasureKind.orDefault(kinds.apply(aggregate.indicatorCode));
            result.add(aggregate.toRow(kind, periodOrder, deltaUnit.test(aggregate.unitKey)));
        }
        return result;
    }

    /**
     * Cộng các dòng theo đơn vị thành MỘT dòng mỗi chỉ tiêu (bảng chỉ có một dòng cho mỗi chỉ tiêu —
     * nhiều dòng cùng mã thì số của các đơn vị còn lại mất lặng lẽ). Đơn giá ({@link MeasureKind#DON_GIA})
     * giống nhau ở mọi đơn vị nên giữ một giá trị, không nhân theo số đơn vị.
     */
    public static List<SummaryRow> mergeByIndicator(List<SummaryRow> perUnit, Function<String, MeasureKind> kinds) {
        Map<String, SummaryRow> byIndicator = new LinkedHashMap<>();
        for (SummaryRow row : perUnit) {
            byIndicator.merge(row.indicatorCode(), toMerged(row), (left, right) ->
                    mergeAcrossUnits(left, right, MeasureKind.orDefault(kinds.apply(left.indicatorCode()))));
        }
        return List.copyOf(byIndicator.values());
    }

    /**
     * Ghép hai nửa năm (mỗi nửa đã gộp một dòng mỗi chỉ tiêu) thành một dòng mỗi chỉ tiêu mang hai
     * bucket riêng. KHÔNG cộng / MAX giữa hai nửa — cột "Cả năm" là công thức của mẫu.
     */
    public static List<YearRollupRow> rollup(List<SummaryRow> firstHalf, List<SummaryRow> secondHalf) {
        Map<String, YearRollupRow> merged = new LinkedHashMap<>();
        for (SummaryRow row : firstHalf) {
            merged.putIfAbsent(row.indicatorCode(), new YearRollupRow(row.indicatorCode(), row.indicatorName(),
                    row.quantity(), row.amount(), null, null));
        }
        for (SummaryRow row : secondHalf) {
            YearRollupRow incoming = new YearRollupRow(row.indicatorCode(), row.indicatorName(),
                    null, null, row.quantity(), row.amount());
            merged.merge(row.indicatorCode(), incoming, (existing, next) -> new YearRollupRow(
                    existing.indicatorCode(),
                    existing.indicatorName() != null ? existing.indicatorName() : next.indicatorName(),
                    existing.quantityHk1(), existing.amountHk1(),
                    next.quantityHk2(), next.amountHk2()));
        }
        return List.copyOf(merged.values());
    }

    // ------------------------------------------------------------------ nội bộ

    private static SummaryRow toMerged(SummaryRow row) {
        return new SummaryRow(MERGED_CODE, MERGED_NAME, row.indicatorCode(), row.indicatorName(),
                row.quantity(), row.amount(), row.quantitySum(), row.quantityMax(), row.measureKind(),
                row.periodCount(), row.orderNo(), null);
    }

    private static SummaryRow mergeAcrossUnits(SummaryRow left, SummaryRow right, MeasureKind kind) {
        boolean keepSingle = kind == MeasureKind.DON_GIA;
        return new SummaryRow(MERGED_CODE, MERGED_NAME,
                left.indicatorCode(), left.indicatorName() != null ? left.indicatorName() : right.indicatorName(),
                keepSingle ? firstNonNull(left.quantity(), right.quantity()) : add(left.quantity(), right.quantity()),
                keepSingle ? firstNonNull(left.amount(), right.amount()) : add(left.amount(), right.amount()),
                keepSingle ? firstNonNull(left.quantitySum(), right.quantitySum())
                        : add(left.quantitySum(), right.quantitySum()),
                keepSingle ? firstNonNull(left.quantityMax(), right.quantityMax())
                        : add(left.quantityMax(), right.quantityMax()),
                left.measureKind(),
                Math.max(left.periodCount(), right.periodCount()),
                minOrder(left.orderNo(), right.orderNo()),
                null);
    }

    static BigDecimal add(BigDecimal left, BigDecimal right) {
        if (left == null) {
            return right;
        }
        return right == null ? left : left.add(right);
    }

    private static BigDecimal firstNonNull(BigDecimal left, BigDecimal right) {
        return left != null ? left : right;
    }

    private static Integer minOrder(Integer left, Integer right) {
        if (left == null) {
            return right;
        }
        return right == null ? left : Math.min(left, right);
    }

    /** Một (đơn vị, chỉ tiêu) đang gộp: số theo từng kỳ. */
    private static final class Aggregate {
        private final String unitKey;
        private final String unitName;
        private final Long unitId;
        private final String indicatorCode;
        private String indicatorName;
        private Integer orderNo;
        // Cộng trong CÙNG một kỳ; phép gộp theo MeasureKind chỉ áp GIỮA các kỳ.
        private final Map<Long, BigDecimal> quantityByPeriod = new LinkedHashMap<>();
        private final Map<Long, BigDecimal> amountByPeriod = new LinkedHashMap<>();

        private Aggregate(PeriodCell first) {
            this.unitKey = first.unitKey();
            this.unitName = first.unitName();
            this.unitId = first.unitId();
            this.indicatorCode = first.indicatorCode();
            this.indicatorName = first.indicatorName();
        }

        private void add(PeriodCell cell) {
            if (indicatorName == null || indicatorName.isBlank()) {
                indicatorName = cell.indicatorName();
            }
            orderNo = minOrder(orderNo, cell.orderNo());
            if (cell.quantity() != null) {
                quantityByPeriod.merge(cell.periodId(), cell.quantity(), BigDecimal::add);
            }
            if (cell.amount() != null) {
                amountByPeriod.merge(cell.periodId(), cell.amount(), BigDecimal::add);
            }
        }

        private SummaryRow toRow(MeasureKind kind, Map<Long, LocalDate> periodOrder, boolean delta) {
            int periodCount = Math.max(quantityByPeriod.size(), amountByPeriod.size());
            return new SummaryRow(unitKey, unitName, indicatorCode, indicatorName,
                    apply(ruleFor(kind.quantityRule(), delta), quantityByPeriod, periodOrder),
                    apply(ruleFor(kind.amountRule(), delta), amountByPeriod, periodOrder),
                    sum(quantityByPeriod), max(quantityByPeriod), kind.name(), periodCount, orderNo, unitId);
        }

        private static TimeAggregation ruleFor(TimeAggregation rule, boolean delta) {
            return delta && rule == TimeAggregation.MAX ? TimeAggregation.LAST : rule;
        }

        private static BigDecimal apply(TimeAggregation rule, Map<Long, BigDecimal> byPeriod,
                                        Map<Long, LocalDate> periodOrder) {
            return switch (rule) {
                case SUM -> sum(byPeriod);
                case MAX -> max(byPeriod);
                case LAST -> last(byPeriod, periodOrder);
            };
        }

        private static BigDecimal sum(Map<Long, BigDecimal> byPeriod) {
            return byPeriod.isEmpty() ? null : byPeriod.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        private static BigDecimal max(Map<Long, BigDecimal> byPeriod) {
            return byPeriod.values().stream().max(BigDecimal::compareTo).orElse(null);
        }

        /** Giá trị của kỳ mới nhất; kỳ thiếu ngày đầu xếp trước mọi kỳ có ngày. */
        private static BigDecimal last(Map<Long, BigDecimal> byPeriod, Map<Long, LocalDate> periodOrder) {
            return byPeriod.entrySet().stream()
                    .max(Comparator.comparing(entry -> periodOrder.getOrDefault(entry.getKey(), LocalDate.MIN)))
                    .map(Map.Entry::getValue)
                    .orElse(null);
        }
    }
}
