package com.dth.frw.domain.asxh.annual;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/**
 * Trạng thái một lần Sở nộp báo cáo năm lên UBND ("Phiếu n") — UC-59, UC-63..66.
 *
 * <p>Phiếu năm KHÔNG có bản nháp: tạo ra là {@link #SUBMITTED}. Bị trả lại (hoặc mở lại sau khi
 * duyệt) thì dừng hẳn ở {@link #RETURNED}; Sở nộp tiếp là một phiếu MỚI (Phiếu n+1).
 *
 * <p><b>Một năm chỉ một phiếu còn hiệu lực</b> ({@link #isActive()}): đang chờ hoặc đã duyệt. Giá trị
 * dây chữ thường, cột DB lưu tên hằng.
 */
public enum AnnualReportStatus {

    /** Chờ UBND duyệt — năm bị khoá sửa. */
    SUBMITTED,

    /** UBND đã duyệt — năm bị khoá sửa. */
    APPROVED,

    /** UBND trả lại hoặc mở lại — phiếu dừng, năm mở khoá. */
    RETURNED;

    /** Phiếu còn hiệu lực (đang khoá năm). */
    public boolean isActive() {
        return this == SUBMITTED || this == APPROVED;
    }

    /** Nhãn tiếng Việt. */
    public String label() {
        return switch (this) {
            case SUBMITTED -> "Chờ UBND duyệt";
            case APPROVED -> "UBND đã duyệt";
            case RETURNED -> "UBND trả lại";
        };
    }

    @JsonValue
    public String getValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static AnnualReportStatus from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return valueOf(raw.trim().toUpperCase(Locale.ROOT));
    }
}
