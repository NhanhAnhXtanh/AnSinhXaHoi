import { kyInstance } from "@/shared/api/data";

import {
  SCRIPT_ERROR_CODE,
  type ScriptContext,
  type ScriptReportInfo,
  type ScriptRunMode,
  type ScriptWorkbookAdapter,
  type TempTableValidationIssue,
} from "./types";

/**
 * Dựng facade `ctx` cho script — bê từ bản Jmix (core/script/ctx-factory.ts).
 *
 * Khác bản Jmix ở `ctx.api`: bản Jmix chỉ cho gọi `/rest/qt/*`; bản React gọi
 * REST qua `kyInstance` (đã gắn token phiên, gốc `VITE_API_URL`). Nhận hai tiền tố:
 *  - `/api/<đường dẫn>` — endpoint của backend mới;
 *  - `/rest/qt/<đường dẫn>` — script cũ; đổi thành `<đường dẫn>` dưới gốc API.
 *    Backend mới phải có endpoint cùng đường dẫn thì script cũ mới chạy được.
 */

export interface ScriptContextOptions {
  adapter: ScriptWorkbookAdapter;
  mode: ScriptRunMode;
  report?: ScriptReportInfo | null;
  /** Vùng nhớ chung — truyền cùng object để onLoad và validate thấy chung dữ liệu. */
  shared: Record<string, unknown>;
  onMessage?: (text: string) => void;
}

export interface ScriptContextHandle {
  ctx: ScriptContext;
  /** Lấy và xoá các issue script đã add từ lần drain trước. */
  drainIssues(): TempTableValidationIssue[];
}

const API_PREFIXES = ["/api/", "/rest/qt/"] as const;
const SCRIPT_API_METHODS = new Set(["GET", "POST", "PUT", "PATCH"]);

function resolveSheet(adapter: ScriptWorkbookAdapter, sheetName: string): number {
  const index = adapter.getSheetIndex(sheetName);
  if (index < 0) throw new Error(`Sheet không tồn tại: ${sheetName}`);
  return index;
}

