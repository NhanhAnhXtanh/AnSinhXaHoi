package com.dth.frw.module.asxh.dept;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.asxh.dept.DeptLedgerLine;
import com.dth.frw.domain.asxh.dept.DeptLedgerSlot;
import com.dth.frw.domain.asxh.dept.MeasureKind;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.Diff;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.Extracted;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.LineState;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.Plan;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.RawLine;
import com.dth.frw.module.asxh.dept.service.DeptLedgerPlanner.ReasonInput;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Phiên bản số liệu Sở (UC-55, BR-55.1, BR-55.2) — kế hoạch ghi trên dữ liệu dựng tay, không Spring,
 * không CSDL.
 *
 * <p>Số liệu hiện hành của biểu 1a: xã Phú Hữu (PH) 10 trẻ / 1.500, xã Long Tân (LT) 5 trẻ / 750 — đúng
 * bằng số gốc lúc lưu kỳ.
 */
class DeptLedgerPlannerTest {

    private static final Map<String, Long> UNIT_IDS = Map.of("PH", 1L, "LT", 2L);

    private static BigDecimal n(long value) {
        return BigDecimal.valueOf(value);
    }

    private static LineState current(long id, String unit, long quantity, long amount) {
        return new LineState(id, unit, UNIT_IDS.get(unit), "TRE_EM", "Trẻ em", DeptLedgerSlot.ALL, MeasureKind.NGUOI,
                n(quantity), n(amount), n(quantity), n(amount), null, null, (int) id);
    }

    private static final List<LineState> CURRENT = List.of(current(1, "PH", 10, 1_500), current(2, "LT", 5, 750));

    private static RawLine raw(String unit, Long quantity, Long amount) {
        return new RawLine(unit, "TRE_EM", "Trẻ em", null,
                quantity == null ? null : n(quantity), amount == null ? null : n(amount), null, 1);
    }

    private static Plan plan(List<RawLine> rows, String reason) {
        List<Extracted> lines = DeptLedgerPlanner.extract(rows);
        return DeptLedgerPlanner.plan(lines, CURRENT, UNIT_IDS, Map.of(), reason, true);
    }

    @Test
    @DisplayName("Không ô nào đổi → không dòng nào phải ghi (không tiêu phiên bản)")
    void unchangedSheetWritesNothing() {
        Plan plan = plan(List.of(raw("PH", 10L, 1_500L), raw("LT", 5L, 750L)), null);
        Diff diff = DeptLedgerPlanner.diff(CURRENT, plan.targets());

        assertEquals(0, diff.rowCount());
        assertTrue(plan.missingReasons().isEmpty());
    }

    @Test
    @DisplayName("Sửa một đơn vị → chỉ dòng đó đổi, giữ số gốc, ghi lý do chung")
    void onlyChangedUnitIsRewritten() {
        Plan plan = plan(List.of(raw("PH", 12L, 1_800L), raw("LT", 5L, 750L)), "Bổ sung 2 trẻ chuyển đến");
        Diff diff = DeptLedgerPlanner.diff(CURRENT, plan.targets());

        assertEquals(1, diff.rowCount());
        assertEquals(1, diff.updated());
        LineState target = diff.changed().getFirst();
        assertEquals("PH", target.unitKey());
        assertEquals(0, n(12).compareTo(target.quantity()));
        assertEquals(0, n(10).compareTo(target.sourceQuantity()), "số gốc giữ nguyên để biết Sở đã chỉnh");
        assertEquals("Bổ sung 2 trẻ chuyển đến", target.reason());
        assertEquals(1L, diff.replaced().getFirst().lineId(), "dòng cũ bị đóng ở phiên bản mới");
    }

    @Test
    @DisplayName("Đơn vị vắng trong bảng theo đơn vị → dòng của đơn vị đó bị bỏ")
    void missingUnitIsRemoved() {
        Plan plan = plan(List.of(raw("PH", 10L, 1_500L)), null);
        Diff diff = DeptLedgerPlanner.diff(CURRENT, plan.targets());

        assertEquals(1, diff.removed().size());
        assertEquals("LT", diff.removed().getFirst().unitKey());
    }

    @Test
    @DisplayName("Sửa dòng tổng → phần chênh vào dòng 'Sở điều chỉnh chung', dòng đơn vị giữ nguyên")
    void mergedEditGoesToAdjustmentLine() {
        // Tổng hiện hành 15 trẻ / 2.250; Sở sửa tổng thành 18 trẻ / 2.700.
        Plan plan = plan(List.of(raw("", 18L, 2_700L)), "Rà soát lại cuối kỳ");
        Diff diff = DeptLedgerPlanner.diff(CURRENT, plan.targets());

        assertEquals(1, diff.added());
        LineState star = diff.changed().getFirst();
        assertEquals(DeptLedgerLine.MERGED_UNIT_KEY, star.unitKey());
        assertNull(star.unitId());
        assertEquals(0, n(3).compareTo(star.quantity()));
        assertEquals(0, n(450).compareTo(star.amount()));
        assertTrue(diff.removed().isEmpty(), "dòng đơn vị không bị đụng");
    }

