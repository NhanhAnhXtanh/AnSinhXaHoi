package com.dth.frw.domain.asxh.unit;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/**
 * Khối của đơn vị — cấp ngân sách mà số liệu của đơn vị được gộp vào khi tổng hợp
 * (Khối tỉnh / Khối huyện / Khối xã).
 *
 * <p>Giá trị dây chữ thường, cột DB lưu tên hằng.
 */
public enum ReportBlock {

    TINH,

    HUYEN,

    XA;

    @JsonValue
    public String getValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static ReportBlock from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (ReportBlock block : values()) {
            if (block.name().equalsIgnoreCase(raw.trim())) {
                return block;
            }
        }
        throw new IllegalArgumentException("Khối không hợp lệ: " + raw);
    }
}
