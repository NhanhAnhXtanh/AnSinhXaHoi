package com.dth.frw.domain.asxh.unit;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/**
 * Loại đơn vị báo cáo (UC-01).
 *
 * <p>Cùng quy ước dây với {@code OrganizationStatus}: giao diện gửi và hiển thị
 * giá trị chữ thường ({@code "ubnd_xa"}), hằng số Java giữ chữ hoa; cột DB lưu
 * tên hằng ({@code EnumType.STRING}).
 *
 * <p>Bản Jmix cũ có {@code TINH, SO, TRUONG, XA, KHAC}; bản mới tách UBND cấp
 * huyện và cấp xã để lọc "Khối" ở ma trận thiết lập (BR-01.4) khỏi phải đoán.
 */
public enum ReportUnitType {

    /** Cấp tỉnh (UBND tỉnh). */
    TINH,

    /** Sở, ngành cấp tỉnh. */
    SO,

    /** UBND cấp huyện / thành phố thuộc tỉnh. */
    UBND_HUYEN,

    /** UBND cấp xã / phường / thị trấn. */
    UBND_XA,

    /** Trường học. */
    TRUONG,

    /** Đơn vị khác. */
    KHAC;

    @JsonValue
    public String getValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static ReportUnitType from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (ReportUnitType type : values()) {
            if (type.name().equalsIgnoreCase(raw.trim())) {
                return type;
            }
        }
        throw new IllegalArgumentException("Loại đơn vị không hợp lệ: " + raw);
    }

    /** Khối mặc định khi người dùng không chọn. */
    public ReportBlock defaultBlock() {
        return switch (this) {
            case UBND_HUYEN -> ReportBlock.HUYEN;
            case UBND_XA -> ReportBlock.XA;
            default -> ReportBlock.TINH;
        };
    }
}
