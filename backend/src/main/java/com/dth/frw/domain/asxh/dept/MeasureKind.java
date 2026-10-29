package com.dth.frw.domain.asxh.dept;

/**
 * Bản chất đại lượng của một chỉ tiêu — quyết định cách gộp khi tổng hợp NHIỀU KỲ (port nguyên
 * {@code MeasureKind} của bản Jmix, BR-50.3).
 *
 * <p>Một dòng số liệu chỉ có hai ô số ({@code quantity}, {@code amount}) nhưng các biểu nhét vào
 * đó bốn loại đại lượng khác nhau (số trẻ, mức hỗ trợ, số tháng, kinh phí). Cộng dồn tất cả như
 * nhau sẽ nhân ba đơn giá và nuốt mất số tháng, nên mỗi chỉ tiêu khai bản chất của mình MỘT lần ở
 * {@link IndicatorMeasure}. Gộp MỘT kỳ thì ba quy tắc cho cùng kết quả.
 *
 * <p>Lưu và trả ra đúng tên hằng ({@code "NGUOI"}) — script cũ đọc {@code measureKind} dạng này.
 */
public enum MeasureKind {

    /** Người/hộ hưởng thường xuyên: cùng một đối tượng xuất hiện ở mọi kỳ. */
    NGUOI(TimeAggregation.MAX, TimeAggregation.SUM),

    /** Lượt hưởng, hỗ trợ một lần: mỗi kỳ là một sự kiện riêng. */
    LUOT(TimeAggregation.SUM, TimeAggregation.SUM),

    /** Mức hỗ trợ, đơn giá, định mức: giữ nguyên, không cộng dồn. */
    DON_GIA(TimeAggregation.LAST, TimeAggregation.LAST),

    /** Số tháng/định suất được hỗ trợ: cộng dồn theo độ dài kỳ. */
    THOI_GIAN(TimeAggregation.SUM, TimeAggregation.SUM),

    /** Chỉ tiêu thuần tiền (không có số đối tượng đi kèm). */
    TIEN(TimeAggregation.SUM, TimeAggregation.SUM);

    /**
     * Loại cho chỉ tiêu CHƯA phân loại. Cố tình là {@link #NGUOI} — hành vi của bản Jmix trước khi
     * có phân loại (số đối tượng lấy MAX, tiền cộng), để không làm đổi số đã phát hành.
     */
    public static final MeasureKind DEFAULT = NGUOI;

    private final TimeAggregation quantityRule;
    private final TimeAggregation amountRule;

    MeasureKind(TimeAggregation quantityRule, TimeAggregation amountRule) {
        this.quantityRule = quantityRule;
        this.amountRule = amountRule;
    }

    /** Phép gộp cột {@code quantity} khi kỳ tổng có nhiều kỳ con. */
    public TimeAggregation quantityRule() {
        return quantityRule;
    }

    /** Phép gộp cột {@code amount} khi kỳ tổng có nhiều kỳ con. */
    public TimeAggregation amountRule() {
        return amountRule;
    }

    /** {@code null} → {@link #DEFAULT}. */
    public static MeasureKind orDefault(MeasureKind value) {
        return value == null ? DEFAULT : value;
    }

    /** Đọc tên hằng (không phân biệt hoa thường); không khớp → {@code null}. */
    public static MeasureKind parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (MeasureKind kind : values()) {
            if (kind.name().equalsIgnoreCase(raw.trim())) {
                return kind;
            }
        }
        return null;
    }
}
