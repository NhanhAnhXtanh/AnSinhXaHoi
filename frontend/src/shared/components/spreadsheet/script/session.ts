import type { SpreadWorkbookApi } from "../types";
import {
  SCRIPT_RUN_MODES,
  type ScriptReportInfo,
  type ScriptRunMode,
  type ScriptWorkbookAdapter,
} from "./types";

/**
 * Nối `SpreadWorkbookApi` (thứ feature cầm) với adapter bên trong + vùng nhớ
 * `ctx.shared` của lần nạp workbook. Nhờ vậy `runClientScript(api, …)` chạy được
 * mà feature không phải đụng tới SpreadJS, và hook `validate` thấy đúng dữ liệu
 * `onLoad` đã ghi vào `ctx.shared` (giống bản Jmix: shared sống suốt một lần nạp).
 *
 * File này KHÔNG import SpreadJS — nằm chung bundle với `runClientScript`.
 */
export type ScriptSession = {
  adapter: ScriptWorkbookAdapter;
  shared: Record<string, unknown>;
  mode: ScriptRunMode;
  sheetCode: string | null;
  report: ScriptReportInfo | null;
};

const sessions = new WeakMap<SpreadWorkbookApi, ScriptSession>();

export function registerScriptSession(api: SpreadWorkbookApi, session: ScriptSession) {
  sessions.set(api, session);
}

export function getScriptSession(api: SpreadWorkbookApi): ScriptSession | undefined {
  return sessions.get(api);
}

export function resolveRunMode(
  value: unknown,
  fallback: ScriptRunMode = "input"
): ScriptRunMode {
  return typeof value === "string" &&
    (SCRIPT_RUN_MODES as readonly string[]).includes(value)
    ? (value as ScriptRunMode)
    : fallback;
}

export function resolveReport(value: unknown): ScriptReportInfo | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  return {
    reportId: String(r.reportId ?? ""),
    sheetCode: String(r.sheetCode ?? ""),
    status: String(r.status ?? ""),
    organizationCode: String(r.organizationCode ?? ""),
  };
}

/**
 * Dữ liệu feature truyền (`scriptContext`) → `ctx.shared`. Script cũ của bản Jmix
 * đọc `ctx.shared.orgName` (tên đơn vị, tự điền ô "ĐƠN VỊ"), nên `unitName` được
 * nhân thêm thành `orgName` khi feature chưa tự đặt.
 */
export function toSharedData(context: Record<string, unknown> | undefined): Record<string, unknown> {
  const data: Record<string, unknown> = { ...(context ?? {}) };
  if (data.orgName == null) {
    data.orgName = typeof data.unitName === "string" ? data.unitName : "";
  }
  return data;
}

export function resolveSheetCode(context: Record<string, unknown> | undefined): string | null {
  const value = context?.sheetCode;
  return typeof value === "string" && value !== "" ? value : null;
}
