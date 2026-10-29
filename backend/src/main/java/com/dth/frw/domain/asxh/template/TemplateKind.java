package com.dth.frw.domain.asxh.template;

/**
 * Loại biểu.
 *
 * <p>Port từ {@code TemplateVersionKind} của bản Jmix ({@code INPUT} →
 * {@link #CHI_TIET}, {@code YEAR_SUMMARY} → {@link #TONG_HOP}). Bản cũ để loại ở
 * từng phiên bản rồi bắt bản kế tiếp kế thừa; ở đây loại nằm trên biểu nên mọi
 * phiên bản tự cùng loại (BR-10.2).
 *
 * <p>Lưu và trả ra đúng tên hằng ({@code "CHI_TIET"}), cột {@code varchar}.
 */
public enum TemplateKind {

    /** Biểu chi tiết — đơn vị nhập số; hiện ở ma trận thiết lập kỳ. */
    CHI_TIET,

    /** Biểu tổng hợp — chỉ dùng ở màn Tổng hợp, không giao cho đơn vị nhập. */
    TONG_HOP;

    /** Đọc giá trị lọc từ query string; {@code null} nếu không khớp hằng nào. */
    public static TemplateKind parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (TemplateKind kind : values()) {
            if (kind.name().equalsIgnoreCase(raw.trim())) {
                return kind;
            }
        }
        return null;
    }
}
