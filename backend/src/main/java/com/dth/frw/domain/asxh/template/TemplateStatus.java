package com.dth.frw.domain.asxh.template;

/**
 * Trạng thái phiên bản mẫu — port nguyên từ {@code TemplateStatus} của bản Jmix.
 *
 * <pre>
 *   DRAFT --ban hành--> PUBLISHED --khoá--> LOCKED --mở khoá--> PUBLISHED
 *   PUBLISHED --thu hồi--> REVOKED (chót, không quay lại)
 * </pre>
 *
 * <p>Chỉ {@link #PUBLISHED} được chọn khi hệ thống tìm phiên bản áp dụng theo
 * ngày (UC-19, BR-19.2) — khoá, thu hồi, nháp đều bị bỏ qua.
 */
public enum TemplateStatus {

    /** Nháp — sửa được workbook, script, ngày áp dụng. */
    DRAFT,

    /**
     * Đang thử nghiệm — ĐÃ BỎ (Q-22): không thao tác nào tạo ra nữa. Giữ hằng để dòng
     * cũ trong DB vẫn đọc được; bản nào còn ở trạng thái này được xử lý y như nháp.
     */
    TESTING,

    /** Đã ban hành — bất biến (workbook, script, ngày áp dụng). */
    PUBLISHED,

    /**
     * Đã khoá — tạm cất: không còn được chọn cho đợt báo cáo mới, phiếu đã lập
     * vẫn nhập/duyệt bình thường; mở khoá được.
     */
    LOCKED,

    /** Đã thu hồi — bản ban hành nhầm, ngừng dùng vĩnh viễn. */
    REVOKED,

    /** Lưu trữ — giữ cho đủ bộ giá trị của bản cũ, không thao tác nào dùng. */
    ARCHIVED;

    /** Sửa được nội dung (workbook, script, ngày áp dụng) hay không. */
    public boolean editable() {
        return this == DRAFT || this == TESTING;
    }

    /** Đọc giá trị lọc từ query string; {@code null} nếu không khớp hằng nào. */
    public static TemplateStatus parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (TemplateStatus status : values()) {
            if (status.name().equalsIgnoreCase(raw.trim())) {
                return status;
            }
        }
        return null;
    }
}
