package com.dth.frw.domain.asxh.report;

/**
 * Loại đợt phát hành phiếu của một kỳ.
 *
 * <p>Lưu {@code varchar} theo tên hằng (EnumType.STRING) và đi ra JSON đúng tên hằng.
 */
public enum PublicationKind {

    /** Mở đợt lần đầu (UC-24) — mỗi kỳ chỉ một lần, trừ khi đã thu hồi (UC-29). */
    LAN_DAU,

    /** Đợt bổ sung khi kỳ đang mở (UC-26): chỉ phát các ô (đơn vị × biểu) chưa từng phát. */
    BO_SUNG;

    /** Đọc giá trị từ chuỗi lọc, không phân biệt hoa thường; {@code null} khi không khớp. */
    public static PublicationKind parse(String raw) {
        if (raw == null) {
            return null;
        }
        for (PublicationKind kind : values()) {
            if (kind.name().equalsIgnoreCase(raw.trim())) {
                return kind;
            }
        }
        return null;
    }
}
