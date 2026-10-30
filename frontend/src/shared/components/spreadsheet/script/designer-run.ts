import type { SpreadWorkbookApi } from "../types";
import { createScriptContext } from "./ctx-factory";
import { ScriptHookEngine } from "./hook-engine";
import { getScriptSession } from "./session";
import type { ScriptRecord, ScriptReportInfo } from "./types";

/**
 * "Chạy" MỘT kịch bản trên bảng tính đang mở trong màn Thiết kế mẫu — bê `runScript` của
 * `ScriptEditorPanel.tsx` bản Jmix:
 *
 * - biên dịch riêng kịch bản (kịch bản đang tắt vẫn chạy thử được — tắt chỉ có nghĩa lúc chạy thật);
 * - kịch bản có hook chặn (beforeEdit / beforeCommit / beforePaste) thì gắn bộ chặn CỦA RIÊNG nó lên
 *   bảng tính — nhiều kịch bản cùng chạy thì cộng dồn, gỡ riêng bằng `stop()`;
 * - chạy onLoad, rồi validate, rồi (nếu có) getSummaryData và in tối đa 20 dòng.
 *
 * `ctx.shared` dùng chung vùng nhớ của lần nạp bảng tính, nên kịch bản chạy sau đọc được thứ kịch
 * bản chạy trước ghi (như bản Jmix dùng chung một ctx trong phiên Designer).
 *
 * File này KHÔNG import SpreadJS.
 */
export type DesignerScriptRun = {
  /** Các dòng nhật ký của lần chạy (đã định dạng như bản Jmix). */
  lines: string[];
  /** Gỡ bộ chặn của kịch bản; `null` = kịch bản không chạy được (lỗi cú pháp / bảng chưa sẵn sàng). */
  stop: (() => void) | null;
};

export type DesignerScriptRunOptions = {
  /** Mã biểu đang mở (BM-xxxxxx) — lọc phạm vi như lúc chạy thật. */
  sheetCode: string | null;
  /** `ctx.report` giả của màn thiết kế. */
  report: ScriptReportInfo;
  /** Nơi nhận `ctx.ui.message` — kể cả khi bộ chặn bắn lúc người dùng gõ ô sau này. */
  onMessage: (text: string) => void;
};

const SUMMARY_PREVIEW_ROWS = 20;

/** Mức của một mục kiểm tra, bằng chữ người dùng đọc được (khớp màu nhật ký ở màn soạn). */
function level(severity: "ERROR" | "WARNING"): string {
  return severity === "ERROR" ? "lỗi" : "lưu ý";
}

export async function runScriptInDesigner(
  api: SpreadWorkbookApi,
  record: ScriptRecord,
  options: DesignerScriptRunOptions
): Promise<DesignerScriptRun> {
  const lines: string[] = [`▶ Chạy kịch bản "${record.name}".`];
  const session = getScriptSession(api);
  if (!session) {
    lines.push("✕ Bảng tính chưa mở xong để chạy kịch bản.");
    return { lines, stop: null };
  }
  // Trong lúc chạy, ctx.ui.message vào nhật ký của lần chạy; sau đó (bộ chặn bắn khi gõ ô) đi thẳng
  // ra nơi người gọi chỉ định.
  let sink: (text: string) => void = (text) => lines.push(`[thông báo] ${text}`);
  const handle = createScriptContext({
    adapter: session.adapter,
    mode: "designer",
    report: options.report,
    shared: session.shared,
    onMessage: (text) => sink(text),
  });
  const engine = new ScriptHookEngine(handle);
  const errors = engine.load([{ ...record, enabled: true }], options.sheetCode);
  for (const error of errors) {
    lines.push(`✕ Lỗi cú pháp ở kịch bản "${error.record.name}": ${error.message}`);
  }
  if (errors.length > 0) return { lines, stop: null };

  const adapter = session.adapter;
  const cleanups: Array<() => void> = [];
  const guards =
    engine.hasHook("beforeEdit") || engine.hasHook("beforeCommit") || engine.hasHook("beforePaste");
  if (guards && adapter.onBeforeEdit && adapter.onBeforeCommit && adapter.onBeforePaste) {
    cleanups.push(
      adapter.onBeforeEdit((cell) => engine.runBeforeEdit(cell)),
      adapter.onBeforeCommit((cell, value) => engine.runBeforeCommit(cell, value)),
      adapter.onBeforePaste((range) => engine.runBeforePaste(range))
    );
    lines.push(
      `Kịch bản "${record.name}" đang CHẠY và chặn sửa / dán ô theo luật của nó. Chọn kịch bản rồi bấm "Dừng" để gỡ.`
    );
  } else {
    lines.push(
      `Kịch bản "${record.name}" đang CHẠY (không chặn sửa ô; phần khi mở biểu và kiểm tra đã chạy). Bấm "Dừng" để sửa kịch bản.`
    );
  }

  try {
    const load = await engine.runLifecycle("onLoad");
    for (const issue of load.issues) {
      lines.push(`[khi mở biểu · ${level(issue.severity)}] ${issue.message}`);
    }
    const validated = await engine.runValidate([]);
    for (const issue of validated) {
      lines.push(`[kiểm tra · ${level(issue.severity)}] ${issue.message}`);
    }
    lines.push(`Hoàn tất: phần kiểm tra báo ${validated.length} mục.`);
    if (engine.hasHook("getSummaryData")) {
      const summary = await engine.runGetSummaryData();
      for (const issue of summary.issues) {
        lines.push(`[lấy số tổng hợp · ${level(issue.severity)}] ${issue.message}`);
      }
      lines.push(`Lấy số tổng hợp (getSummaryData) trả ${summary.rows.length} dòng.`);
      for (const row of summary.rows.slice(0, SUMMARY_PREVIEW_ROWS)) {
        lines.push(`  ${JSON.stringify(row)}`);
      }
      if (summary.rows.length > SUMMARY_PREVIEW_ROWS) {
        lines.push(`  … và ${summary.rows.length - SUMMARY_PREVIEW_ROWS} dòng nữa.`);
      }
    }
  } catch (error) {
    lines.push(`✕ Chạy kịch bản thất bại: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    sink = options.onMessage;
  }

  return {
    lines,
    stop: () => {
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
  };
}
