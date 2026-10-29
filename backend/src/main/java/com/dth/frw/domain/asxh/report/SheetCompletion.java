package com.dth.frw.domain.asxh.report;

/**
 * Tình trạng nhập của MỘT biểu trong phiếu (UC-35..37).
 *
 * <p>Phiếu chỉ nộp được khi mọi biểu đã {@link #isDone() xong}. Biểu đã đánh dấu xong
 * ({@link #COMPLETED} hoặc {@link #NO_DATA}) chuyển sang chỉ đọc — muốn sửa phải "Sửa lại".
 */
public enum SheetCompletion {

    /** Vừa phát, chưa lưu số liệu lần nào. */
    NOT_STARTED,

    /** Đang nhập — đã lưu ít nhất một lần, chưa đánh dấu xong. */
    IN_PROGRESS,

    /** Đã nhập xong (đã qua kiểm tra của mẫu); biểu khoá lại. */
    COMPLETED,

    /** Kỳ này đơn vị không phát sinh số liệu: không kiểm tra, vẫn tính là xong. */
    NO_DATA;

    public boolean isDone() {
        return this == COMPLETED || this == NO_DATA;
    }

    public static SheetCompletion parse(String raw) {
        if (raw == null) {
            return null;
        }
        for (SheetCompletion value : values()) {
            if (value.name().equalsIgnoreCase(raw.trim())) {
                return value;
            }
        }
        return null;
    }
}
