package com.dth.frw.domain.asxh.period;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Trạng thái kỳ báo cáo (sơ đồ ở {@code 03-ky-thiet-lap.md}).
 *
 * <table>
 *   <caption>Nhãn hiển thị</caption>
 *   <tr><td>DRAFT</td><td>Chưa thiết lập</td></tr>
 *   <tr><td>READY</td><td>Đã thiết lập</td></tr>
 *   <tr><td>PUBLISHED</td><td>Chưa mở</td></tr>
 *   <tr><td>OPEN</td><td>Đang mở — điều kiện duy nhất để đơn vị nhập/nộp</td></tr>
 *   <tr><td>OVERDUE</td><td>Quá hạn — đơn vị bị khoá nhập và nộp</td></tr>
 *   <tr><td>CLOSED</td><td>Đã đóng (đã chốt đợt)</td></tr>
 *   <tr><td>LOCKED</td><td>Đã khoá</td></tr>
 *   <tr><td>CANCELLED</td><td>Đã huỷ</td></tr>
 * </table>
 *
 * <p>Giá trị dây chữ thường, cột DB lưu tên hằng.
 */
public enum PeriodStatus {

    DRAFT,
    READY,
    PUBLISHED,
    OPEN,
    OVERDUE,
    CLOSED,
    LOCKED,
    CANCELLED;

    /**
     * Bảng chuyển trạng thái hợp lệ — gộp bảng {@code TRANSITIONS} của
     * {@code ReportPeriodLifecycleService} cũ với các nhánh tự động ở sơ đồ trạng thái
     * (READY ⇄ DRAFT khi gán/gỡ thiết lập, READY → OPEN khi mở đợt, thu hồi về READY,
     * job PUBLISHED/OPEN → OVERDUE, gia hạn OVERDUE → OPEN).
     */
    private static final Map<PeriodStatus, Set<PeriodStatus>> TRANSITIONS = Map.of(
            DRAFT, EnumSet.of(READY, CANCELLED),
            READY, EnumSet.of(DRAFT, PUBLISHED, OPEN, CANCELLED),
            PUBLISHED, EnumSet.of(OPEN, OVERDUE, READY, CANCELLED),
            OPEN, EnumSet.of(OVERDUE, CLOSED, READY, CANCELLED),
            OVERDUE, EnumSet.of(OPEN, CLOSED, READY, CANCELLED),
            CLOSED, EnumSet.of(LOCKED));

    /** Có được chuyển từ trạng thái này sang {@code target} không. */
    public boolean canMoveTo(PeriodStatus target) {
        return TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }

    /** Nhãn tiếng Việt cho thông báo lỗi. */
    public String label() {
        return switch (this) {
            case DRAFT -> "Chưa thiết lập";
            case READY -> "Đã thiết lập";
            case PUBLISHED -> "Chưa mở";
            case OPEN -> "Đang mở";
            case OVERDUE -> "Quá hạn";
            case CLOSED -> "Đã đóng";
            case LOCKED -> "Đã khoá";
            case CANCELLED -> "Đã huỷ";
        };
    }

    @JsonValue
    public String getValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static PeriodStatus from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (PeriodStatus status : values()) {
            if (status.name().equalsIgnoreCase(raw.trim())) {
                return status;
            }
        }
        throw new IllegalArgumentException("Trạng thái kỳ không hợp lệ: " + raw);
    }
}
