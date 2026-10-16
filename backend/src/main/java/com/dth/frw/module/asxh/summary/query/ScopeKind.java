package com.dth.frw.module.asxh.summary.query;

/**
 * Phạm vi đơn vị của bảng tổng hợp (UC-51) — port {@code OrganizationScopeKind}, thêm {@link #BLOCK}
 * vì bản mới có "khối" (tỉnh / huyện / xã) riêng với loại đơn vị.
 */
public enum ScopeKind {

    /** Mọi đơn vị (toàn tỉnh). */
    ALL,

    /** Một đơn vị. */
    ORGANIZATION,

    /** Một đơn vị và mọi đơn vị cấp dưới. */
    ORG_TREE,

    /** Mọi đơn vị cùng loại ({@code orgType}). */
    ORG_TYPE,

    /** Mọi đơn vị cùng khối ({@code block}). */
    BLOCK;

    /** Đọc tên hằng; rỗng → {@code null}; sai → lỗi tiếng Việt. */
    public static ScopeKind parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (ScopeKind kind : values()) {
            if (kind.name().equalsIgnoreCase(raw.trim())) {
                return kind;
            }
        }
        throw new IllegalArgumentException("Phạm vi đơn vị không hợp lệ.");
    }
}
