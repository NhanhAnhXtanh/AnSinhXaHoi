package com.dth.frw.module.asxh.script;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.module.asxh.summary.service.ScriptHooks;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@code scriptText} ghép từ nhiều bản ghi {@code qt_template_script} của bản Jmix (dữ liệu đã chuyển
 * sang một lần ngày 17/10/2026) phải chạy được ở máy chủ y như frontend
 * ({@code compile.ts → parseScriptText / compileRecord}): dạng nhiều lần gọi {@code defineScript}
 * (mỗi bản ghi bọc trong một hàm) và dạng mảng JSON các bản ghi.
 */
class ServerScriptRunnerMultiBlockTest {

    static ServerScriptRunner runner;

    @BeforeAll
    static void setUp() {
        runner = new ServerScriptRunner(2_000, 200_000);
    }

    @AfterAll
    static void tearDown() {
        runner.shutdown();
    }

    /** Đúng khuôn script chuyển từ Jmix: mỗi bản ghi một khối "(function () { ... })();". */
    static final String MIGRATED = """
            // Script chuyển từ bản Jmix: 3 bản ghi qt_template_script, mỗi khối dưới đây là một bản ghi,
            // chạy theo thứ tự (displayOrder). Mỗi khối gọi defineScript({...}) đúng một lần.

            // ===== [Khối Jmix 1/3] Lock cell — hook: onLoad =====
            (function () {
            const SHEET = 'Biểu 1a';
            return defineScript({
              onLoad(ctx) { ctx.cell.lockAll(SHEET); },
            });
            })();

            // ===== [Khối Jmix 2/3] Ledger — hook: getInputData =====
            (function () {
            const SHEET = 'Biểu 1a';
            function num(v) { return typeof v === 'number' ? v : null; }
            return defineScript({
              getInputData(ctx) {
                const rows = [];
                for (let r = 2; r <= 3; r++) {
                  rows.push({ indicatorCode: ctx.cell.get(SHEET, r, 0), indicatorName: ctx.cell.get(SHEET, r, 1),
                              quantity: num(ctx.cell.get(SHEET, r, 2)), amount: num(ctx.cell.get(SHEET, r, 3)) });
                }
                return rows;
              },
            });
            })();

            // ===== [Khối Jmix 3/3] Validate — hook: validate,getSummaryData =====
            (function () {
            const SHEET = 'Biểu 1a';
            return defineScript({
              validate(ctx) {
                if (ctx.cell.get(SHEET, 2, 2) > 5) {
                  ctx.issues.add({ severity: 'ERROR', message: 'Khối 3: dòng I.1 quá 5 người' });
                }
              },
              getSummaryData(ctx) {
                return [{ organizationCode: '', indicatorCode: 'S', indicatorName: 'Tổng', quantity: 1 }];
              },
            });
            })();
            """;

    private static List<ServerScriptRunner.ScriptSource> script(String code) {
        return List.of(new ServerScriptRunner.ScriptSource("biểu 1a", code));
    }

    @Test
    @DisplayName("Nhiều lần gọi defineScript: mọi khối đều được gom, hằng cấp cao của từng khối không đụng nhau")
    void runsEveryDefineScriptBlock() {
        ServerScriptRunner.GetInputDataResult rows =
                runner.runGetInputData(ServerScriptRunnerTest.WORKBOOK, script(MIGRATED), ServerScriptRunnerTest.REPORT);
        assertEquals(1, rows.executedHookCount());
        assertEquals(2, rows.rows().size());
        assertEquals("I.1", rows.rows().get(0).indicatorCode());

        ServerScriptRunner.ValidateResult validate =
                runner.runValidate(ServerScriptRunnerTest.WORKBOOK, script(MIGRATED), ServerScriptRunnerTest.REPORT);
        assertEquals(1, validate.executedHookCount());
        assertEquals(List.of("Khối 3: dòng I.1 quá 5 người"), validate.errors());
        assertTrue(validate.scriptFailures().isEmpty(), validate.scriptFailures().toString());

        ServerScriptRunner.GetSummaryDataResult summary = runner.runGetSummaryData(
                ServerScriptRunnerTest.WORKBOOK, script(MIGRATED), ServerScriptRunnerTest.REPORT, null);
        assertEquals(1, summary.executedHookCount());
        assertEquals("S", summary.rows().getFirst().indicatorCode());
    }