export function createScriptContext(
  options: ScriptContextOptions
): ScriptContextHandle {
  const { adapter, mode } = options;
  let pendingIssues: TempTableValidationIssue[] = [];

  const ctx: ScriptContext = {
    mode,
    report: options.report ? Object.freeze({ ...options.report }) : null,
    // Object.freeze(ctx) bên dưới là shallow — shared vẫn ghi được, đúng chủ đích.
    shared: options.shared,
    cell: Object.freeze({
      get(sheetName: string, row: number, col: number) {
        return adapter.getValue(resolveSheet(adapter, sheetName), row, col);
      },
      set(sheetName: string, row: number, col: number, value: unknown) {
        const sheetIndex = resolveSheet(adapter, sheetName);
        const formula = adapter.getFormula(sheetIndex, row, col);
        if (formula.trim() !== "") {
          throw new Error(
            `Không được ghi đè ô có công thức (${sheetName} dòng ${row + 1} cột ${col + 1}) — công thức thuộc về mẫu.`
          );
        }
        adapter.setValue(sheetIndex, row, col, value);
      },
      getFormula(sheetName: string, row: number, col: number) {
        return adapter.getFormula(resolveSheet(adapter, sheetName), row, col);
      },
      lock(sheetName: string, row: number, col: number, locked: boolean) {
        adapter.setCellLocked(resolveSheet(adapter, sheetName), row, col, locked);
      },
      lockAll(sheetName: string, locked: boolean) {
        adapter.setAllCellsLocked?.(resolveSheet(adapter, sheetName), locked);
      },
    }),
    rows: Object.freeze({
      clone(sheetName: string, templateRow: number, count: number) {
        adapter.insertClonedRows(resolveSheet(adapter, sheetName), templateRow, count);
      },
      setDropdown(
        sheetName: string,
        col: number,
        firstRow: number,
        rowCount: number,
        items: { text: string; value: string }[]
      ) {
        adapter.applyComboBox?.(
          resolveSheet(adapter, sheetName),
          firstRow,
          col,
          rowCount,
          items
        );
      },
      addRowButton(
        sheetName: string,
        row: number,
        col: number,
        caption: string,
        onClick: (clickedRow: number, clickedCol: number) => void
      ) {
        adapter.applyAddRowButton?.(
          resolveSheet(adapter, sheetName),
          row,
          col,
          caption,
          onClick
        );
      },
      setRowButtons(
        sheetName: string,
        row: number,
        col: number,
        buttons: {
          caption: string;
          onClick: (clickedRow: number, clickedCol: number) => void;
        }[]
      ) {
        adapter.applyCellButtons?.(
          resolveSheet(adapter, sheetName),
          row,
          col,
          buttons.map((b) => ({ caption: b.caption, command: b.onClick }))
        );
      },
      deleteRow(sheetName: string, row: number) {
        adapter.deleteRow(resolveSheet(adapter, sheetName), row);
      },
    }),
    api: Object.freeze(createScriptApi(options.shared)),
    ui: Object.freeze({
      message(text: string) {
        options.onMessage?.(String(text));
      },
    }),
    export: Object.freeze({
      download(filename: string, data: unknown) {
        const name = String(filename ?? "").trim() || "export.json";
        const content =
          typeof data === "string" ? data : JSON.stringify(data, null, 2);
        const blob = new Blob([content], {
          type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = name;
        anchor.click();
        URL.revokeObjectURL(url);
      },
    }),
    issues: Object.freeze({
      add(issue: TempTableValidationIssue) {
        if (
          issue == null ||
          typeof issue !== "object" ||
          typeof issue.message !== "string"
        ) {
          throw new Error("ctx.issues.add cần {severity, code, message}.");
        }
        pendingIssues.push({
          severity: issue.severity === "WARNING" ? "WARNING" : "ERROR",
          code:
            typeof issue.code === "string" && issue.code.trim() !== ""
              ? issue.code
              : SCRIPT_ERROR_CODE,
          message: issue.message,
          businessKey: issue.businessKey,
          field: issue.field,
        });
      },
    }),
  };

  return {
    ctx: Object.freeze(ctx),
    drainIssues() {
      const drained = pendingIssues;
      pendingIssues = [];
      return drained;
    },
  };
}

/** `/api/x` hoặc `/rest/qt/x` → `x` (tương đối với gốc API của kyInstance). */
function resolveApiPath(path: string): string {
  const raw = String(path ?? "");
  const prefix = API_PREFIXES.find((p) => raw.startsWith(p));
  if (!prefix) {
    throw new Error(
      `ctx.api chỉ được gọi endpoint ${API_PREFIXES.join(" hoặc ")}* (nhận: ${raw}).`
    );
  }
  return raw.slice(prefix.length);
}

/** Đường số liệu tổng hợp sống mà script tổng hợp có sẵn gọi cứng. */
const LIVE_SUMMARY_DATA_PATHS = ["/rest/qt/summary/data", "/api/summary/data"] as const;

/**
 * Script tổng hợp viết cứng đường số liệu sống: ở màn số liệu Sở đã lưu / số năm / phiếu năm thì
 * đổi sang `shared.summaryDataUrl` (đúng nguồn, đúng phiên bản đang xem), giữ nguyên tham số —
 * như `rewriteSummaryDataPath` của bản Jmix. Đường khác giữ nguyên.
 */
function rewriteSummaryDataPath(path: string, shared: Record<string, unknown>): string {
  const target = shared.summaryDataUrl;
  if (typeof target !== "string" || target === "" || target === "/api/summary/data") return path;
  const live = LIVE_SUMMARY_DATA_PATHS.find((p) => path === p || path.startsWith(`${p}?`));
  if (!live) return path;
  return target + path.slice(live.length);
}

function createScriptApi(shared: Record<string, unknown>): ScriptContext["api"] {
  // GET trùng đường dẫn trong CÙNG một ctx (một lần nạp bảng tính: onLoad + afterInject) chỉ
  // gọi máy chủ một lần — script tổng hợp năm đọc lại cùng một nguồn cho từng sheet. Lưu CHỮ
  // của response, mỗi lần gọi parse lại nên script sửa kết quả không ảnh hưởng lần gọi sau.
  // Lỗi không được nhớ; mọi lệnh ghi xoá sạch bộ nhớ. GET có header riêng thì không nhớ.
  const getCache = new Map<string, Promise<string>>();
  const send = async (relative: string, method: string, init: RequestInit, path: string): Promise<string> => {
    try {
      const response = await kyInstance(relative, {
        method,
        headers: init.headers,
        body: init.body,
      });
      // kyInstance không tự ném với mã lỗi ở mọi đường — kiểm lại cho chắc.
      if (!response.ok) {
        throw { statusCode: response.status };
      }
      return await response.text();
    } catch (error) {
      const status =
        error && typeof error === "object" && "statusCode" in error
          ? String((error as { statusCode?: unknown }).statusCode)
          : "?";
      throw new Error(`ctx.api ${method} ${path} thất bại (HTTP ${status}).`);
    }
  };
  const request = async (path: string, init: RequestInit = {}): Promise<unknown> => {
    const relative = resolveApiPath(rewriteSummaryDataPath(String(path ?? ""), shared));
    const method = (init.method ?? "GET").toUpperCase();
    if (!SCRIPT_API_METHODS.has(method)) {
      throw new Error(
        `ctx.api.fetch không hỗ trợ HTTP ${method}. Chỉ dùng GET, POST, PUT hoặc PATCH.`
      );
    }
    let text: string;
    if (method === "GET" && init.headers === undefined) {
      let pending = getCache.get(relative);
      if (!pending) {
        pending = send(relative, method, init, path);
        getCache.set(relative, pending);
        pending.catch(() => getCache.delete(relative));
      }
      text = await pending;
    } else {
      if (method !== "GET") getCache.clear();
      text = await send(relative, method, init, path);
    }
    if (text.trim() === "") return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  };
  const write = (method: "POST" | "PUT" | "PATCH", path: string, body?: unknown) =>
    request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    fetch: request,
    get: (path) => request(path),
    post: (path, body) => write("POST", path, body),
    push: (path, body) => write("POST", path, body),
    put: (path, body) => write("PUT", path, body),
    patch: (path, body) => write("PATCH", path, body),
  };
}
