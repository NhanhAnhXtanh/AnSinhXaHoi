package com.dth.frw.module.asxh.script;

import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Đọc giá trị ô từ workbook JSON (định dạng {@code workbook.toJSON()} của SpreadJS) ở phía máy
 * chủ — không cần SpreadJS. Port nguyên văn {@code WorkbookJsonCellReader} của bản Jmix, phản
 * chiếu {@code ctx.cell.get/getFormula} của trình duyệt để hook chạy trên máy chủ ra cùng kết quả.
 *
 * <pre>
 * root.sheets[key] = { name, index, data: { dataTable: { "row": { "col": { value, formula } } } } }
 * </pre>
 * Sheet tìm theo trường {@code name} (rỗng thì theo khoá). {@code dataTable} là bảng thưa: hàng /
 * ô trống bị lược, nên mọi tra cứu thiếu khoá đều trả {@code null}.
 *
 * <p>Giới hạn đã biết (như bản Jmix): ô dùng công thức chia sẻ ({@code {"si": n}}) trả công
 * thức rỗng; giá trị đọc ra là giá trị SpreadJS đã tính và lưu lúc trình duyệt ghi workbook.
 */
public final class WorkbookJsonCellReader {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private final JsonNode sheets;

    private WorkbookJsonCellReader(JsonNode sheets) {
        this.sheets = sheets;
    }

    /** Đọc workbook một lần; dùng lại cho mọi {@code get} của cùng biểu. */
    public static WorkbookJsonCellReader parse(String workbookJson) {
        if (workbookJson == null || workbookJson.isBlank()) {
            throw new ServerScriptException(ServerScriptException.Kind.DATA, "Biểu chưa có số liệu.");
        }
        JsonNode root;
        try {
            root = MAPPER.readTree(workbookJson);
        } catch (RuntimeException e) {
            throw new ServerScriptException(ServerScriptException.Kind.SCRIPT,
                    "Workbook JSON không hợp lệ: " + e.getMessage(), e);
        }
        JsonNode sheets = root == null ? null : root.path("sheets");
        if (sheets == null || !sheets.isObject()) {
            throw new ServerScriptException(ServerScriptException.Kind.SCRIPT, "Workbook thiếu danh sách sheets.");
        }
        return new WorkbookJsonCellReader(sheets);
    }

    /**
     * Workbook "chưa có gì": null, rỗng, không đọc được, hoặc {@code sheets} rỗng (seed và bản lưu
     * khởi tạo ghi {@code {"version":"16.0","sheets":{}}}). Màn nhập coi trường hợp này như chưa
     * nhập và lấy workbook của phiên bản mẫu — máy chủ coi là biểu chưa có số liệu, không chạy script.
     */
    public static boolean isEmptyWorkbook(String workbookJson) {
        if (workbookJson == null || workbookJson.isBlank()) {
            return true;
        }
        try {
            JsonNode sheets = MAPPER.readTree(workbookJson).path("sheets");
            return !sheets.isObject() || sheets.isEmpty();
        } catch (RuntimeException e) {
            return false; // để parse() báo lỗi rõ ràng
        }
    }

    public boolean hasSheet(String sheetName) {
        return findSheet(sheetName) != null;
    }

    /**
     * Giá trị ô (chỉ số từ 0) như {@code ctx.cell.get}: số → {@link Long}/{@link Double} (để
     * {@code typeof === 'number'} trong script), chuỗi → {@link String}, boolean →
     * {@link Boolean}, ô / hàng thiếu → {@code null}.
     */
    public Object get(String sheetName, int row, int col) {
        JsonNode value = cellNode(sheetName, row, col).path("value");
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        if (value.isNumber()) {
            return value.isFloatingPointNumber() ? (Object) value.doubleValue() : (Object) value.longValue();
        }
        if (value.isBoolean()) {
            return value.booleanValue();
        }
        if (value.isString()) {
            return value.asString();
        }
        // Ô kiểu đối tượng (ngày SpreadJS lưu dạng "/OADate(...)/" là chuỗi; đối tượng khác hiếm) —
        // trả dạng chữ để script không vấp proxy lạ.
        return value.toString();
    }

    /** Công thức của ô: chuỗi rỗng nếu không có; luôn có "=" ở đầu như phía trình duyệt. */
    public String getFormula(String sheetName, int row, int col) {
        JsonNode formula = cellNode(sheetName, row, col).path("formula");
        if (formula.isMissingNode() || formula.isNull() || !formula.isString()) {
            return "";
        }
        String text = formula.asString();
        if (text.isEmpty() || text.startsWith("=")) {
            return text;
        }
        return "=" + text;
    }

    private JsonNode cellNode(String sheetName, int row, int col) {
        JsonNode sheet = findSheet(sheetName);
        if (sheet == null) {
            throw new ServerScriptException(ServerScriptException.Kind.SCRIPT,
                    "Sheet không tồn tại trong workbook: " + sheetName);
        }
        return sheet.path("data").path("dataTable")
                .path(Integer.toString(row))
                .path(Integer.toString(col));
    }

    private JsonNode findSheet(String sheetName) {
        if (sheetName == null) {
            return null;
        }
        for (Map.Entry<String, JsonNode> entry : sheets.properties()) {
            JsonNode sheet = entry.getValue();
            String name = sheet.path("name").asString("");
            String resolved = name.isBlank() ? entry.getKey() : name;
            if (resolved.equals(sheetName)) {
                return sheet;
            }
        }
        return null;
    }
}
