package com.dth.frw.module.asxh.script;

/**
 * Lỗi khi biên dịch / chạy script của phiên bản mẫu ở phía máy chủ (port
 * {@code ServerScriptException} của bản Jmix).
 *
 * <p>Ba loại, vì người gọi trả về ba câu khác nhau cho cán bộ:
 * <ul>
 *   <li>{@link Kind#DATA} — chính script báo lỗi số liệu ({@code ctx.issues.add} mức ERROR) hoặc
 *       trả về giá trị không phải số. Thông điệp là chữ nghiệp vụ, đưa thẳng cho người dùng được.</li>
 *   <li>{@link Kind#TIMEOUT} — bị huỷ vì quá thời gian hoặc vượt giới hạn số câu lệnh.</li>
 *   <li>{@link Kind#MEMORY} — script dùng hết bộ nhớ máy chủ (dựng mảng / chuỗi khổng lồ). Trước đây
 *       bị gộp vào {@code TIMEOUT} nên cán bộ nhận câu "quá thời gian" dù script dừng ngay.</li>
 *   <li>{@link Kind#SCRIPT} — mẫu biểu viết sai (biên dịch lỗi, ném ngoại lệ, gọi API chỉ có ở
 *       trình duyệt). Thông điệp mang chi tiết kỹ thuật — chỉ ghi nhật ký, không đưa cho cán bộ.</li>
 * </ul>
 */
public class ServerScriptException extends RuntimeException {

    public enum Kind {
        DATA,
        TIMEOUT,
        MEMORY,
        SCRIPT
    }

    private final Kind kind;

    public ServerScriptException(Kind kind, String message) {
        super(message);
        this.kind = kind;
    }

    public ServerScriptException(Kind kind, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
    }

    public Kind kind() {
        return kind;
    }

    public boolean isTimeout() {
        return kind == Kind.TIMEOUT;
    }
}
