package com.dth.frw.module.asxh.script;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.module.asxh.template.migration.ScriptTextSplitter;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Máy chạy phía máy chủ nhận NHIỀU kịch bản (mỗi kịch bản một {@link ServerScriptRunner.ScriptSource},
 * như bản Jmix) và biên dịch từng kịch bản riêng: lỗi của một kịch bản không kéo kịch bản khác.
 */
class ServerScriptRunnerPerScriptTest {

    static ServerScriptRunner runner;

    @BeforeAll
    static void setUp() {
        runner = new ServerScriptRunner(2_000, 200_000);
    }

    @AfterAll
    static void tearDown() {
        runner.shutdown();
    }

    private static final ServerScriptRunner.ScriptSource BROKEN =
            new ServerScriptRunner.ScriptSource("Kịch bản hỏng", "return defineScript({ validate(ctx) { ");

    private static final ServerScriptRunner.ScriptSource THROWS_AT_RUN = new ServerScriptRunner.ScriptSource(
            "Gọi API", "return defineScript({ validate(ctx) { ctx.api.get('/api/x'); } });");

    private static final ServerScriptRunner.ScriptSource CHECKS = new ServerScriptRunner.ScriptSource("Kiểm số", """
            return defineScript({
              validate(ctx) {
                if (ctx.cell.get('Biểu 1a', 2, 2) > 5) {
                  ctx.issues.add({ severity: 'ERROR', message: 'Dòng I.1 quá 5 người' });
                }
              },
            });
            """);

    private static final ServerScriptRunner.ScriptSource LEDGER = new ServerScriptRunner.ScriptSource("Sổ cái", """
            return defineScript({
              getInputData(ctx) { return [{ indicatorCode: 'I.1', indicatorName: 'a', quantity: ctx.cell.get('Biểu 1a', 2, 2) }]; },
            });
            """);

    @Test
    @DisplayName("validate: kịch bản lỗi cú pháp / lỗi khi chạy chỉ thành lỗi kỹ thuật có tên, kịch bản khác vẫn kiểm")
    void validateIsolatesEachScript() {
        ServerScriptRunner.ValidateResult result = runner.runValidate(ServerScriptRunnerTest.WORKBOOK,
                List.of(BROKEN, THROWS_AT_RUN, CHECKS), ServerScriptRunnerTest.REPORT);

        assertEquals(List.of("Dòng I.1 quá 5 người"), result.errors());
        assertEquals(1, result.executedHookCount());
        assertEquals(2, result.scriptFailures().size(), result.scriptFailures().toString());
        assertTrue(result.scriptFailures().get(0).startsWith("Kịch bản hỏng:"), result.scriptFailures().toString());
        assertTrue(result.scriptFailures().get(1).startsWith("Gọi API:"), result.scriptFailures().toString());
    }

    @Test
    @DisplayName("getInputData: kịch bản hỏng làm DỪNG lần ghi sổ (như bản Jmix — không ghi số thiếu) và nêu tên kịch bản")
    void getInputDataFailsLoudlyNamingTheScript() {
        ServerScriptException e = assertThrows(ServerScriptException.class, () -> runner.runGetInputData(
                ServerScriptRunnerTest.WORKBOOK, List.of(LEDGER, BROKEN), ServerScriptRunnerTest.REPORT));
        assertTrue(e.getMessage().contains("Kịch bản hỏng"), e.getMessage());

        ServerScriptRunner.GetInputDataResult ok = runner.runGetInputData(
                ServerScriptRunnerTest.WORKBOOK, List.of(CHECKS, LEDGER), ServerScriptRunnerTest.REPORT);
        assertEquals(1, ok.executedHookCount());
        assertEquals("I.1", ok.rows().getFirst().indicatorCode());
    }

    @Test
    @DisplayName("Mã tách từ chuỗi gộp (changeset 171) chạy riêng từng kịch bản cho cùng kết quả như chuỗi gộp")
    void splitScriptsBehaveLikeCombined() {
        List<ServerScriptRunner.ScriptSource> sources = ScriptTextSplitter.split(ServerScriptRunnerMultiBlockTest.MIGRATED)
                .stream().map(p -> new ServerScriptRunner.ScriptSource(p.name(), p.code())).toList();
        assertEquals(3, sources.size());

        ServerScriptRunner.GetInputDataResult rows =
                runner.runGetInputData(ServerScriptRunnerTest.WORKBOOK, sources, ServerScriptRunnerTest.REPORT);
        assertEquals(1, rows.executedHookCount());
        assertEquals(2, rows.rows().size());

        ServerScriptRunner.ValidateResult validate =
                runner.runValidate(ServerScriptRunnerTest.WORKBOOK, sources, ServerScriptRunnerTest.REPORT);
        assertEquals(List.of("Khối 3: dòng I.1 quá 5 người"), validate.errors());
        assertTrue(validate.scriptFailures().isEmpty(), validate.scriptFailures().toString());

        ServerScriptRunner.GetSummaryDataResult summary = runner.runGetSummaryData(
                ServerScriptRunnerTest.WORKBOOK, sources, ServerScriptRunnerTest.REPORT, null);
        assertEquals(1, summary.executedHookCount());
    }
}
