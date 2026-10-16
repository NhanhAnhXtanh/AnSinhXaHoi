package com.dth.frw.module.asxh.summary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.dth.frw.domain.asxh.dept.MeasureKind;
import com.dth.frw.module.asxh.summary.query.PeriodCell;
import com.dth.frw.module.asxh.summary.query.SummaryRow;
import com.dth.frw.module.asxh.summary.query.YearRollupRow;
import com.dth.frw.module.asxh.summary.service.SummaryAggregator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Gộp NHIỀU KỲ theo bản chất chỉ tiêu (BR-50.3, UC-52) trên dữ liệu dựng tay — không Spring, không CSDL.
 *
 * <p>Bối cảnh: hai kỳ quý (Q1 từ 01/01, Q2 từ 01/04), hai đơn vị A (xã Phú Hữu) và B (xã Long Tân).
 */
class SummaryAggregatorTest {

    private static final long Q1 = 1L;
    private static final long Q2 = 2L;
    private static final LocalDate Q1_FROM = LocalDate.of(2026, 1, 1);
    private static final LocalDate Q2_FROM = LocalDate.of(2026, 4, 1);

    private static PeriodCell cell(long period, String unit, String indicator, Integer quantity, Integer amount) {
        return new PeriodCell(period, period == Q1 ? Q1_FROM : Q2_FROM, unit, "Đơn vị " + unit,
                unit.equals("*") ? null : (long) unit.charAt(0), indicator, "Chỉ tiêu " + indicator,
                quantity == null ? null : BigDecimal.valueOf(quantity),
                amount == null ? null : BigDecimal.valueOf(amount), 1);
    }

    private static Function<String, MeasureKind> kinds(Map<String, MeasureKind> map) {
        return map::get;
    }

    private static SummaryRow find(List<SummaryRow> rows, String unit, String indicator) {
        return rows.stream()
                .filter(row -> row.organizationCode().equals(unit) && row.indicatorCode().equals(indicator))
                .findFirst()
                .orElseThrow();
    }

    @Test
    @DisplayName("Người/hộ: số đối tượng lấy kỳ cao nhất, kinh phí cộng các kỳ")
    void peopleTakeMaxMoneySums() {
        List<PeriodCell> cells = List.of(
                cell(Q1, "A", "TRE_EM", 10, 1_500),
                cell(Q2, "A", "TRE_EM", 12, 1_800));
        List<SummaryRow> rows = SummaryAggregator.aggregateCells(cells, kinds(Map.of()), unit -> false);

        SummaryRow row = find(rows, "A", "TRE_EM");
        assertEquals(0, BigDecimal.valueOf(12).compareTo(row.quantity()), "người = MAX");
        assertEquals(0, BigDecimal.valueOf(3_300).compareTo(row.amount()), "tiền = cộng");
        assertEquals(0, BigDecimal.valueOf(22).compareTo(row.quantitySum()));
        assertEquals(0, BigDecimal.valueOf(12).compareTo(row.quantityMax()));
        assertEquals("NGUOI", row.measureKind(), "chưa khai bản chất → mặc định NGUOI");
        assertEquals(2, row.periodCount());
    }

    @Test
    @DisplayName("Lượt cộng, thời gian cộng, đơn giá lấy kỳ cuối")
    void eachKindHasItsRule() {
        List<PeriodCell> cells = List.of(
                cell(Q1, "A", "LUOT", 4, null),
                cell(Q2, "A", "LUOT", 6, null),
                cell(Q1, "A", "THANG", 3, null),
                cell(Q2, "A", "THANG", 3, null),
                cell(Q1, "A", "MUC", 150, 150),
                cell(Q2, "A", "MUC", 170, 170));
        List<SummaryRow> rows = SummaryAggregator.aggregateCells(cells, kinds(Map.of(
                "LUOT", MeasureKind.LUOT,
                "THANG", MeasureKind.THOI_GIAN,
                "MUC", MeasureKind.DON_GIA)), unit -> false);

        assertEquals(0, BigDecimal.TEN.compareTo(find(rows, "A", "LUOT").quantity()));
        assertEquals(0, BigDecimal.valueOf(6).compareTo(find(rows, "A", "THANG").quantity()));
        SummaryRow unitPrice = find(rows, "A", "MUC");
        assertEquals(0, BigDecimal.valueOf(170).compareTo(unitPrice.quantity()), "đơn giá = kỳ mới nhất");
        assertEquals(0, BigDecimal.valueOf(170).compareTo(unitPrice.amount()));
    }

