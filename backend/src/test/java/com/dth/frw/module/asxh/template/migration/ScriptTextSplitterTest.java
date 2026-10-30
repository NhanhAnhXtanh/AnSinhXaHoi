package com.dth.frw.module.asxh.template.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.module.asxh.script.ServerScriptRunnerMultiBlockTest;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Luật tách {@code script_text} gộp thành các kịch bản của changeset 171. */
class ScriptTextSplitterTest {

    @Test
    @DisplayName("Khối Jmix: mỗi dòng đánh dấu một kịch bản, tên + hook lấy từ dòng đánh dấu, gỡ lớp bọc (function(){…})();")
    void splitsJmixBlocks() {
        List<ScriptTextSplitter.Part> parts = ScriptTextSplitter.split(ServerScriptRunnerMultiBlockTest.MIGRATED);

        assertEquals(List.of("Lock cell", "Ledger", "Validate"), parts.stream().map(ScriptTextSplitter.Part::name).toList());
        assertEquals(List.of("onLoad", "getInputData", "validate,getSummaryData"),
                parts.stream().map(ScriptTextSplitter.Part::declaredHooks).toList());
        assertEquals(List.of(0, 1, 2), parts.stream().map(ScriptTextSplitter.Part::displayOrder).toList());
        for (ScriptTextSplitter.Part part : parts) {
            assertTrue(part.code().startsWith("const SHEET = 'Biểu 1a';"), part.code());
            assertTrue(part.code().endsWith("});"), part.code());
            assertFalse(part.code().contains("(function () {"), "đã gỡ lớp bọc");
            assertTrue(part.enabled());
            assertNull(part.sheetCode(), "dòng đánh dấu không mang phạm vi biểu");
            assertEquals(3, part.markerTotal());
        }
        // Chú thích đầu chuỗi (mô tả việc ghép) bị bỏ, không thành kịch bản.
        assertEquals(3, parts.size());
    }

    @Test
    @DisplayName("Không có dòng đánh dấu: cả đoạn là một kịch bản \"Script của mẫu\"; rỗng: không kịch bản nào")
    void wholeTextOrNothing() {
        String code = "return defineScript({ validate(ctx) {} });";
        List<ScriptTextSplitter.Part> parts = ScriptTextSplitter.split(code);
        assertEquals(1, parts.size());
        assertEquals(ScriptTextSplitter.WHOLE_SCRIPT_NAME, parts.getFirst().name());
        assertEquals(code, parts.getFirst().code());
        assertNull(parts.getFirst().markerTotal());

        assertTrue(ScriptTextSplitter.split("").isEmpty());
        assertTrue(ScriptTextSplitter.split("  \n ").isEmpty());
        assertTrue(ScriptTextSplitter.split(null).isEmpty());
    }

    @Test
    @DisplayName("Mảng JSON: mỗi phần tử có code một kịch bản, giữ tên / phạm vi / bật-tắt / thứ tự")
    void jsonArray() {
        String json = """
                [{"name": "A", "code": "return defineScript({ onLoad() {} });", "sheetCode": "BM-000001", "displayOrder": 5},
                 {"code": "return defineScript({ validate() {} });", "enabled": false},
                 {"name": "không có code"}]
                """;
        List<ScriptTextSplitter.Part> parts = ScriptTextSplitter.split(json);
        assertEquals(2, parts.size());
        assertEquals("A", parts.get(0).name());
        assertEquals("BM-000001", parts.get(0).sheetCode());
        assertEquals(5, parts.get(0).displayOrder());
        assertEquals("Script 2", parts.get(1).name());
        assertFalse(parts.get(1).enabled());
    }

    @Test
    @DisplayName("Có MÃ thật trước dòng đánh dấu đầu: giữ thành kịch bản \"Phần đầu script\", không mất")
    void keepsPreambleCode() {
        String text = """
                const SHARED = 1;
                // ===== [Khối Jmix 1/1] Một — hook: onLoad =====
                (function () {
                return defineScript({ onLoad() {} });
                })();
                """;
        List<ScriptTextSplitter.Part> parts = ScriptTextSplitter.split(text);
        assertEquals(List.of(ScriptTextSplitter.PREAMBLE_NAME, "Một"),
                parts.stream().map(ScriptTextSplitter.Part::name).toList());
        assertEquals("const SHARED = 1;", parts.get(0).code());
        assertEquals("return defineScript({ onLoad() {} });", parts.get(1).code());
    }

    @Test
    @DisplayName("Khối không có lớp bọc thì giữ nguyên mã")
    void unwrapOnlyWhenWrapped() {
        assertEquals("return defineScript({});", ScriptTextSplitter.unwrap("return defineScript({});"));
        assertEquals("x();", ScriptTextSplitter.unwrap("(function () {\nx();\n})();"));
    }
}