    @Test
    @DisplayName("Dạng một khối 'return defineScript' vẫn chạy như cũ; gọi defineScript rồi return chính nó không bị đếm hai lần")
    void singleBlockStillWorks() {
        String code = "const h = defineScript({ getInputData() { return [{ indicatorCode: 'A', indicatorName: 'A' }]; } });\n"
                + "return h;";
        ServerScriptRunner.GetInputDataResult result =
                runner.runGetInputData(ServerScriptRunnerTest.WORKBOOK, script(code), ServerScriptRunnerTest.REPORT);
        assertEquals(1, result.executedHookCount());
        assertEquals(1, result.rows().size());
    }

    @Test
    @DisplayName("Mảng JSON bản ghi: bỏ bản ghi tắt, xếp theo displayOrder, lọc theo sheetCode của biểu đang chạy")
    void jsonArrayOfRecords() {
        String json = """
                [
                  {"name": "Sau", "displayOrder": 2, "code": "return defineScript({ getInputData() { return [{ indicatorCode: 'B', indicatorName: 'b' }]; } });"},
                  {"name": "Tắt", "displayOrder": 0, "enabled": false, "code": "return defineScript({ getInputData() { return [{ indicatorCode: 'X', indicatorName: 'x' }]; } });"},
                  {"name": "Biểu khác", "displayOrder": 0, "sheetCode": "BM-999999", "code": "return defineScript({ getInputData() { return [{ indicatorCode: 'Y', indicatorName: 'y' }]; } });"},
                  {"name": "Trước", "displayOrder": 1, "sheetCode": "BM-000001", "code": "// chú thích có // trong mã\\nreturn defineScript({ getInputData() { return [{ indicatorCode: 'A', indicatorName: 'a' }]; }, getSummaryData() { return []; } });"}
                ]
                """;
        ServerScriptRunner.GetInputDataResult result =
                runner.runGetInputData(ServerScriptRunnerTest.WORKBOOK, script(json), ServerScriptRunnerTest.REPORT);
        assertEquals(2, result.executedHookCount());
        assertEquals(List.of("A", "B"), result.rows().stream().map(ScriptRow::indicatorCode).toList());

        assertTrue(ScriptHooks.hasSummaryHook(json), "nhận ra getSummaryData trong mã của bản ghi JSON");
    }

    @Test
    @DisplayName("parseScriptText giống frontend: rỗng → không bản ghi, JS → một bản ghi, JSON hỏng → coi là JS")
    void parseScriptTextMatchesFrontend() {
        assertTrue(ServerScriptRunner.parseScriptText("  ").isEmpty());
        assertEquals(1, ServerScriptRunner.parseScriptText(MIGRATED).size());
        assertEquals(1, ServerScriptRunner.parseScriptText("[1, 2").size());
        assertEquals(List.of("Script 1"), ServerScriptRunner.parseScriptText("[{\"code\": \"x\"}]").stream()
                .map(ServerScriptRunner.ScriptRecord::name).toList());
        assertTrue(ScriptHooks.hasSummaryHook(MIGRATED));
        assertFalse(ScriptHooks.hasSummaryHook("// getSummaryData(ctx) chỉ là chú thích\nreturn defineScript({ validate() {} });"));
    }

    @Test
    @DisplayName("Một khối không gọi defineScript: báo lỗi rõ ràng, không lặng lẽ bỏ qua")
    void scriptWithoutDefineScriptFails() {
        ServerScriptException e = assertThrows(ServerScriptException.class,
                () -> runner.runGetInputData(ServerScriptRunnerTest.WORKBOOK, script("const a = 1;"), ServerScriptRunnerTest.REPORT));
        assertEquals(ServerScriptException.Kind.SCRIPT, e.kind());
        assertTrue(e.getMessage().contains("defineScript"), e.getMessage());
    }
}
