package com.dth.frw.domain.asxh.period;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/**
 * Loại kỳ báo cáo — bốn loại màn lịch cho chọn (BR-20.1).
 *
 * <p>Port từ {@code PeriodType} của bản Jmix; bỏ {@code H1/H2/HALF_YEAR} trùng nghĩa
 * (gộp thành {@link #SAU_THANG}), bỏ {@code SEMESTER} (luồng năm học không màn nào
 * gọi — UC-20 1a) và {@code CUSTOM}.
 *
 * <p>Giá trị dây chữ thường ({@code "sau_thang"}), cột DB lưu tên hằng.
 */
public enum PeriodKind {

    /** Tháng: T1…T12. */
    THANG(12),

    /** Quý dương lịch đủ 3 tháng: Q1…Q4. */
    QUY(4),

    /** Sáu tháng: 6TĐN (T1–6), 6TCN (T7–12). */
    SAU_THANG(2),

    /** Cả năm: NAM. */
    NAM(1);

    private final int periodsPerYear;

    PeriodKind(int periodsPerYear) {
        this.periodsPerYear = periodsPerYear;
    }

    /** Số kỳ của loại này trong một năm dương lịch. */
    public int periodsPerYear() {
        return periodsPerYear;
    }

    @JsonValue
    public String getValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static PeriodKind from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (PeriodKind kind : values()) {
            if (kind.name().equalsIgnoreCase(raw.trim())) {
                return kind;
            }
        }
        throw new IllegalArgumentException("Loại kỳ không hợp lệ: " + raw);
    }
}
