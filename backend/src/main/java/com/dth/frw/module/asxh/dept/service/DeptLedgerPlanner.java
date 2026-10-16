package com.dth.frw.module.asxh.dept.service;

import com.dth.frw.domain.asxh.dept.DeptLedgerLine;
import com.dth.frw.domain.asxh.dept.DeptLedgerSlot;
import com.dth.frw.domain.asxh.dept.MeasureKind;
import com.dth.frw.module.asxh.summary.service.SummaryAggregator;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Kế hoạch ghi số liệu Sở — HÀM THUẦN (không Spring, không CSDL), port phần {@code planPeriod},
 * {@code extract}, {@code diff}, {@code totals} của {@code DeptSheetService} bản Jmix.
 *
 * <p>Từ (a) các dòng hook {@code getSummaryData} trả về trên bảng Sở vừa sửa và (b) số liệu Sở hiện
 * hành của biểu, tính TRẠNG THÁI MONG MUỐN sau khi lưu; rồi so với hiện hành để ra các dòng thêm /
 * sửa / bỏ. Chỉ dòng THAY ĐỔI mới sinh bản ghi ở phiên bản mới (BR-55.2).
 *
 * <p>Khoá so khớp một dòng: {@code unitKey|indicatorCode|slot} ({@link #lineKey}).
 * <ul>
 *   <li>Dòng có mã đơn vị → ghi đè đúng dòng đơn vị đó. Chỉ tiêu có ít nhất một dòng theo đơn vị thì
 *       tập đơn vị trong output là ĐẦY ĐỦ: đơn vị có trong số liệu mà vắng ở output bị bỏ.</li>
 *   <li>Dòng gộp (mã rỗng / {@code TONG_HOP}) → so với tổng hiện hành của chỉ tiêu; PHẦN CHÊNH vào
 *       đơn vị Sở chọn (lý do kèm mã đơn vị) hoặc vào dòng "Sở điều chỉnh chung" ({@code *}).</li>
 * </ul>
 */
public final class DeptLedgerPlanner {

    /** Số chữ số phần nguyên tối đa của một ô. */
    static final int MAX_INTEGER_DIGITS = 20;

    private DeptLedgerPlanner() {
    }

    // ------------------------------------------------------------------ kiểu dữ liệu

    /**
     * Trạng thái một dòng số liệu Sở (hiện hành hoặc mong muốn).
     *
     * @param lineId id dòng đang có ({@code null} = dòng sẽ thêm)
     * @param unitId id đơn vị ({@code null} với dòng điều chỉnh chung)
     */
    public record LineState(Long lineId, String unitKey, Long unitId, String indicatorCode, String indicatorName,
                            DeptLedgerSlot slot, MeasureKind measureKind,
                            BigDecimal sourceQuantity, BigDecimal sourceAmount,
                            BigDecimal quantity, BigDecimal amount, BigDecimal allocatedAmount,
                            String reason, Integer orderNo) {

        public String key() {
            return lineKey(unitKey, indicatorCode, slot);
        }

        public boolean merged() {
            return DeptLedgerLine.MERGED_UNIT_KEY.equals(unitKey);
        }

        LineState withValues(BigDecimal q, BigDecimal a, BigDecimal allocated, String newReason) {
            return new LineState(lineId, unitKey, unitId, indicatorCode, indicatorName, slot, measureKind,
                    sourceQuantity, sourceAmount, q, a, allocated, newReason, orderNo);
        }
    }

    /** Một dòng {@code getSummaryData} trả về (đầu vào thô). */
    public record RawLine(String organizationCode, String indicatorCode, String indicatorName, String slot,
                          BigDecimal quantity, BigDecimal amount, BigDecimal allocatedAmount, Integer orderNo) {
    }

    /** Một dòng {@code getSummaryData} đã kiểm. */
    public record Extracted(String key, String unitKey, String indicatorCode, String indicatorName,
                            DeptLedgerSlot slot, BigDecimal quantity, BigDecimal amount,
                            BigDecimal allocatedAmount, Integer orderNo) {

        boolean merged() {
            return DeptLedgerLine.MERGED_UNIT_KEY.equals(unitKey);
        }
    }

    /** Lý do một dòng lệch; {@code unitKey} = đơn vị nhận phần chênh của dòng gộp ({@code null} = chung). */
    public record ReasonInput(String text, String unitKey) {
    }

    /** Một dòng của bảng xem trước "các dòng sẽ đổi". */
    public record PreviewLine(String key, String unitKey, String indicatorCode, String indicatorName,
                              BigDecimal sourceQuantity, BigDecimal sourceAmount,
                              BigDecimal currentQuantity, BigDecimal currentAmount,
                              BigDecimal quantity, BigDecimal amount, BigDecimal allocatedAmount,
                              boolean adjusted, boolean changed, boolean merged, String adjustReason) {
    }

    /** Trạng thái mong muốn + bảng xem trước + các khoá còn thiếu lý do. */
    public record Plan(Map<String, LineState> targets, List<PreviewLine> preview, List<String> missingReasons) {
    }

    /**
     * Thay đổi so với hiện hành: dòng thêm / sửa ({@code replaced} {@code null} = thêm) và dòng bỏ.
     * {@code changed.get(i)} thay cho {@code replaced.get(i)}.
     */
    public record Diff(List<LineState> changed, List<LineState> replaced, List<LineState> removed) {

        public int added() {
            return (int) replaced.stream().filter(Objects::isNull).count();
        }

        public int updated() {
            return replaced.size() - added();
        }

        public int rowCount() {
            return changed.size() + removed.size();
        }
    }

    /** Tổng một chỉ tiêu qua các dòng (đơn vị + điều chỉnh chung); đơn giá giữ một giá trị. */
    public record Totals(BigDecimal quantity, BigDecimal amount, BigDecimal sourceQuantity, BigDecimal sourceAmount,
                         BigDecimal allocatedAmount, MeasureKind measureKind, String reason) {
    }

    // ------------------------------------------------------------------ trích + kiểm

    /**
     * Kiểm các dòng {@code getSummaryData}: đủ mã + tên chỉ tiêu, số không quá lớn, không trùng khoá,
     * dự toán không âm; dòng không có số nào bị bỏ qua. Số liệu kỳ chỉ nhận slot rỗng / {@code ALL}.
     *
     * @throws IllegalArgumentException câu tiếng Việt nêu dòng sai
     */
    public static List<Extracted> extract(List<RawLine> rows) {
        Set<String> seen = new HashSet<>();
        List<Extracted> lines = new ArrayList<>();
        for (RawLine row : rows) {
            String indicatorCode = trimToNull(row.indicatorCode());
            String indicatorName = trimToNull(row.indicatorName());
            if (indicatorCode == null || indicatorName == null) {
                throw new IllegalArgumentException("Bảng có dòng thiếu mã hoặc tên chỉ tiêu.");
            }
            BigDecimal quantity = checked(row.quantity(), indicatorCode);
            BigDecimal amount = checked(row.amount(), indicatorCode);
            BigDecimal allocated = checked(row.allocatedAmount(), indicatorCode);
            if (allocated != null && allocated.signum() < 0) {
                throw new IllegalArgumentException("Chỉ tiêu " + indicatorCode + " có kinh phí dự toán âm.");
            }
            if (quantity == null && amount == null && allocated == null) {
                continue;
            }
            DeptLedgerSlot slot = DeptLedgerSlot.parse(row.slot());
            if (slot != DeptLedgerSlot.ALL) {
                throw new IllegalArgumentException("Chỉ tiêu " + indicatorCode
                        + ": số liệu theo kỳ không chia theo nửa năm.");
            }
            String unitKey = unitKeyOf(row.organizationCode());
            String key = lineKey(unitKey, indicatorCode, slot);
            if (!seen.add(key)) {
                throw new IllegalArgumentException("Bảng có hai dòng trùng nhau cho chỉ tiêu " + indicatorCode + ".");
            }
            lines.add(new Extracted(key, unitKey, indicatorCode, indicatorName, slot, quantity, amount, allocated,
                    row.orderNo()));
        }
        return lines;
    }

    // ------------------------------------------------------------------ lập kế hoạch

    /**
     * Trạng thái mong muốn của MỘT biểu sau khi lưu, xuất phát từ số liệu hiện hành.
     *
     * @param unitIds        mã đơn vị → id (đã kiểm tồn tại ở nơi gọi)
     * @param defaultReason  lý do chung cho mọi dòng đổi số chưa có lý do riêng ({@code null} = không có);
     *                       dòng gộp đổi số nhận lý do chung thì phần chênh vào dòng điều chỉnh chung
     * @param reasonOptional {@code true} = dòng thiếu lý do vẫn ghi (lý do để trống)
     */
    public static Plan plan(List<Extracted> lines, List<LineState> current, Map<String, Long> unitIds,
                            Map<String, ReasonInput> reasons, String defaultReason, boolean reasonOptional) {
        Map<String, ReasonInput> reasonMap = reasons == null ? Map.of() : reasons;
        Map<String, LineState> desired = new LinkedHashMap<>();
        Map<String, LineState> currentByKey = index(current);
        desired.putAll(currentByKey);

        Set<String> perUnitIndicators = new HashSet<>();
        Set<String> perUnitKeys = new HashSet<>();
        for (Extracted line : lines) {
            if (!line.merged()) {
                perUnitIndicators.add(line.indicatorCode());
                perUnitKeys.add(line.key());
            }
        }
        if (!perUnitKeys.isEmpty()) {
            // Chỉ tiêu có dòng THEO ĐƠN VỊ trong output: tập đơn vị đó là đầy đủ — dòng đơn vị không còn
            // trong output bị bỏ. Chỉ tiêu CHỈ có dòng gộp giữ nguyên mọi dòng đơn vị của nó.
            for (LineState row : current) {
                if (!row.merged() && perUnitIndicators.contains(row.indicatorCode())
                        && !perUnitKeys.contains(row.key())) {
                    desired.remove(row.key());
                }
            }
        }

        List<PreviewLine> preview = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        for (Extracted line : lines) {
            boolean direct = !line.merged() || perUnitIndicators.contains(line.indicatorCode());
            if (direct) {
                LineState row = currentByKey.get(line.key());
                LineState base = desired.containsKey(line.key()) ? desired.get(line.key())
                        : row != null ? row
                        : new LineState(null, line.unitKey(), unitIds.get(line.unitKey()), line.indicatorCode(),
                        line.indicatorName(), line.slot(), null, null, null, null, null, null, null, line.orderNo());
                if (!line.merged()) {
                    requireNonNegative(line.quantity(), line.amount(), line.indicatorCode());
                }
                boolean adjusted = isAdjusted(base.sourceQuantity(), base.sourceAmount(), line.quantity(), line.amount());
                boolean changed = row == null || !sameNumber(row.quantity(), line.quantity())
                        || !sameNumber(row.amount(), line.amount());
                String reason = null;
                if (adjusted) {
                    reason = reasonText(reasonMap.get(line.key()));
                    if (reason == null && !changed && row != null) {
                        reason = row.reason();
                    }
                    if (reason == null && changed) {
                        reason = defaultReason;
                    }
                    if (reason == null) {
                        missing.add(line.key());
                    }
                }
                desired.put(line.key(), new LineState(base.lineId(), line.unitKey(), base.unitId(),
                        line.indicatorCode(), line.indicatorName(), line.slot(), base.measureKind(),
                        base.sourceQuantity(), base.sourceAmount(), line.quantity(), line.amount(),
                        line.allocatedAmount(), reason, base.orderNo() != null ? base.orderNo() : line.orderNo()));
                preview.add(new PreviewLine(line.key(), line.unitKey(), line.indicatorCode(), line.indicatorName(),
                        base.sourceQuantity(), base.sourceAmount(),
                        row == null ? null : row.quantity(), row == null ? null : row.amount(),
                        line.quantity(), line.amount(), line.allocatedAmount(),
                        adjusted, changed, false, row == null ? null : row.reason()));
                continue;
            }

            // Dòng gộp: so với tổng hiện hành của chỉ tiêu.
            Totals totals = totals(current, line.indicatorCode(), line.slot());
            BigDecimal dq = line.quantity() == null ? BigDecimal.ZERO
                    : exact(line.quantity().subtract(nz(totals.quantity())));
            // Kinh phí đi kèm số đối tượng là CÔNG THỨC trên tổng (làm tròn một lần), còn tổng số liệu là cộng
            // kinh phí đã làm tròn của từng đơn vị ⇒ lệch vài đơn vị dù Sở không sửa gì. Số đối tượng không
            // đổi thì coi kinh phí không đổi; chỉ tiêu thuần tiền (không số lượng) so thẳng.
            BigDecimal da = line.amount() == null || (line.quantity() != null && dq.signum() == 0)
                    ? BigDecimal.ZERO
                    : exact(line.amount().subtract(nz(totals.amount())));
            boolean changed = dq.signum() != 0 || da.signum() != 0;
            BigDecimal newQ = line.quantity() == null ? totals.quantity() : line.quantity();
            BigDecimal newA = da.signum() == 0 ? totals.amount() : line.amount();
            boolean adjusted = isAdjusted(totals.sourceQuantity(), totals.sourceAmount(), newQ, newA);
            preview.add(new PreviewLine(line.key(), line.unitKey(), line.indicatorCode(), line.indicatorName(),
                    totals.sourceQuantity(), totals.sourceAmount(), totals.quantity(), totals.amount(),
                    line.quantity(), line.amount(), line.allocatedAmount(), adjusted, changed, true, totals.reason()));

            String starKey = lineKey(DeptLedgerLine.MERGED_UNIT_KEY, line.indicatorCode(), line.slot());
            LineState star = desired.get(starKey);
            if (!sameNumber(star == null ? null : star.allocatedAmount(), line.allocatedAmount())) {
                LineState base = star != null ? star : newMerged(line, totals.measureKind(), null);
                star = base.withValues(base.quantity(), base.amount(), line.allocatedAmount(), base.reason());
                desired.put(starKey, star);
            }
            if (!changed) {
                continue;
            }
            if (totals.measureKind() == MeasureKind.DON_GIA) {
                throw new IllegalArgumentException("Chỉ tiêu " + line.indicatorCode()
                        + " là đơn giá — không sửa được ở dòng tổng.");
            }
            ReasonInput input = reasonMap.get(line.key());
            String reason = reasonText(input);
            if (reason == null) {
                // Lý do chung không chọn đơn vị ⇒ phần chênh vào dòng điều chỉnh chung.
                input = null;
                reason = defaultReason;
            }
            if (reason == null) {
                missing.add(line.key());
                if (!reasonOptional) {
                    continue;
                }
            }
            String targetUnit = input == null || input.unitKey() == null || input.unitKey().isBlank()
                    ? null : input.unitKey().trim();
            if (targetUnit == null) {
                LineState base = star != null ? star : newMerged(line, totals.measureKind(), line.allocatedAmount());
                desired.put(starKey, base.withValues(addDelta(base.quantity(), dq), addDelta(base.amount(), da),
                        base.allocatedAmount(), reason));
            } else {
                String unitKey = lineKey(targetUnit, line.indicatorCode(), line.slot());
                LineState base = desired.get(unitKey);
                if (base == null) {
                    base = new LineState(null, targetUnit, unitIds.get(targetUnit), line.indicatorCode(),
                            line.indicatorName(), line.slot(), totals.measureKind(), null, null, null, null, null, null,
                            line.orderNo());
                }
                BigDecimal q = addDelta(base.quantity(), dq);
                BigDecimal a = addDelta(base.amount(), da);
                if ((q != null && q.signum() < 0) || (a != null && a.signum() < 0)) {
                    throw new IllegalArgumentException("Điều chỉnh chỉ tiêu " + line.indicatorCode()
                            + " làm số của một đơn vị bị âm — hãy chọn đơn vị khác hoặc điều chỉnh chung.");
                }
                desired.put(unitKey, base.withValues(q, a, base.allocatedAmount(), reason));
            }
        }
        return new Plan(desired, preview, missing);
    }

    /** So trạng thái mong muốn với hiện hành: dòng đổi (kèm dòng cũ bị thay) và dòng bỏ. */
    public static Diff diff(List<LineState> current, Map<String, LineState> targets) {
        Map<String, LineState> remaining = index(current);
        List<LineState> changed = new ArrayList<>();
        List<LineState> replaced = new ArrayList<>();
        for (LineState target : targets.values()) {
            LineState previous = remaining.remove(target.key());
            if (previous != null && sameContent(previous, target)) {
                continue;
            }
            changed.add(target);
            replaced.add(previous);
        }
        return new Diff(changed, replaced, List.copyOf(remaining.values()));
    }

    /** Tổng một chỉ tiêu × slot qua các dòng. */
    public static Totals totals(List<LineState> rows, String indicatorCode, DeptLedgerSlot slot) {
        BigDecimal q = null;
        BigDecimal a = null;
        BigDecimal sq = null;
        BigDecimal sa = null;
        BigDecimal allocated = null;
        MeasureKind measureKind = null;
        String reason = null;
        for (LineState row : rows) {
            if (!indicatorCode.equals(row.indicatorCode()) || row.slot() != slot) {
                continue;
            }
            if (measureKind == null) {
                measureKind = row.measureKind();
            }
            if (reason == null) {
                reason = row.reason();
            }
            boolean keepSingle = row.measureKind() == MeasureKind.DON_GIA;
            q = keepSingle ? firstNonNull(q, row.quantity()) : add(q, row.quantity());
            a = keepSingle ? firstNonNull(a, row.amount()) : add(a, row.amount());
            sq = keepSingle ? firstNonNull(sq, row.sourceQuantity()) : add(sq, row.sourceQuantity());
            sa = keepSingle ? firstNonNull(sa, row.sourceAmount()) : add(sa, row.sourceAmount());
            allocated = add(allocated, row.allocatedAmount());
        }
        return new Totals(q, a, sq, sa, allocated, measureKind, reason);
    }

    // ------------------------------------------------------------------ tiện ích (dùng chung)

    public static String lineKey(String unitKey, String indicatorCode, DeptLedgerSlot slot) {
        return unitKey + "|" + indicatorCode + "|" + (slot == null ? DeptLedgerSlot.ALL : slot).name();
    }

    /** Mã đơn vị script trả → khoá dòng: rỗng / {@code TONG_HOP} = dòng điều chỉnh chung. */
    public static String unitKeyOf(String organizationCode) {
        String code = trimToNull(organizationCode);
        return code == null || SummaryAggregator.MERGED_CODE.equals(code) ? DeptLedgerLine.MERGED_UNIT_KEY : code;
    }

    /**
     * Có điều chỉnh không: số lượng khác số gốc; kinh phí chỉ so khi nguồn CÓ kinh phí (kinh phí do
     * công thức tính không nằm trong số liệu đơn vị — so với null sẽ báo điều chỉnh giả).
     */
    public static boolean isAdjusted(BigDecimal srcQ, BigDecimal srcA, BigDecimal q, BigDecimal a) {
        boolean quantityChanged = (srcQ != null || q != null) && !sameNumber(srcQ, q);
        boolean amountChanged = srcA != null && !sameNumber(srcA, a);
        return quantityChanged || amountChanged;
    }

    public static boolean sameNumber(BigDecimal left, BigDecimal right) {
        if (left == null || right == null) {
            return left == right;
        }
        return left.compareTo(right) == 0;
    }

    /** Bỏ số 0 thừa sau dấu phẩy, không làm tròn ({@code 12.500 → 12.5}, {@code 1E+2 → 100}). */
    public static BigDecimal exact(BigDecimal value) {
        if (value == null) {
            return null;
        }
        BigDecimal stripped = value.stripTrailingZeros();
        return stripped.scale() < 0 ? stripped.setScale(0) : stripped;
    }

    public static boolean numbersChanged(LineState before, LineState after) {
        return !sameNumber(before.quantity(), after.quantity()) || !sameNumber(before.amount(), after.amount())
                || !sameNumber(before.allocatedAmount(), after.allocatedAmount());
    }

    static boolean sameContent(LineState before, LineState after) {
        return !numbersChanged(before, after)
                && sameNumber(before.sourceQuantity(), after.sourceQuantity())
                && sameNumber(before.sourceAmount(), after.sourceAmount())
                && Objects.equals(before.reason(), after.reason());
    }

    public static Map<String, LineState> index(List<LineState> lines) {
        Map<String, LineState> index = new LinkedHashMap<>();
        for (LineState line : lines) {
            index.put(line.key(), line);
        }
        return index;
    }

    static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static LineState newMerged(Extracted line, MeasureKind measureKind, BigDecimal allocated) {
        return new LineState(null, DeptLedgerLine.MERGED_UNIT_KEY, null, line.indicatorCode(), line.indicatorName(),
                line.slot(), measureKind, null, null, null, null, allocated, null, line.orderNo());
    }

    private static void requireNonNegative(BigDecimal q, BigDecimal a, String indicatorCode) {
        if ((q != null && q.signum() < 0) || (a != null && a.signum() < 0)) {
            throw new IllegalArgumentException("Chỉ tiêu " + indicatorCode + " có số âm — số liệu không nhận số âm.");
        }
    }

    /** Kiểm độ lớn; dấu kiểm riêng (dòng điều chỉnh chung được phép âm). */
    private static BigDecimal checked(BigDecimal value, String indicatorCode) {
        BigDecimal exact = exact(value);
        if (exact == null) {
            return null;
        }
        if (exact.precision() - exact.scale() > MAX_INTEGER_DIGITS) {
            throw new IllegalArgumentException("Chỉ tiêu " + indicatorCode + " có số quá lớn.");
        }
        return exact;
    }

    private static String reasonText(ReasonInput input) {
        return input == null ? null : trimToNull(input.text());
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static BigDecimal addDelta(BigDecimal base, BigDecimal delta) {
        if (delta.signum() == 0) {
            return base;
        }
        return exact(nz(base).add(delta));
    }

    private static BigDecimal add(BigDecimal left, BigDecimal right) {
        if (left == null) {
            return right;
        }
        return right == null ? left : left.add(right);
    }

    private static BigDecimal firstNonNull(BigDecimal left, BigDecimal right) {
        return left != null ? left : right;
    }
}
