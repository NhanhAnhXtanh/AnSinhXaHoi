package com.dth.frw.module.asxh.script;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Máy chạy script phía máy chủ: đọc đúng số liệu theo hợp đồng script của bản Jmix, và hộp cát
 * thật sự đóng (không lớp Java, không IO, không ngôn ngữ khác, có giới hạn thời gian).
 *
 * <p>Không cần Spring hay CSDL — dựng {@link ServerScriptRunner} trực tiếp.
 */
public class ServerScriptRunnerTest {

    /** Workbook SpreadJS tối thiểu: sheet "Biểu 1a", hàng 2–3 có mã, tên, số đối tượng, kinh phí. */
    public static final String WORKBOOK = """
            {"version":"16.0","sheets":{"Biểu 1a":{"name":"Biểu 1a","index":0,"data":{"dataTable":{
              "0":{"0":{"value":"BIỂU 1A"}},
              "2":{"0":{"value":"I.1"},"1":{"value":"Trợ cấp xã hội hằng tháng"},"2":{"value":10},"3":{"value":1500000.5}},
              "3":{"0":{"value":"I.2"},"1":{"value":"Hỗ trợ mai táng"},"2":{"value":3},"3":{"value":4500000,"formula":"C4*1500000"}},
              "4":{"0":{"value":"I.3"},"1":{"value":"Dòng trống"}}
            }}}}}
            """;

    /** Script cùng khuôn script bản Jmix: kết thúc bằng return defineScript({...}). */
    static final String SCRIPT = """
            const SHEET = 'Biểu 1a';
            return defineScript({
              getInputData(ctx) {
                const rows = [];
                for (let r = 2; r <= 4; r++) {
                  const code = ctx.cell.get(SHEET, r, 0);
                  if (code == null) continue;
                  rows.push({
                    indicatorCode: code,
                    indicatorName: ctx.cell.get(SHEET, r, 1),
                    quantity: ctx.cell.get(SHEET, r, 2),
                    amount: ctx.cell.get(SHEET, r, 3),
                    orderNo: r,
                  });
                }
                return rows;
              },
              validate(ctx, rows) {
                if (ctx.cell.get(SHEET, 2, 2) > 5) {
                  ctx.issues.add({ severity: 'ERROR', code: 'TOO_MANY', message: 'Dòng I.1 quá 5 người' });
                }
                ctx.issues.add({ severity: 'WARNING', code: 'W', message: 'chỉ là cảnh báo' });
                return [{ severity: 'ERROR', message: 'Lỗi trả về từ mảng' }];
              },
            });
            """;

    public static final ServerScriptRunner.ReportInfo REPORT = new ServerScriptRunner.ReportInfo(
            "1", "BM-000001", "APPROVED", "1051103", "UBND xã A", "1a", "Quý I/2026", 2026);

    static ServerScriptRunner runner;

    @BeforeAll
    static void setUp() {
        runner = new ServerScriptRunner(2_000, 200_000);
    }

    @AfterAll
    static void tearDown() {
        runner.shutdown();
    }

    private static List<ServerScriptRunner.ScriptSource> script(String code) {
        return List.of(new ServerScriptRunner.ScriptSource("biểu 1a", code));
    }

    private static String probe(String expression) {
        return """
                return defineScript({
                  getInputData(ctx) {
                    let result;
                    try { %s; result = 'open'; } catch (e) { result = 'blocked'; }
                    return [{ indicatorCode: 'P', indicatorName: result, quantity: 1 }];
                  },
                });
                """.formatted(expression);
    }