    @Test
    @DisplayName("Thứ tự gộp: theo kỳ trong từng đơn vị TRƯỚC, cộng qua đơn vị SAU")
    void timeAxisBeforeUnitAxis() {
        // A đạt đỉnh ở Q1, B đạt đỉnh ở Q2. Đúng: MAX(A)=10 + MAX(B)=8 = 18.
        // Sai (cộng đơn vị trước rồi MAX): MAX(10+3, 5+8) = 13 — mất phần chênh.
        List<PeriodCell> cells = List.of(
                cell(Q1, "A", "TRE_EM", 10, 100),
                cell(Q2, "A", "TRE_EM", 5, 50),
                cell(Q1, "B", "TRE_EM", 3, 30),
                cell(Q2, "B", "TRE_EM", 8, 80));
        List<SummaryRow> perUnit = SummaryAggregator.aggregateCells(cells, kinds(Map.of()), unit -> false);
        List<SummaryRow> merged = SummaryAggregator.mergeByIndicator(perUnit, kinds(Map.of()));

        assertEquals(1, merged.size());
        SummaryRow total = merged.getFirst();
        assertEquals(SummaryAggregator.MERGED_CODE, total.organizationCode());
        assertEquals(0, BigDecimal.valueOf(18).compareTo(total.quantity()));
        assertEquals(0, BigDecimal.valueOf(260).compareTo(total.amount()), "đổi cách đọc số người không đổi tiền");
        assertNull(total.unitId());
    }

    @Test
    @DisplayName("Đơn giá không nhân theo số đơn vị khi cộng qua đơn vị")
    void unitPriceIsNotMultipliedAcrossUnits() {
        List<PeriodCell> cells = List.of(
                cell(Q1, "A", "MUC", 150, null),
                cell(Q1, "B", "MUC", 150, null));
        Function<String, MeasureKind> kinds = kinds(Map.of("MUC", MeasureKind.DON_GIA));
        List<SummaryRow> merged = SummaryAggregator.mergeByIndicator(
                SummaryAggregator.aggregateCells(cells, kinds, unit -> false), kinds);

        assertEquals(0, BigDecimal.valueOf(150).compareTo(merged.getFirst().quantity()));
    }

    @Test
    @DisplayName("Nhiều dòng của cùng đơn vị × chỉ tiêu trong MỘT kỳ được cộng trước khi gộp kỳ")
    void sameperiodRowsAreSummedFirst() {
        List<PeriodCell> cells = new ArrayList<>(List.of(
                cell(Q1, "A", "TRE_EM", 4, 40),
                cell(Q1, "A", "TRE_EM", 6, 60),
                cell(Q2, "A", "TRE_EM", 7, 70)));
        SummaryRow row = SummaryAggregator.aggregateCells(cells, kinds(Map.of()), unit -> false).getFirst();

        assertEquals(0, BigDecimal.TEN.compareTo(row.quantity()), "Q1 = 4 + 6 = 10 > Q2 = 7");
        assertEquals(0, BigDecimal.valueOf(170).compareTo(row.amount()));
    }

    @Test
    @DisplayName("Dòng điều chỉnh chung mang phần chênh: quy tắc MAX đổi thành lấy kỳ cuối")
    void deltaRowUsesLastInsteadOfMax() {
        List<PeriodCell> cells = List.of(
                cell(Q1, "*", "TRE_EM", 5, null),
                cell(Q2, "*", "TRE_EM", -2, null));
        SummaryRow row = SummaryAggregator.aggregateCells(cells, kinds(Map.of()), "*"::equals).getFirst();

        assertEquals(0, BigDecimal.valueOf(-2).compareTo(row.quantity()));
    }

    @Test
    @DisplayName("Năm dương lịch: hai nửa tách riêng, chỉ tiêu chỉ có ở một nửa thì nửa kia để trống")
    void yearRollupKeepsHalvesApart() {
        SummaryRow first = new SummaryRow("TONG_HOP", "x", "TRE_EM", "Trẻ em", BigDecimal.TEN, BigDecimal.ONE,
                BigDecimal.TEN, BigDecimal.TEN, "NGUOI", 2, 1, null);
        SummaryRow onlySecond = new SummaryRow("TONG_HOP", "x", "MAI_TANG", "Mai táng", BigDecimal.ONE, BigDecimal.TWO,
                BigDecimal.ONE, BigDecimal.ONE, "LUOT", 1, 2, null);
        SummaryRow second = new SummaryRow("TONG_HOP", "x", "TRE_EM", "Trẻ em", BigDecimal.valueOf(12),
                BigDecimal.valueOf(3), BigDecimal.TEN, BigDecimal.TEN, "NGUOI", 2, 1, null);

        List<YearRollupRow> rows = SummaryAggregator.rollup(List.of(first), List.of(second, onlySecond));

        assertEquals(2, rows.size());
        YearRollupRow children = rows.getFirst();
        assertEquals(0, BigDecimal.TEN.compareTo(children.quantityHk1()));
        assertEquals(0, BigDecimal.valueOf(12).compareTo(children.quantityHk2()));
        YearRollupRow burial = rows.get(1);
        assertNull(burial.quantityHk1(), "không bịa số 0");
        assertEquals(0, BigDecimal.TWO.compareTo(burial.amountHk2()));
    }
}
