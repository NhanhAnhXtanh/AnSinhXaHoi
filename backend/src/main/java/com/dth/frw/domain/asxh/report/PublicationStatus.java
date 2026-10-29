package com.dth.frw.domain.asxh.report;

/**
 * Hiệu lực của một đợt phát hành.
 *
 * <p>Không có trong hợp đồng gốc (chỉ liệt kê {@code kind}) nhưng cần cho UC-29: thu hồi kỳ
 * vô hiệu các đợt đã phát để lần mở sau được tính là LẦN ĐẦU, đồng thời vẫn giữ bản ghi đợt cũ
 * cho lịch sử mở đợt (UC-30).
 */
public enum PublicationStatus {

    /** Đã tạo phiếu — đợt đang có hiệu lực. */
    PUBLISHED,

    /** Đã thu hồi cùng kỳ (UC-29). Không còn tính là "kỳ đã mở đợt". */
    CANCELLED;

    public static PublicationStatus parse(String raw) {
        if (raw == null) {
            return null;
        }
        for (PublicationStatus status : values()) {
            if (status.name().equalsIgnoreCase(raw.trim())) {
                return status;
            }
        }
        return null;
    }
}