    @Test
    @DisplayName("Dòng tổng chọn đơn vị nhận phần chênh → cộng vào đúng đơn vị đó")
    void mergedEditCanTargetOneUnit() {
        List<Extracted> lines = DeptLedgerPlanner.extract(List.of(raw("", 18L, 2_700L)));
        String key = lines.getFirst().key();
        Plan plan = DeptLedgerPlanner.plan(lines, CURRENT, UNIT_IDS,
                Map.of(key, new ReasonInput("Phú Hữu báo thiếu", "LT")), null, false);
        Diff diff = DeptLedgerPlanner.diff(CURRENT, plan.targets());

        assertEquals(1, diff.rowCount());
        LineState target = diff.changed().getFirst();
        assertEquals("LT", target.unitKey());
        assertEquals(0, n(8).compareTo(target.quantity()));
        assertEquals(0, n(1_200).compareTo(target.amount()));
    }

    @Test
    @DisplayName("Thiếu lý do khi bắt buộc → dòng bị giữ lại ở danh sách thiếu lý do")
    void missingReasonIsReported() {
        List<Extracted> lines = DeptLedgerPlanner.extract(List.of(raw("PH", 11L, 1_650L)));
        Plan plan = DeptLedgerPlanner.plan(lines, CURRENT, UNIT_IDS, Map.of(), null, false);

        assertEquals(List.of("PH|TRE_EM|ALL"), plan.missingReasons());
    }

    @Test
    @DisplayName("Đơn giá không sửa được ở dòng tổng")
    void unitPriceCannotBeEditedOnMergedLine() {
        List<LineState> prices = List.of(new LineState(1L, "PH", 1L, "MUC", "Mức hỗ trợ", DeptLedgerSlot.ALL,
                MeasureKind.DON_GIA, n(150), null, n(150), null, null, null, 1));
        List<Extracted> lines = DeptLedgerPlanner.extract(List.of(
                new RawLine("", "MUC", "Mức hỗ trợ", null, n(170), null, null, 1)));

        assertThrows(IllegalArgumentException.class,
                () -> DeptLedgerPlanner.plan(lines, prices, UNIT_IDS, Map.of(), "x", true));
    }

    @Test
    @DisplayName("Kiểm dòng script: trùng khoá, thiếu tên, số âm ở đơn vị đều bị từ chối")
    void extractRejectsBadRows() {
        assertThrows(IllegalArgumentException.class,
                () -> DeptLedgerPlanner.extract(List.of(raw("PH", 1L, 1L), raw("PH", 2L, 2L))));
        assertThrows(IllegalArgumentException.class, () -> DeptLedgerPlanner.extract(List.of(
                new RawLine("PH", "TRE_EM", " ", null, n(1), null, null, 1))));
        List<Extracted> negative = DeptLedgerPlanner.extract(List.of(raw("PH", -1L, null)));
        assertThrows(IllegalArgumentException.class,
                () -> DeptLedgerPlanner.plan(negative, CURRENT, UNIT_IDS, Map.of(), "x", true));
        assertTrue(DeptLedgerPlanner.extract(List.of(raw("PH", null, null))).isEmpty(), "dòng không số bị bỏ qua");
    }

    @Test
    @DisplayName("Dòng có hiệu lực ở phiên bản k khi versionFrom ≤ k < versionTo")
    void lineVisibilityByVersion() {
        DeptLedgerLine line = new DeptLedgerLine(null, null, "PH", null, "TRE_EM", DeptLedgerSlot.ALL, 2);
        assertFalse(line.visibleAt(1));
        assertTrue(line.visibleAt(2));
        assertTrue(line.visibleAt(9), "còn hiệu lực khi chưa bị đóng");
        line.setVersionTo(4);
        assertTrue(line.visibleAt(3));
        assertFalse(line.visibleAt(4), "bản sửa ở phiên bản 4 thay chỗ dòng này");
    }

    @Test
    @DisplayName("Số so khớp không phân biệt số 0 thừa (12.50 = 12.5)")
    void exactNumbers() {
        assertTrue(DeptLedgerPlanner.sameNumber(new BigDecimal("12.50"), new BigDecimal("12.5")));
        assertEquals("100", DeptLedgerPlanner.exact(new BigDecimal("1E+2")).toPlainString());
        assertFalse(DeptLedgerPlanner.isAdjusted(n(10), null, n(10), n(999)),
                "kinh phí do công thức tính (nguồn không có) không tính là điều chỉnh");
    }
}