    @Test
    @DisplayName("getInputData đọc workbook JSON ra đúng các dòng số liệu")
    void readsRowsFromWorkbook() {
        ServerScriptRunner.GetInputDataResult result = runner.runGetInputData(WORKBOOK, script(SCRIPT), REPORT);

        assertEquals(1, result.executedHookCount());
        assertEquals(3, result.rows().size());

        ScriptRow first = result.rows().get(0);
        assertEquals("I.1", first.indicatorCode());
        assertEquals("Trợ cấp xã hội hằng tháng", first.indicatorName());
        assertEquals(0, new BigDecimal("10").compareTo(first.quantity()));
        assertEquals(0, new BigDecimal("1500000.5").compareTo(first.amount()));
        assertEquals(2, first.orderNo());

        ScriptRow second = result.rows().get(1);
        assertEquals(0, new BigDecimal("4500000").compareTo(second.amount()));

        ScriptRow empty = result.rows().get(2);
        assertNull(empty.quantity(), "ô trống phải là null, không phải 0");
        assertNull(empty.amount());
    }

    @Test
    @DisplayName("ctx.report và ctx.cell.getFormula mang đúng giá trị như phía trình duyệt")
    void exposesReportAndFormula() {
        String code = """
                return defineScript({
                  getInputData(ctx) {
                    return [{ indicatorCode: ctx.report.sheetCode, indicatorName: ctx.report.organizationCode
                      + '|' + ctx.cell.getFormula('Biểu 1a', 3, 3) + '|' + ctx.mode, quantity: ctx.report.year }];
                  },
                });
                """;
        ScriptRow row = runner.runGetInputData(WORKBOOK, script(code), REPORT).rows().getFirst();
        assertEquals("BM-000001", row.indicatorCode());
        assertEquals("1051103|=C4*1500000|input", row.indicatorName());
        assertEquals(0, new BigDecimal("2026").compareTo(row.quantity()));
    }

    @Test
    @DisplayName("Mẫu không khai getInputData: không chạy hook nào (người gọi phải coi là lỗi cấu hình)")
    void noHookIsReportedNotSilentlyEmpty() {
        String code = "return defineScript({ validate(ctx) { return []; } });";
        ServerScriptRunner.GetInputDataResult result = runner.runGetInputData(WORKBOOK, script(code), REPORT);
        assertEquals(0, result.executedHookCount());
        assertTrue(result.rows().isEmpty());
    }

    @Test
    @DisplayName("validate: gom lỗi ERROR từ ctx.issues.add và từ mảng trả về, bỏ qua WARNING")
    void validateCollectsErrors() {
        ServerScriptRunner.ValidateResult result = runner.runValidate(WORKBOOK, script(SCRIPT), REPORT);
        assertEquals(1, result.executedHookCount());
        assertEquals(List.of("Dòng I.1 quá 5 người", "Lỗi trả về từ mảng"), result.errors());
        assertTrue(result.scriptFailures().isEmpty());
    }

    @Test
    @DisplayName("validate: script gọi ctx.api (chỉ có ở trình duyệt) không chặn nộp, chỉ ghi lỗi kỹ thuật")
    void validateApiFailureDoesNotBlock() {
        String code = "return defineScript({ validate(ctx) { ctx.api.get('/rest/qt/x'); return []; } });";
        ServerScriptRunner.ValidateResult result = runner.runValidate(WORKBOOK, script(code), REPORT);
        assertTrue(result.errors().isEmpty());
        assertFalse(result.scriptFailures().isEmpty());
    }

    @Test
    @DisplayName("Script tự báo lỗi ERROR trong getInputData: lỗi số liệu, không phải lỗi kỹ thuật")
    void dataIssueIsDataKind() {
        String code = """
                return defineScript({ getInputData(ctx) {
                  ctx.issues.add({ severity: 'ERROR', message: 'Thiếu số đối tượng' }); return []; } });
                """;
        ServerScriptException e = assertThrows(ServerScriptException.class,
                () -> runner.runGetInputData(WORKBOOK, script(code), REPORT));
        assertEquals(ServerScriptException.Kind.DATA, e.kind());
        assertTrue(e.getMessage().contains("Thiếu số đối tượng"));
    }

