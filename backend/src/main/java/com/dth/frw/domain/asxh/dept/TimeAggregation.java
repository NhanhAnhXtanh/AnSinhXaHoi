package com.dth.frw.domain.asxh.dept;

/**
 * Cách gộp một đại lượng qua TRỤC THỜI GIAN (nhiều kỳ con của một kỳ tổng) — port nguyên
 * {@code TimeAggregation} của bản Jmix.
 *
 * <p>Không lưu DB; chỉ diễn giải {@link MeasureKind} thành phép gộp. Trục ĐƠN VỊ luôn là cộng và do
 * công thức trong workbook thực hiện (BR-50.3), không phải ở đây.
 */
public enum TimeAggregation {

    /** Cộng dồn qua các kỳ — tiền, lượt, số tháng. */
    SUM,

    /** Lấy giá trị lớn nhất trong các kỳ — số người/hộ, tránh đếm trùng một đối tượng. */
    MAX,

    /** Lấy giá trị của kỳ mới nhất — đơn giá, định mức (cộng dồn sẽ sai gấp N lần). */
    LAST
}
