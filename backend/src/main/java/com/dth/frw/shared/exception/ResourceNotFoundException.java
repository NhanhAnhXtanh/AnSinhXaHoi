package com.dth.frw.shared.exception;

import java.util.Locale;
import java.util.Map;

/**
 * Raised when a resource is addressed by an id that does not exist.
 *
 * <p>The message is read by the people using the screens — cán bộ xã, huyện —
 * so it is Vietnamese and carries no id: "Không tìm thấy phiếu nhập. Có thể dữ
 * liệu đã bị xoá hoặc đường dẫn không còn đúng." The id stays available through
 * {@link #id()} for logs.
 *
 * <p>Callers pass the resource either as a Vietnamese label ("Kỳ báo cáo",
 * "Đơn vị") or, in the slices written before that convention, as an English
 * entity name ("InputReport", "User"); the second kind is translated here so
 * that no caller has to change for the user to read Vietnamese.
 */
public class ResourceNotFoundException extends RuntimeException {

    /** English entity names used by existing callers → what a cán bộ calls them. */
    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("inputreport", "phiếu nhập"),
            Map.entry("inputreportsheet", "biểu trong phiếu nhập"),
            Map.entry("publication", "đợt báo cáo"),
            Map.entry("periodassignment", "thiết lập của kỳ"),
            Map.entry("reportunit", "đơn vị"),
            Map.entry("reportperiod", "kỳ báo cáo"),
            Map.entry("reportcalendar", "lịch báo cáo"),
            Map.entry("templateset", "bộ biểu mẫu"),
            Map.entry("template", "biểu mẫu"),
            Map.entry("templateversion", "phiên bản biểu mẫu"),
            Map.entry("task", "công việc"),
            Map.entry("organization", "tổ chức"),
            Map.entry("department", "phòng ban"),
            Map.entry("category", "danh mục"),
            Map.entry("blogpost", "bài viết"),
            Map.entry("user", "người dùng"),
            Map.entry("role", "vai trò"),
            Map.entry("permission", "quyền"),
            Map.entry("rowlevelpolicy", "phạm vi dữ liệu"),
            Map.entry("notification", "thông báo"));

    private final String resource;
    private final Object id;

    public ResourceNotFoundException(String resource, Object id) {
        super("Không tìm thấy %s. Có thể dữ liệu đã bị xoá hoặc đường dẫn không còn đúng."
                .formatted(label(resource)));
        this.resource = resource;
        this.id = id;
    }

    /** The resource name exactly as the caller passed it. */
    public String resource() {
        return resource;
    }

    /** The id that was not found — for logs, never for the message. */
    public Object id() {
        return id;
    }

    static String label(String resource) {
        if (resource == null || resource.isBlank()) {
            return "dữ liệu cần tìm";
        }
        String key = resource.replaceAll("[^A-Za-z]", "").toLowerCase(Locale.ROOT);
        String known = LABELS.get(key);
        if (known != null) {
            return known;
        }
        String trimmed = resource.strip();
        // An English name nobody has translated yet: say nothing rather than
        // show the user a class name.
        if (trimmed.chars().allMatch(c -> c < 128)) {
            return "dữ liệu cần tìm";
        }
        // A Vietnamese label from the caller: lower-case its first letter so it
        // reads inside the sentence ("Không tìm thấy kỳ báo cáo").
        return trimmed.substring(0, 1).toLowerCase(Locale.ROOT) + trimmed.substring(1);
    }
}
