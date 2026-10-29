package com.dth.frw.domain.asxh.dept;

/**
 * Ô thời gian của một dòng số liệu Sở (port {@code DeptLedgerSlot}). Số liệu kỳ luôn là
 * {@link #ALL}; ba giá trị còn lại để dành cho số liệu theo nửa năm / cả năm nếu báo cáo năm cần
 * lưu riêng (agent BÁO CÁO NĂM quyết định).
 */
public enum DeptLedgerSlot {

    /** Cả kỳ — mọi dòng của số liệu Sở theo kỳ. */
    ALL,

    /** Nửa đầu năm (T1–T6). */
    HK1,

    /** Nửa cuối năm (T7–T12). */
    HK2,

    /** Cả năm. */
    YEAR;

    /** Rỗng / {@code null} → {@link #ALL}; không khớp → {@code null}. */
    public static DeptLedgerSlot parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return ALL;
        }
        for (DeptLedgerSlot slot : values()) {
            if (slot.name().equalsIgnoreCase(raw.trim())) {
                return slot;
            }
        }
        return null;
    }
}
