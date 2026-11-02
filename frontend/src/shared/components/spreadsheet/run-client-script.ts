import { createScriptContext } from "./script/ctx-factory";
import { ScriptHookEngine } from "./script/hook-engine";
import { parseScriptText } from "./script/compile";
import {
  getScriptSession,
  resolveReport,
  resolveRunMode,
  resolveSheetCode,
  toSharedData,
} from "./script/session";
import {
  SCRIPT_HOOKS,
  type ScriptHookName,
  type TempTableRow,
  type TempTableValidationIssue,
} from "./script/types";
import type { ScriptRunResult, SpreadWorkbookApi } from "./types";

const SYNC_HOOKS: readonly ScriptHookName[] = ["beforeEdit", "beforeCommit", "beforePaste"];

function issueText(issue: TempTableValidationIssue): string {
  return issue.severity === "WARNING" ? `Lưu ý: ${issue.message}` : issue.message;
}

/**
 * Chạy MỘT hook của script phiên bản mẫu trên bảng tính đang mở (phía trình duyệt).
 *
 * - `onLoad`, `afterInject`: chạy lại hook vòng đời.
 * - `validate`: kiểm tra trước khi nộp — `ok=false` khi có lỗi mức ERROR. Truyền
 *   `ctx.rows` (mảng dòng số liệu) nếu script cần; mặc định `[]` như bản Jmix.
 * - `beforeExtract`, `getInputData`, `getSummaryData`: chạy thử (màn thiết kế) —
 *   messages báo số dòng lấy được.
 * - `beforeEdit`/`beforeCommit`/`beforePaste` là hook đồng bộ, `SpreadWorkbook`
 *   tự gắn vào bảng tính khi cho sửa; gọi ở đây trả `ok=false`.
 *
 * `ctx` được trộn vào `ctx.shared` của lần nạp hiện tại (thấy dữ liệu onLoad đã ghi).
 * Khoá `mode`, `sheetCode`, `report` có nghĩa riêng (xem `SpreadWorkbookProps.scriptContext`).
 * Script hỏng không bao giờ ném ra ngoài — lỗi thành một dòng trong `messages`.
 */
export async function runClientScript(
  api: SpreadWorkbookApi,
  scriptText: string,
  hook: string,
  ctx: Record<string, unknown>
): Promise<ScriptRunResult> {
  if (!scriptText || scriptText.trim() === "") return { ok: true, messages: [] };
  if (!(SCRIPT_HOOKS as readonly string[]).includes(hook)) {
    return { ok: false, messages: [`Không có bước kiểm tra "${hook}" trong script của mẫu.`] };
  }
  const hookName = hook as ScriptHookName;
  if (SYNC_HOOKS.includes(hookName)) {
    return {
      ok: false,
      messages: [`Bước "${hook}" chạy tự động khi người dùng sửa ô, không gọi riêng được.`],
    };
  }
  const session = getScriptSession(api);
  if (!session) {
    return { ok: false, messages: ["Bảng tính chưa mở xong, vui lòng thử lại."] };
  }

  Object.assign(session.shared, toSharedData(ctx));
  const messages: string[] = [];
  const handle = createScriptContext({
    adapter: session.adapter,
    mode: resolveRunMode(ctx.mode, session.mode),
    report: resolveReport(ctx.report) ?? session.report,
    shared: session.shared,
    onMessage: (text) => messages.push(text),
  });
  const engine = new ScriptHookEngine(handle);
  engine.load(parseScriptText(scriptText), resolveSheetCode(ctx) ?? session.sheetCode);

  const issues: TempTableValidationIssue[] = [...engine.compileErrorIssues()];
  const rows = Array.isArray(ctx.rows) ? (ctx.rows as TempTableRow[]) : [];
  try {
    switch (hookName) {
      case "onLoad":
      case "afterInject":
        issues.push(...(await engine.runLifecycle(hookName)).issues);
        break;
      case "validate":
        issues.push(...(await engine.runValidate(rows)));
        break;
      case "beforeExtract": {
        const result = await engine.runBeforeExtract(rows);
        issues.push(...result.issues);
        messages.push(`Còn ${result.rows.length} dòng số liệu sau bước xử lý.`);
        break;
      }
      case "getInputData": {
        const result = await engine.runGetInputData();
        issues.push(...result.issues);
        messages.push(`Lấy được ${result.rows.length} dòng số liệu.`);
        break;
      }
      case "getSummaryData": {
        const result = await engine.runGetSummaryData();
        issues.push(...result.issues);
        messages.push(`Lấy được ${result.rows.length} dòng số liệu tổng hợp.`);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    // Engine đã tự cô lập lỗi từng script; tới đây là lỗi ngoài dự kiến.
    issues.push({
      severity: "ERROR",
      code: "SCRIPT_ERROR",
      message: `Script của mẫu gặp lỗi: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const cells = issues.flatMap((issue) =>
    issue.severity === "ERROR" && issue.source ? [issue.source] : []
  );
  return {
    ok: !issues.some((issue) => issue.severity === "ERROR"),
    messages: [...issues.map(issueText), ...messages],
    cells,
  };
}
