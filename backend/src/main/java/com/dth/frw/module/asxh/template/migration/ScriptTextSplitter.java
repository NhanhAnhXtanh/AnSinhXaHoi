package com.dth.frw.module.asxh.template.migration;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Tách cột {@code asxh_template_versions.script_text} (một chuỗi gộp nhiều kịch bản) thành các
 * kịch bản riêng như bản Jmix — dùng cho changeset 171 và có test riêng.
 *
 * <p>Ba dạng dữ liệu gặp được:
 * <ol>
 *   <li><b>Khối Jmix</b> — mỗi khối mở đầu bằng dòng
 *       {@code // ===== [Khối Jmix k/n] <tên> — hook: <hook,hook> =====} và bọc trong
 *       {@code (function () { … })();}. Tên và hook khai lấy từ dòng đánh dấu; lớp bọc được gỡ để
 *       còn đúng mã gốc (kết thúc bằng {@code return defineScript({...})}). Chú thích trước dòng
 *       đánh dấu đầu tiên chỉ mô tả việc ghép nên bỏ; nếu ở đó có MÃ thật thì giữ thành một kịch
 *       bản riêng "Phần đầu script" để không mất gì.</li>
 *   <li><b>Mảng JSON</b> {@code [{ name, code, sheetCode?, description?, displayOrder?, enabled? }]}
 *       — mỗi phần tử có {@code code} là một kịch bản, giữ nguyên các trường có sẵn.</li>
 *   <li>Còn lại — cả đoạn là một kịch bản "Script của mẫu" (dạng {@code return defineScript}
 *       một khối, hoặc gọi {@code defineScript} nhiều lần: máy chạy vẫn gom đủ).</li>
 * </ol>
 * Chuỗi rỗng → không kịch bản nào.
 */
public final class ScriptTextSplitter {

    /** Tên kịch bản khi chuỗi gộp không có dòng đánh dấu. */
    public static final String WHOLE_SCRIPT_NAME = "Script của mẫu";

    /** Tên kịch bản giữ phần mã đứng trước dòng đánh dấu đầu tiên (nếu có). */
    public static final String PREAMBLE_NAME = "Phần đầu script";

    private static final Pattern MARKER = Pattern.compile(
            "^// ===== \\[Khối Jmix (\\d+)/(\\d+)\\] (.*?) — hook: (.*?) =====[ \\t]*\\r?$",
            Pattern.MULTILINE);

    private static final Pattern WRAP_OPEN = Pattern.compile("\\A\\(function\\s*\\(\\)\\s*\\{[ \\t]*\\r?\\n");
    private static final Pattern WRAP_CLOSE = Pattern.compile("\\r?\\n\\}\\)\\(\\);?\\s*\\z");

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private ScriptTextSplitter() {
    }

    /** Một kịch bản tách được. {@code markerTotal} là n của "k/n" (null nếu không phải khối Jmix). */
    public record Part(String name, String code, String declaredHooks, String sheetCode,
                       String description, int displayOrder, boolean enabled, Integer markerTotal) {
    }

    public static List<Part> split(String scriptText) {
        String text = scriptText == null ? "" : scriptText;
        if (text.isBlank()) {
            return List.of();
        }
        Matcher matcher = MARKER.matcher(text);
        List<int[]> spans = new ArrayList<>();
        List<String[]> heads = new ArrayList<>();
        while (matcher.find()) {
            spans.add(new int[]{matcher.start(), matcher.end()});
            heads.add(new String[]{matcher.group(3).trim(), matcher.group(4).trim(), matcher.group(2)});
        }
        if (!spans.isEmpty()) {
            return splitMarked(text, spans, heads);
        }
        List<Part> fromJson = splitJsonArray(text);
        if (fromJson != null) {
            return fromJson;
        }
        return List.of(new Part(WHOLE_SCRIPT_NAME, text, null, null, null, 0, true, null));
    }

    private static List<Part> splitMarked(String text, List<int[]> spans, List<String[]> heads) {
        List<Part> parts = new ArrayList<>();
        int order = 0;
        String preamble = text.substring(0, spans.get(0)[0]);
        if (hasCode(preamble)) {
            parts.add(new Part(PREAMBLE_NAME, preamble.strip(), null, null, null, order++, true, null));
        }
        for (int i = 0; i < spans.size(); i++) {
            int bodyStart = spans.get(i)[1];
            int bodyEnd = i + 1 < spans.size() ? spans.get(i + 1)[0] : text.length();
            String body = unwrap(text.substring(bodyStart, bodyEnd).strip());
            String[] head = heads.get(i);
            String name = head[0].isEmpty() ? "Script " + (i + 1) : head[0];
            String hooks = head[1].isEmpty() ? null : head[1];
            parts.add(new Part(truncate(name, 255), body, truncate(hooks, 500), null, null, order++, true,
                    Integer.valueOf(head[2])));
        }
        return parts;
    }

    /** Gỡ lớp {@code (function () { … })();} do bước ghép thêm vào; không có lớp bọc thì giữ nguyên. */
    static String unwrap(String body) {
        Matcher open = WRAP_OPEN.matcher(body);
        Matcher close = WRAP_CLOSE.matcher(body);
        if (!open.find() || !close.find() || close.start() < open.end()) {
            return body;
        }
        return body.substring(open.end(), close.start()).strip();
    }

    private static List<Part> splitJsonArray(String text) {
        String trimmed = text.strip();
        if (!trimmed.startsWith("[")) {
            return null;
        }
        JsonNode parsed;
        try {
            parsed = JSON.readTree(trimmed);
        } catch (RuntimeException notJson) {
            return null;
        }
        if (parsed == null || !parsed.isArray()) {
            return null;
        }
        List<Part> parts = new ArrayList<>();
        for (int i = 0; i < parsed.size(); i++) {
            JsonNode entry = parsed.get(i);
            if (entry == null || !entry.isObject() || !entry.path("code").isString()) {
                continue;
            }
            String name = textOrNull(entry, "name");
            parts.add(new Part(
                    truncate(name == null ? "Script " + (i + 1) : name, 255),
                    entry.path("code").asString(),
                    truncate(textOrNull(entry, "declaredHooks"), 500),
                    truncate(textOrNull(entry, "sheetCode"), 32),
                    truncate(textOrNull(entry, "description"), 500),
                    entry.path("displayOrder").isNumber() ? entry.path("displayOrder").asInt() : i,
                    !(entry.path("enabled").isBoolean() && !entry.path("enabled").asBoolean()),
                    null));
        }
        return parts;
    }

    private static String textOrNull(JsonNode entry, String field) {
        JsonNode node = entry.path(field);
        if (!node.isString()) {
            return null;
        }
        String value = node.asString().strip();
        return value.isEmpty() ? null : value;
    }

    /** Có dòng nào không phải chú thích / dòng trống không. */
    private static boolean hasCode(String text) {
        String withoutBlocks = text.replaceAll("(?s)/\\*.*?\\*/", "");
        for (String line : withoutBlocks.split("\\R")) {
            String trimmed = line.strip();
            if (!trimmed.isEmpty() && !trimmed.startsWith("//")) {
                return true;
            }
        }
        return false;
    }

    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max);
    }
}
