package com.dth.frw.domain.asxh.report;

import java.util.EnumSet;
import java.util.Set;

/**
 * Trạng thái phiếu nhập (UC-33..43).
 *
 * <pre>
 *   (mở đợt) -> DRAFT -> SUBMITTED -> APPROVED
 *                          |-> SUPERSEDED (bản cũ khi Sở trả lại)
 *   (trả lại) -> RETURNED (phiên bản n+1) -> SUBMITTED
 *   DRAFT / RETURNED -> LOCKED (chốt đợt)
 * </pre>
 *
 * <p>{@link #SUPERSEDED} không có trong hợp đồng nhưng là nửa còn lại của UC-42: trả lại
 * KHÔNG sửa đè phiếu đã nộp mà đóng băng nó thành bản cũ và sinh phiên bản kế tiếp ở
 * {@link #RETURNED}. Nhờ vậy mọi cổng sửa/nộp chỉ cần xét tập {@link #EDITABLE}.
 */
public enum ReportStatus {

    /** Đang nhập liệu / Chưa nộp. */
    DRAFT,

    /** Chờ Sở duyệt. */
    SUBMITTED,

    /** Đã phê duyệt — bất biến. */
    APPROVED,

    /** Bị trả lại — phiên bản mới cho đơn vị sửa và nộp lại. */
    RETURNED,

    /** Đã chốt (khoá khi Sở chốt đợt). */
    LOCKED,

    /** Đã huỷ. */
    CANCELLED,

    /** Bản cũ — đã được thay bằng phiên bản kế tiếp khi Sở trả lại; chỉ xem. */
    SUPERSEDED;

    /** Phiếu còn sửa được, còn nhận thêm biểu ở đợt bổ sung. */
    public static final Set<ReportStatus> EDITABLE = EnumSet.of(DRAFT, RETURNED);

    public boolean isEditable() {
        return EDITABLE.contains(this);
    }

    public static ReportStatus parse(String raw) {
        if (raw == null) {
            return null;
        }
        for (ReportStatus status : values()) {
            if (status.name().equalsIgnoreCase(raw.trim())) {
                return status;
            }
        }
        return null;
    }
}