    @Test
    @DisplayName("Số NaN / Infinity bị chặn thành lỗi số liệu có tên trường")
    void nanIsRejected() {
        String code = "return defineScript({ getInputData() { return [{ indicatorCode: 'A', indicatorName: 'A', amount: 0/0 }]; } });";
        ServerScriptException e = assertThrows(ServerScriptException.class,
                () -> runner.runGetInputData(WORKBOOK, script(code), REPORT));
        assertEquals(ServerScriptException.Kind.DATA, e.kind());
        assertTrue(e.getMessage().contains("amount"));
    }

    @Test
    @DisplayName("Script sai cú pháp / thiếu defineScript là lỗi mẫu")
    void brokenScriptIsScriptKind() {
        assertEquals(ServerScriptException.Kind.SCRIPT, assertThrows(ServerScriptException.class,
                () -> runner.runGetInputData(WORKBOOK, script("return defineScript({ getInputData( "), REPORT)).kind());
        assertEquals(ServerScriptException.Kind.SCRIPT, assertThrows(ServerScriptException.class,
                () -> runner.runGetInputData(WORKBOOK, script("const x = 1;"), REPORT)).kind());
    }

    @Test
    @DisplayName("Hộp cát: không với tới lớp Java")
    void sandboxBlocksJavaAccess() {
        String name = runner.runGetInputData(WORKBOOK,
                script(probe("Java.type('java.lang.Runtime').getRuntime()")), REPORT).rows().getFirst().indicatorName();
        assertEquals("blocked", name);
    }

    @Test
    @DisplayName("Hộp cát: không đọc file, không gọi ngôn ngữ khác")
    void sandboxBlocksIoAndPolyglot() {
        assertEquals("blocked", runner.runGetInputData(WORKBOOK,
                script(probe("load('build.gradle')")), REPORT).rows().getFirst().indicatorName());
        assertEquals("blocked", runner.runGetInputData(WORKBOOK,
                script(probe("Polyglot.eval('python', '1')")), REPORT).rows().getFirst().indicatorName());
    }

    @Test
    @DisplayName("Hộp cát: không được ghi ô hay thêm dòng khi chạy trên máy chủ")
    void sandboxBlocksWrites() {
        assertEquals("blocked", runner.runGetInputData(WORKBOOK,
                script(probe("ctx.cell.set('Biểu 1a', 0, 0, 'x')")), REPORT).rows().getFirst().indicatorName());
        assertEquals("blocked", runner.runGetInputData(WORKBOOK,
                script(probe("ctx.rows.clone('Biểu 1a', 2, 5)")), REPORT).rows().getFirst().indicatorName());
    }

    @Test
    @DisplayName("Vòng lặp vô hạn bị huỷ (giới hạn câu lệnh / đồng hồ canh) thành lỗi TIMEOUT")
    void infiniteLoopIsCancelled() {
        String withBody = "return defineScript({ getInputData() { let i = 0; for (;;) { i++; } } });";
        ServerScriptException e = assertThrows(ServerScriptException.class,
                () -> runner.runGetInputData(WORKBOOK, script(withBody), REPORT));
        assertEquals(ServerScriptException.Kind.TIMEOUT, e.kind());

        String empty = "return defineScript({ getInputData() { while (true) {} } });";
        ServerScriptException e2 = assertThrows(ServerScriptException.class,
                () -> runner.runGetInputData(WORKBOOK, script(empty), REPORT));
        assertEquals(ServerScriptException.Kind.TIMEOUT, e2.kind());
    }

    @Test
    @DisplayName("Workbook rỗng {\"sheets\":{}} được coi là chưa có số liệu")
    void emptyWorkbookDetection() {
        assertTrue(WorkbookJsonCellReader.isEmptyWorkbook(null));
        assertTrue(WorkbookJsonCellReader.isEmptyWorkbook("{\"version\":\"16.0\",\"sheets\":{}}"));
        assertFalse(WorkbookJsonCellReader.isEmptyWorkbook(WORKBOOK));
    }
}
