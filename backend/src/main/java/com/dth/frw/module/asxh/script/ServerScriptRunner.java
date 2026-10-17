package com.dth.frw.module.asxh.script;

import jakarta.annotation.PreDestroy;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Engine;
import org.graalvm.polyglot.EnvironmentAccess;
import org.graalvm.polyglot.HostAccess;
import org.graalvm.polyglot.PolyglotAccess;
import org.graalvm.polyglot.PolyglotException;
import org.graalvm.polyglot.ResourceLimits;
import org.graalvm.polyglot.Source;
import org.graalvm.polyglot.Value;
import org.graalvm.polyglot.io.IOAccess;
import org.graalvm.polyglot.proxy.ProxyExecutable;
import org.graalvm.polyglot.proxy.ProxyObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Chạy script của phiên bản mẫu ({@code TemplateVersion.scriptText}) bằng GraalJS ở phía máy
 * chủ — port {@code ServerScriptRunner} của bản Jmix, giữ NGUYÊN mô hình biên dịch và facade
 * {@code ctx} để script bê từ bản Jmix chạy được không sửa.
 *
 * <p><b>Mô hình biên dịch</b> (giống {@code shared/components/spreadsheet/script/compile.ts} phía
 * trình duyệt): mã script được bọc trong {@code (function (defineScript) { 'use strict'; ... })}.
 * {@code scriptText} của phiên bản mẫu nhận đủ ba dạng như {@code parseScriptText} của frontend
 * (xem {@link #parseScriptText}):
 * <ol>
 *   <li>mã JS kết thúc bằng {@code return defineScript({ getInputData(ctx) {...}, ... })};</li>
 *   <li>mã JS gọi {@code defineScript({...})} NHIỀU lần — mỗi lần là một khối hook, chạy theo thứ
 *       tự gọi (dạng script chuyển từ nhiều bản ghi {@code qt_template_script} của bản Jmix);</li>
 *   <li>mảng JSON {@code [{ name, code, sheetCode?, displayOrder?, enabled? }]}.</li>
 * </ol>
 *
 * <p><b>Facade {@code ctx} trên máy chủ</b> chỉ mở phần đọc:
 * <ul>
 *   <li>{@code ctx.cell.get / getFormula} — đọc ô từ workbook JSON đã lưu;
 *       {@code ctx.cell.set} ném lỗi; {@code lock / lockAll} không làm gì.</li>
 *   <li>{@code ctx.rows.*} — các thao tác dựng giao diện (dropdown, nút) không làm gì; thêm /
 *       xoá dòng ném lỗi (hook đọc số liệu không được sửa biểu).</li>
 *   <li>{@code ctx.issues.add}, {@code ctx.ui.message} (bỏ qua), {@code ctx.export.download}
 *       (bỏ qua), {@code ctx.report}, {@code ctx.shared}, {@code ctx.mode}.</li>
 *   <li>{@code ctx.api.*} ném lỗi — máy chủ không có phiên trình duyệt.</li>
 * </ul>
 *
 * <p><b>Hộp cát:</b> mỗi lần chạy dựng một {@link Context} riêng (dùng chung {@link Engine}),
 * KHÔNG cấp truy cập lớp Java ({@link HostAccess#NONE}, không tra cứu lớp), không IO, không
 * biến môi trường, không tạo luồng / tiến trình, không mã native, không gọi ngôn ngữ khác. Script
 * chỉ thấy các proxy do máy chủ dựng. Giới hạn số câu lệnh chặn vòng lặp có thân; đồng hồ canh
 * (watchdog) huỷ cả vòng lặp rỗng khi quá thời gian.
 */
@Service
public class ServerScriptRunner {

    private static final long DEFAULT_TIMEOUT_MS = 5_000L;
    private static final long DEFAULT_STATEMENT_LIMIT = 1_000_000L;

    /** Tối đa số lỗi gom trong một lần chạy — người dùng sửa vài dòng đầu rồi chạy lại. */
    private static final int MAX_ISSUES = 50;

    /** Chế độ chạy đặt vào {@code ctx.mode}: giống trình duyệt ở màn nhập liệu. */
    public static final String MODE_INPUT = "input";

    /**
     * Engine dùng CHUNG cho mọi lần chạy (đỡ dựng lại bộ máy JS mỗi lần duyệt), nhưng Context
     * thì mỗi lần một cái — không bao giờ chia Context giữa các luồng.
     */
    private final Engine engine = Engine.newBuilder("js")
            // Trên JDK thường (không có trình biên dịch Graal) chạy chế độ thông dịch: tắt cảnh báo
            // để nhật ký máy chủ không bị nhiễu mỗi lần duyệt.
            .option("engine.WarnInterpreterOnly", "false")
            .build();

    private final ScheduledExecutorService watchdog = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "asxh-script-watchdog");
        thread.setDaemon(true);
        return thread;
    });

    private final long timeoutMs;
    private final long statementLimit;

    /** Cho test / gọi trực tiếp: 5 giây, 1 triệu câu lệnh. */
    public ServerScriptRunner() {
        this(DEFAULT_TIMEOUT_MS, DEFAULT_STATEMENT_LIMIT);
    }

    @Autowired
    public ServerScriptRunner(
            @org.springframework.beans.factory.annotation.Value("${asxh.script.timeout-ms:5000}") long timeoutMs,
            @org.springframework.beans.factory.annotation.Value("${asxh.script.statement-limit:1000000}") long statementLimit) {
        this.timeoutMs = timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
        this.statementLimit = statementLimit > 0 ? statementLimit : DEFAULT_STATEMENT_LIMIT;
        // Trả trước chi phí khởi động GraalJS để lần DUYỆT đầu tiên sau khi bật máy chủ không bị
        // đồng hồ canh huỷ nhầm vì khởi động lạnh lâu hơn thời hạn.
        warmUp();
    }

    @PreDestroy
    void shutdown() {
        watchdog.shutdownNow();
        try {
            engine.close();
        } catch (RuntimeException ignore) {
            // Đang tắt máy chủ — không còn gì để làm.
        }
    }

    // ------------------------------------------------------------ kiểu dữ liệu

    /** Một script cần chạy: tên hiển thị (vào nhật ký) + mã nguồn. */
    public record ScriptSource(String name, String code) {
    }

    /** Một bản ghi script đọc từ {@code scriptText} (dạng 3 mới có {@code sheetCode}). */
    public record ScriptRecord(String name, String code, String sheetCode) {
    }

    /** Một khối hook đã biên dịch (một lần gọi {@code defineScript}). */
    private record CompiledBlock(String name, Value hooks) {
    }

    private static final JsonMapper JSON = JsonMapper.builder().build();

    /**
     * Gom MỌI lần gọi {@code defineScript} của một script, cộng giá trị script trả về (nếu chưa
     * nằm trong số đã gom) — y như {@code compileRecord} của frontend.
     */
    private static final String COLLECTOR_JS = """
            (function (factory) {
              var registered = [];
              var define = function (hooks) {
                if (hooks == null || typeof hooks !== 'object') {
                  throw new TypeError('defineScript(...) cần một object các hook.');
                }
                registered.push(hooks);
                return hooks;
              };
              var returned = factory(define);
              if (returned != null && registered.indexOf(returned) < 0) {
                registered.push(returned);
              }
              return registered;
            })""";

    /**
     * Đọc {@code scriptText} của phiên bản mẫu thành danh sách bản ghi — cùng luật với
     * {@code parseScriptText} của frontend: chuỗi rỗng ⇒ không bản ghi; mảng JSON các object có
     * {@code code} (dạng 3) ⇒ mỗi phần tử một bản ghi, bỏ phần tử {@code enabled: false}, xếp theo
     * {@code displayOrder} (thiếu thì theo vị trí); còn lại ⇒ một bản ghi là chính đoạn mã (dạng
     * 1 / 2 — nhiều lần gọi {@code defineScript} được tách lúc biên dịch).
     */
    public static List<ScriptRecord> parseScriptText(String scriptText) {
        String text = scriptText == null ? "" : scriptText.trim();
        if (text.isEmpty()) {
            return List.of();
        }
        if (text.startsWith("[")) {
            JsonNode parsed = null;
            try {
                parsed = JSON.readTree(text);
            } catch (RuntimeException notJson) {
                // Không phải JSON → coi như mã JS.
            }
            if (parsed != null && parsed.isArray()) {
                record Ordered(int order, int index, ScriptRecord record) {
                }
                List<Ordered> records = new ArrayList<>();
                for (int i = 0; i < parsed.size(); i++) {
                    JsonNode entry = parsed.get(i);
                    if (entry == null || !entry.isObject() || !entry.path("code").isString()) {
                        continue;
                    }
                    if (entry.path("enabled").isBoolean() && !entry.path("enabled").asBoolean()) {
                        continue;
                    }
                    String name = entry.path("name").isString() && !entry.path("name").asString().isBlank()
                            ? entry.path("name").asString() : "Script " + (i + 1);
                    String sheetCode = entry.path("sheetCode").isString() && !entry.path("sheetCode").asString().isEmpty()
                            ? entry.path("sheetCode").asString() : null;
                    int order = entry.path("displayOrder").isNumber() ? entry.path("displayOrder").asInt() : i;
                    records.add(new Ordered(order, i, new ScriptRecord(name, entry.path("code").asString(), sheetCode)));
                }
                records.sort(java.util.Comparator.comparingInt(Ordered::order).thenComparingInt(Ordered::index));
                return records.stream().map(Ordered::record).toList();
            }
        }
        return List.of(new ScriptRecord("Script của mẫu", scriptText, null));
    }

    /**
     * Tách từng {@link ScriptSource} theo {@link #parseScriptText}; bản ghi dạng 3 có
     * {@code sheetCode} khác biểu đang chạy thì bỏ (như frontend lọc theo biểu).
     */
    private static List<ScriptSource> expand(List<ScriptSource> scripts, ReportInfo report) {
        String sheetCode = report == null ? null : report.sheetCode();
        List<ScriptSource> expanded = new ArrayList<>();
        for (ScriptSource script : scripts) {
            List<ScriptRecord> records = parseScriptText(script.code());
            if (records.size() == 1 && records.get(0).sheetCode() == null) {
                expanded.add(script);
                continue;
            }
            for (ScriptRecord record : records) {
                if (record.sheetCode() != null && sheetCode != null && !sheetCode.isEmpty()
                        && !record.sheetCode().equals(sheetCode)) {
                    continue;
                }
                expanded.add(new ScriptSource(script.name() + " / " + record.name(), record.code()));
            }
        }
        return expanded;
    }

    /**
     * Ngữ cảnh phiếu chỉ-đọc đặt vào {@code ctx.report}. Bốn trường đầu giữ tên của bản Jmix
     * ({@code reportId, sheetCode, status, organizationCode}); các trường sau là phần thêm.
     */
    public record ReportInfo(
            String reportId,
            String sheetCode,
            String status,
            String organizationCode,
            String organizationName,
            String templateShortName,
            String periodName,
            Integer year) {
    }

    /**
     * Kết quả {@code getInputData}.
     *
     * @param executedHookCount số script THỰC SỰ có hook {@code getInputData} và đã chạy. {@code 0}
     *                          nghĩa là mẫu không có hook đọc số liệu — người gọi phải coi là lỗi
     *                          cấu hình, KHÔNG được ghi số liệu rỗng.
     */
    public record GetInputDataResult(List<ScriptRow> rows, int executedHookCount) {
    }

    /**
     * Kết quả {@code validate}.
     *
     * @param errors            thông điệp các lỗi mức ERROR do script báo — không rỗng là CHẶN
     * @param executedHookCount số hook validate đã chạy
     * @param scriptFailures    script lỗi KỸ THUẬT (vd gọi {@code ctx.api} chỉ có ở trình duyệt) —
     *                          KHÔNG chặn, chỉ ghi nhật ký (xem {@link #runValidate})
     */
    public record ValidateResult(List<String> errors, int executedHookCount, List<String> scriptFailures) {
    }

    // ------------------------------------------------------------ getInputData

    /**
     * Chạy tuần tự hook {@code getInputData} của các script, gom các dòng. Script không khai hook
     * thì bỏ qua.
     *
     * @throws ServerScriptException biên dịch / chạy lỗi, quá giờ, hoặc script tự báo lỗi ERROR
     */
    public GetInputDataResult runGetInputData(String workbookJson, List<ScriptSource> scripts, ReportInfo report) {
        WorkbookJsonCellReader reader = WorkbookJsonCellReader.parse(workbookJson);
        List<ScriptRow> rows = new ArrayList<>();
        List<String> errorIssues = new ArrayList<>();
        int executed = 0;

        try (Context context = newSandboxedContext()) {
            ScheduledFuture<?> killer = scheduleKill(context);
            try {
                Value collector = context.eval("js", COLLECTOR_JS);
                Value ctx = buildContext(context, reader, report, errorIssues, MODE_INPUT, Map.of());
                for (CompiledBlock block : compileAll(context, expand(scripts, report), collector)) {
                    Value hooks = block.hooks();
                    Value hook = hooks.hasMember("getInputData") ? hooks.getMember("getInputData") : null;
                    if (hook == null || !hook.canExecute()) {
                        continue;
                    }
                    Value result;
                    try {
                        result = hook.execute(ctx);
                    } catch (PolyglotException e) {
                        throw translate("Script \"" + block.name() + "\" lỗi khi chạy getInputData", e);
                    }
                    executed++;
                    collectRows(block.name(), result, rows);
                }
            } finally {
                killer.cancel(false);
            }
        } catch (PolyglotException e) {
            throw translate("Lỗi chạy script mẫu trên máy chủ", e);
        } catch (IllegalStateException e) {
            // Context đã bị đồng hồ canh đóng giữa chừng.
            throw new ServerScriptException(ServerScriptException.Kind.TIMEOUT,
                    "Script bị huỷ do vượt thời gian cho phép.", e);
        }

        if (!errorIssues.isEmpty()) {
            throw new ServerScriptException(ServerScriptException.Kind.DATA, String.join("; ", errorIssues));
        }
        return new GetInputDataResult(List.copyOf(rows), executed);
    }

    // ------------------------------------------------------------ getSummaryData

    /** Chế độ đặt vào {@code ctx.mode} khi Sở trích số đã sửa trên bảng tổng hợp. */
    public static final String MODE_SUMMARY_EDIT = "summary-edit";

    /**
     * Một dòng hook {@code getSummaryData} trả về — số Sở chốt trên bảng tổng hợp (port
     * {@code SummaryDataRowDto}). {@code organizationCode} rỗng = dòng gộp các đơn vị; {@code slot}
     * rỗng = cả kỳ. {@code allocatedAmount} = "Kinh phí đã bố trí trong dự toán NSĐP".
     */
    public record SummaryDataRow(
            String organizationCode,
            String indicatorCode,
            String indicatorName,
            String slot,
            BigDecimal quantity,
            BigDecimal amount,
            BigDecimal allocatedAmount,
            String note,
            Integer orderNo) {
    }

    /**
     * @param executedHookCount {@code 0} = mẫu không có hook {@code getSummaryData} — người gọi coi là lỗi
     *                          cấu hình, KHÔNG được ghi số liệu Sở rỗng
     */
    public record GetSummaryDataResult(List<SummaryDataRow> rows, int executedHookCount) {
    }

    /**
     * Chạy hook {@code getSummaryData} trên bảng Sở vừa sửa ({@code ctx.mode = 'summary-edit'}) — port
     * {@code runGetSummaryData} của bản Jmix. Thêm cho phần số liệu Sở (UC-55).
     *
     * @param orgCodeByName tên đơn vị → mã, đặt ở {@code ctx.shared.orgCodeByName}: biểu mỗi đơn vị một
     *                      dòng chỉ ghi TÊN đơn vị, script dịch ngược ra mã không cần gọi API
     * @throws ServerScriptException biên dịch / chạy lỗi, quá giờ, hoặc script tự báo lỗi ERROR
     */
    public GetSummaryDataResult runGetSummaryData(String workbookJson, List<ScriptSource> scripts, ReportInfo report,
                                                  Map<String, String> orgCodeByName) {
        WorkbookJsonCellReader reader = WorkbookJsonCellReader.parse(workbookJson);
        List<SummaryDataRow> rows = new ArrayList<>();
        List<String> errorIssues = new ArrayList<>();
        int executed = 0;
        Map<String, Object> shared = new HashMap<>();
        shared.put("orgCodeByName", ProxyObject.fromMap(new HashMap<>(orgCodeByName == null ? Map.of() : orgCodeByName)));

        try (Context context = newSandboxedContext()) {
            ScheduledFuture<?> killer = scheduleKill(context);
            try {
                Value collector = context.eval("js", COLLECTOR_JS);
                Value ctx = buildContext(context, reader, report, errorIssues, MODE_SUMMARY_EDIT, shared);
                for (CompiledBlock block : compileAll(context, expand(scripts, report), collector)) {
                    Value hooks = block.hooks();
                    Value hook = hooks.hasMember("getSummaryData") ? hooks.getMember("getSummaryData") : null;
                    if (hook == null || !hook.canExecute()) {
                        continue;
                    }
                    Value result;
                    try {
                        result = hook.execute(ctx);
                    } catch (PolyglotException e) {
                        throw translate("Script \"" + block.name() + "\" lỗi khi chạy getSummaryData", e);
                    }
                    executed++;
                    if (result == null || result.isNull()) {
                        continue;
                    }
                    if (!result.hasArrayElements()) {
                        throw new ServerScriptException(ServerScriptException.Kind.SCRIPT,
                                "Script \"" + block.name() + "\": getSummaryData phải trả về một mảng dòng"
                                        + " (trên máy chủ không dùng hàm async).");
                    }
                    for (long i = 0; i < result.getArraySize(); i++) {
                        Value row = result.getArrayElement(i);
                        if (row == null || row.isNull() || !row.hasMembers()) {
                            continue;
                        }
                        rows.add(new SummaryDataRow(
                                stringMember(row, "organizationCode"),
                                stringMember(row, "indicatorCode"),
                                stringMember(row, "indicatorName"),
                                stringMember(row, "slot"),
                                decimalMember(row, "quantity"),
                                decimalMember(row, "amount"),
                                decimalMember(row, "allocatedAmount"),
                                stringMember(row, "note"),
                                intMember(row, "orderNo")));
                    }
                }
            } finally {
                killer.cancel(false);
            }
        } catch (PolyglotException e) {
            throw translate("Lỗi chạy script mẫu trên máy chủ", e);
        } catch (IllegalStateException e) {
            throw new ServerScriptException(ServerScriptException.Kind.TIMEOUT,
                    "Script bị huỷ do vượt thời gian cho phép.", e);
        }

        if (!errorIssues.isEmpty()) {
            throw new ServerScriptException(ServerScriptException.Kind.DATA, String.join("; ", errorIssues));
        }
        return new GetSummaryDataResult(List.copyOf(rows), executed);
    }

    // ------------------------------------------------------------ validate

    /**
     * Chạy hook {@code validate} trên workbook đã lưu — hàng rào thứ hai khi NỘP phiếu, sau
     * hàng rào trong trình duyệt (gọi thẳng REST hay script không tải được đều không lọt).
     *
     * <p><b>Giới hạn có chủ đích (như bản Jmix):</b> script lỗi KỸ THUẬT khi chạy ở máy chủ (điển
     * hình gọi {@code ctx.api}) được ghi vào {@code scriptFailures} và KHÔNG chặn nộp — nếu chặn,
     * một mẫu dùng {@code ctx.api} trong validate sẽ khiến mọi đơn vị không nộp được phiếu. Chỉ
     * lỗi ERROR do chính script phát ra mới chặn. {@code rows} truyền mảng rỗng như trình duyệt.
     */
    public ValidateResult runValidate(String workbookJson, List<ScriptSource> scripts, ReportInfo report) {
        WorkbookJsonCellReader reader;
        try {
            reader = WorkbookJsonCellReader.parse(workbookJson);
        } catch (ServerScriptException e) {
            return new ValidateResult(List.of(), 0, List.of(e.getMessage()));
        }
        List<String> errorIssues = new ArrayList<>();
        List<String> failures = new ArrayList<>();
        int executed = 0;

        try (Context context = newSandboxedContext()) {
            ScheduledFuture<?> killer = scheduleKill(context);
            try {
                Value collector = context.eval("js", COLLECTOR_JS);
                Value ctx = buildContext(context, reader, report, errorIssues, MODE_INPUT, Map.of());
                Value emptyRows = context.eval("js", "[]");
                for (ScriptSource script : expand(scripts, report)) {
                    List<CompiledBlock> blocks;
                    try {
                        blocks = compile(context, script, collector);
                    } catch (ServerScriptException e) {
                        failures.add(script.name() + ": " + e.getMessage());
                        continue;
                    }
                    for (CompiledBlock block : blocks) {
                        Value hooks = block.hooks();
                        Value validate = hooks.hasMember("validate") ? hooks.getMember("validate") : null;
                        if (validate == null || !validate.canExecute()) {
                            continue;
                        }
                        try {
                            collectIssues(validate.execute(ctx, emptyRows), errorIssues);
                            executed++;
                        } catch (PolyglotException e) {
                            failures.add(block.name() + ": " + e.getMessage());
                        }
                    }
                }
            } finally {
                killer.cancel(false);
            }
        } catch (PolyglotException | IllegalStateException e) {
            failures.add("Lỗi chạy script kiểm tra trên máy chủ: " + e.getMessage());
        }
        return new ValidateResult(List.copyOf(errorIssues), executed, List.copyOf(failures));
    }

    // ------------------------------------------------------------ nội bộ

    /** Context riêng, dùng chung Engine, khoá mọi cửa ra ngoài. */
    private Context newSandboxedContext() {
        return Context.newBuilder("js")
                .engine(engine)
                .allowHostAccess(HostAccess.NONE)
                .allowHostClassLookup(className -> false)
                .allowHostClassLoading(false)
                .allowIO(IOAccess.NONE)
                .allowEnvironmentAccess(EnvironmentAccess.NONE)
                .allowCreateThread(false)
                .allowCreateProcess(false)
                .allowNativeAccess(false)
                .allowPolyglotAccess(PolyglotAccess.NONE)
                .resourceLimits(ResourceLimits.newBuilder()
                        // filter = null ⇒ đếm mọi câu lệnh.
                        .statementLimit(statementLimit, null)
                        .build())
                .build();
    }

    private ScheduledFuture<?> scheduleKill(Context context) {
        return watchdog.schedule(() -> {
            try {
                // cancelIfExecuting = true: huỷ script đang chạy ở luồng gọi.
                context.close(true);
            } catch (RuntimeException ignore) {
                // Context có thể đã đóng bình thường trước khi đồng hồ nổ.
            }
        }, timeoutMs, TimeUnit.MILLISECONDS);
    }

    private void warmUp() {
        try (Context context = newSandboxedContext()) {
            context.eval("js", "(function () { var s = 0; for (var i = 0; i < 10; i++) { s += i; } return s; })()");
        } catch (RuntimeException ignore) {
            // Chỉ để giảm độ trễ lần đầu; lần chạy thật sẽ báo lỗi rõ hơn.
        }
    }

    private List<CompiledBlock> compileAll(Context context, List<ScriptSource> scripts, Value collector) {
        List<CompiledBlock> blocks = new ArrayList<>();
        for (ScriptSource script : scripts) {
            blocks.addAll(compile(context, script, collector));
        }
        return blocks;
    }

    /**
     * Biên dịch một script thành các khối hook: mỗi lần gọi {@code defineScript} là một khối (dạng
     * 2), cộng giá trị {@code return} nếu chưa được gom (dạng 1).
     */
    private List<CompiledBlock> compile(Context context, ScriptSource script, Value collector) {
        String code = script.code() == null ? "" : script.code();
        Value factory;
        try {
            Source source = Source.newBuilder("js",
                    "(function (defineScript) {\n'use strict';\n" + code + "\n})",
                    script.name()).buildLiteral();
            factory = context.eval(source);
        } catch (PolyglotException e) {
            throw translate("Script \"" + script.name() + "\" biên dịch lỗi", e);
        }
        Value registered;
        try {
            registered = collector.execute(factory);
        } catch (PolyglotException e) {
            throw translate("Script \"" + script.name() + "\" lỗi khi khởi tạo", e);
        }
        long count = registered == null || !registered.hasArrayElements() ? 0 : registered.getArraySize();
        if (count == 0) {
            throw new ServerScriptException(ServerScriptException.Kind.SCRIPT,
                    "Script \"" + script.name() + "\" phải kết thúc bằng return defineScript({...}).");
        }
        List<CompiledBlock> blocks = new ArrayList<>();
        for (long i = 0; i < count; i++) {
            Value hooks = registered.getArrayElement(i);
            String name = count > 1 ? script.name() + " (khối " + (i + 1) + ")" : script.name();
            if (hooks == null || hooks.isNull() || !hooks.hasMembers()) {
                throw new ServerScriptException(ServerScriptException.Kind.SCRIPT,
                        "Script \"" + name + "\" phải kết thúc bằng return defineScript({...}).");
            }
            blocks.add(new CompiledBlock(name, hooks));
        }
        return blocks;
    }

    /**
     * {@link PolyglotException} → {@link ServerScriptException}: huỷ vì giới hạn / quá giờ là
     * {@code TIMEOUT}; lỗi do chính máy chủ ném trong proxy (vd {@code ctx.api}) giữ nguyên;
     * còn lại là lỗi script.
     */
    private static ServerScriptException translate(String prefix, PolyglotException e) {
        if (e.isCancelled() || e.isResourceExhausted() || e.isInterrupted()) {
            return new ServerScriptException(ServerScriptException.Kind.TIMEOUT,
                    prefix + ": bị huỷ do vượt thời gian / giới hạn thực thi cho phép.", e);
        }
        if (e.isHostException() && e.asHostException() instanceof ServerScriptException own) {
            return own;
        }
        return new ServerScriptException(ServerScriptException.Kind.SCRIPT, prefix + ": " + e.getMessage(), e);
    }

    private static void collectRows(String scriptName, Value result, List<ScriptRow> rows) {
        if (result == null || result.isNull()) {
            return;
        }
        if (!result.hasArrayElements()) {
            throw new ServerScriptException(ServerScriptException.Kind.SCRIPT,
                    "Script \"" + scriptName + "\": getInputData phải trả về một mảng dòng"
                            + " (trên máy chủ không dùng hàm async).");
        }
        long size = result.getArraySize();
        for (long i = 0; i < size; i++) {
            Value row = result.getArrayElement(i);
            if (row == null || row.isNull() || !row.hasMembers()) {
                continue;
            }
            rows.add(new ScriptRow(
                    stringMember(row, "organizationCode"),
                    stringMember(row, "organizationName"),
                    stringMember(row, "indicatorCode"),
                    stringMember(row, "indicatorName"),
                    decimalMember(row, "quantity"),
                    decimalMember(row, "amount"),
                    stringMember(row, "note"),
                    intMember(row, "orderNo")));
        }
    }

    /** Hook validate có thể TRẢ VỀ mảng lỗi thay vì gọi {@code ctx.issues.add} — gom cả hai lối. */
    private static void collectIssues(Value result, List<String> errorIssues) {
        if (result == null || result.isNull() || !result.hasArrayElements()) {
            return;
        }
        for (long i = 0; i < result.getArraySize(); i++) {
            addIssue(result.getArrayElement(i), errorIssues);
        }
    }

    private static void addIssue(Value issue, List<String> errorIssues) {
        if (issue == null || issue.isNull() || !issue.hasMembers()) {
            return;
        }
        String severity = memberText(issue, "severity");
        if (severity == null || "ERROR".equalsIgnoreCase(severity)) {
            if (errorIssues.size() < MAX_ISSUES) {
                String message = memberText(issue, "message");
                errorIssues.add(message == null || message.isBlank() ? "lỗi không rõ" : message);
            }
        }
    }

    /** Dựng facade {@code ctx} bằng proxy — script chỉ thấy JS thuần, không thấy lớp Java. */
    private static Value buildContext(Context context,
                                      WorkbookJsonCellReader reader,
                                      ReportInfo report,
                                      List<String> errorIssues,
                                      String mode,
                                      Map<String, Object> shared) {
        ProxyExecutable noop = args -> null;
        ProxyExecutable unavailableApi = args -> {
            throw new ServerScriptException(ServerScriptException.Kind.SCRIPT,
                    "ctx.api không khả dụng khi chạy script trên máy chủ.");
        };

        Map<String, Object> cell = new HashMap<>();
        cell.put("get", (ProxyExecutable) args -> {
            requireArgs(args, 3, "ctx.cell.get(sheet, row, col)");
            return reader.get(args[0].asString(), args[1].asInt(), args[2].asInt());
        });
        cell.put("getFormula", (ProxyExecutable) args -> {
            requireArgs(args, 3, "ctx.cell.getFormula(sheet, row, col)");
            return reader.getFormula(args[0].asString(), args[1].asInt(), args[2].asInt());
        });
        cell.put("set", (ProxyExecutable) args -> {
            throw new ServerScriptException(ServerScriptException.Kind.SCRIPT,
                    "ctx.cell.set không được phép khi chạy trên máy chủ.");
        });
        cell.put("lock", noop);
        cell.put("lockAll", noop);

        ProxyExecutable rowsForbidden = args -> {
            throw new ServerScriptException(ServerScriptException.Kind.SCRIPT,
                    "Không được thêm / xoá dòng khi chạy script trên máy chủ.");
        };
        Map<String, Object> rowsApi = new HashMap<>();
        rowsApi.put("clone", rowsForbidden);
        rowsApi.put("deleteRow", rowsForbidden);
        rowsApi.put("setDropdown", noop);
        rowsApi.put("addRowButton", noop);
        rowsApi.put("setRowButtons", noop);

        Map<String, Object> ui = new HashMap<>();
        ui.put("message", noop);

        Map<String, Object> issues = new HashMap<>();
        issues.put("add", (ProxyExecutable) args -> {
            addIssue(args.length > 0 ? args[0] : null, errorIssues);
            return null;
        });

        Map<String, Object> api = new HashMap<>();
        for (String method : List.of("fetch", "get", "post", "push", "put", "patch")) {
            api.put(method, unavailableApi);
        }

        Map<String, Object> export = new HashMap<>();
        export.put("download", noop);

        Map<String, Object> reportMap = new HashMap<>();
        reportMap.put("reportId", nullToEmpty(report == null ? null : report.reportId()));
        reportMap.put("sheetCode", nullToEmpty(report == null ? null : report.sheetCode()));
        reportMap.put("status", nullToEmpty(report == null ? null : report.status()));
        reportMap.put("organizationCode", nullToEmpty(report == null ? null : report.organizationCode()));
        reportMap.put("organizationName", nullToEmpty(report == null ? null : report.organizationName()));
        reportMap.put("templateShortName", nullToEmpty(report == null ? null : report.templateShortName()));
        reportMap.put("periodName", nullToEmpty(report == null ? null : report.periodName()));
        reportMap.put("year", report == null || report.year() == null ? null : report.year());

        Map<String, Object> ctx = new HashMap<>();
        ctx.put("mode", mode);
        ctx.put("report", ProxyObject.fromMap(reportMap));
        // Ghi được: script vẫn gán thêm khoá vào ctx.shared như trên trình duyệt.
        ctx.put("shared", ProxyObject.fromMap(new HashMap<>(shared)));
        ctx.put("cell", ProxyObject.fromMap(cell));
        ctx.put("rows", ProxyObject.fromMap(rowsApi));
        ctx.put("ui", ProxyObject.fromMap(ui));
        ctx.put("issues", ProxyObject.fromMap(issues));
        ctx.put("api", ProxyObject.fromMap(api));
        ctx.put("export", ProxyObject.fromMap(export));
        return context.asValue(ProxyObject.fromMap(ctx));
    }

    private static void requireArgs(Value[] args, int count, String signature) {
        if (args.length < count) {
            throw new ServerScriptException(ServerScriptException.Kind.SCRIPT, "Thiếu tham số: " + signature);
        }
    }

    private static String stringMember(Value obj, String name) {
        Value member = member(obj, name);
        if (member == null) {
            return null;
        }
        return member.isString() ? member.asString() : member.toString();
    }

    private static BigDecimal decimalMember(Value obj, String name) {
        Value member = member(obj, name);
        if (member == null) {
            return null;
        }
        if (member.isNumber()) {
            if (member.fitsInLong()) {
                return BigDecimal.valueOf(member.asLong());
            }
            double number = member.asDouble();
            // NaN / Infinity (chia 0, công thức lỗi) làm BigDecimal.valueOf ném NumberFormatException —
            // bắt ở đây để thành lỗi số liệu có tên trường, không phải lỗi 500.
            if (Double.isNaN(number) || Double.isInfinite(number)) {
                throw new ServerScriptException(ServerScriptException.Kind.DATA,
                        "Trường \"" + name + "\" không phải số hữu hạn — kiểm tra công thức của ô nguồn.");
            }
            return BigDecimal.valueOf(number);
        }
        if (member.isString()) {
            String text = member.asString().trim();
            if (text.isEmpty()) {
                return null;
            }
            try {
                return new BigDecimal(text);
            } catch (NumberFormatException e) {
                throw new ServerScriptException(ServerScriptException.Kind.DATA,
                        "Trường \"" + name + "\" không phải số: " + text);
            }
        }
        throw new ServerScriptException(ServerScriptException.Kind.DATA,
                "Trường \"" + name + "\" có kiểu không hợp lệ.");
    }

    /** {@code orderNo}: thiếu / không phải số ⇒ null (không chặn ghi). */
    private static Integer intMember(Value obj, String name) {
        Value member = member(obj, name);
        if (member == null) {
            return null;
        }
        if (member.isNumber() && member.fitsInInt()) {
            return member.asInt();
        }
        if (member.isNumber() && member.fitsInLong()) {
            return (int) member.asLong();
        }
        if (member.isString()) {
            try {
                return Integer.valueOf(member.asString().trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static String memberText(Value obj, String name) {
        Value member = member(obj, name);
        if (member == null) {
            return null;
        }
        return member.isString() ? member.asString() : member.toString();
    }

    private static Value member(Value obj, String name) {
        if (obj == null || !obj.hasMembers() || !obj.hasMember(name)) {
            return null;
        }
        Value member = obj.getMember(name);
        return member == null || member.isNull() ? null : member;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
