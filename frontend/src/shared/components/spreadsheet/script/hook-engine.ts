import { compileRecord } from "./compile";
import { ScriptTimeoutError } from "./loop-guard";
import type { ScriptContextHandle } from "./ctx-factory";
import {
  SCRIPT_ERROR_CODE,
  type CompiledScript,
  type ScriptCellRef,
  type ScriptCompileError,
  type ScriptHookName,
  type ScriptRangeRef,
  type ScriptRecord,
  type SummaryDataRow,
  type TempTableRow,
  type TempTableValidationIssue,
} from "./types";

/** Ngân sách cho hook đồng bộ — chạy trong event handler gõ phím của SpreadJS. */
const SYNC_HOOK_BUDGET_MS = 5;

export interface LifecycleRunResult {
  issues: TempTableValidationIssue[];
}

export interface ExtractRunResult {
  rows: TempTableRow[];
  issues: TempTableValidationIssue[];
}

/**
 * Chạy các script đã biên dịch theo thứ tự — bê từ bản Jmix (core/script/hook-engine.ts):
 *
 * - Script lỗi KHÔNG BAO GIỜ làm sập bảng tính — lỗi thành issue mã SCRIPT_ERROR.
 * - Hook chặn (beforeEdit/beforeCommit/beforePaste) là AND: một script trả false
 *   là chặn. Script LỖI ở hook chặn thì cho thao tác đi tiếp (bug script không
 *   được khoá người nhập khỏi phiếu của họ).
 * - beforeExtract là pipeline: output script trước = input script sau.
 */
export class ScriptHookEngine {
  private scripts: CompiledScript[] = [];
  private errors: ScriptCompileError[] = [];
  private readonly handle: ScriptContextHandle;
  private timedOut = false;

  constructor(handle: ScriptContextHandle) {
    this.handle = handle;
  }

  /** Nạp + biên dịch. `sheetCode` lọc script theo biểu (record.sheetCode null = mọi biểu). */
  load(records: readonly ScriptRecord[], sheetCode?: string | null): ScriptCompileError[] {
    this.scripts = [];
    this.errors = [];
    const applicable = records
      .filter((record) => record.enabled)
      .filter(
        (record) =>
          record.sheetCode == null ||
          sheetCode == null ||
          record.sheetCode === sheetCode
      )
      .sort((a, b) => a.displayOrder - b.displayOrder);
    for (const record of applicable) {
      const result = compileRecord(record);
      this.scripts.push(...result.scripts);
      this.errors.push(...result.errors);
    }
    return this.errors;
  }

  get compileErrors(): readonly ScriptCompileError[] {
    return this.errors;
  }

  /** Có kịch bản nào bị dừng vì giữ trình duyệt quá giới hạn (loop-guard.ts) không. */
  get didTimeOut(): boolean {
    return this.timedOut || this.errors.some((entry) => entry.timedOut === true);
  }

  hasHook(name: ScriptHookName): boolean {
    return this.scripts.some((script) => script.hooks[name] != null);
  }

  private scriptErrorIssue(
    scriptName: string,
    error: unknown,
    severity: "ERROR" | "WARNING" = "WARNING"
  ): TempTableValidationIssue {
    if (error instanceof ScriptTimeoutError) this.timedOut = true;
    return {
      severity,
      code: SCRIPT_ERROR_CODE,
      message: `Script "${scriptName}" lỗi: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  compileErrorIssues(): TempTableValidationIssue[] {
    return this.errors.map((entry) =>
      this.scriptErrorIssue(entry.record.name, entry.message)
    );
  }

  async runLifecycle(name: "onLoad" | "afterInject"): Promise<LifecycleRunResult> {
    const issues: TempTableValidationIssue[] = [];
    for (const script of this.scripts) {
      const hook = script.hooks[name];
      if (!hook) continue;
      try {
        await hook(this.handle.ctx);
      } catch (error) {
        // onLoad/afterInject lỗi = trang vẫn dùng được (WARNING).
        issues.push(this.scriptErrorIssue(script.record.name, error, "WARNING"));
      }
      issues.push(...this.handle.drainIssues());
    }
    return { issues };
  }

  /** Gom rows từ mọi hook getInputData — "chạy thử" phía trình duyệt. Lỗi = ERROR. */
  async runGetInputData(): Promise<ExtractRunResult> {
    const rows: TempTableRow[] = [];
    const issues: TempTableValidationIssue[] = [];
    for (const script of this.scripts) {
      const hook = script.hooks.getInputData;
      if (!hook) continue;
      try {
        const result = await hook(this.handle.ctx);
        if (Array.isArray(result)) rows.push(...result);
      } catch (error) {
        issues.push(this.scriptErrorIssue(script.record.name, error, "ERROR"));
      }
      issues.push(...this.handle.drainIssues());
    }
    return { rows, issues };
  }

  async runGetSummaryData(): Promise<{
    rows: SummaryDataRow[];
    issues: TempTableValidationIssue[];
  }> {
    const rows: SummaryDataRow[] = [];
    const issues: TempTableValidationIssue[] = [];
    for (const script of this.scripts) {
      const hook = script.hooks.getSummaryData;
      if (!hook) continue;
      try {
        const result = await hook(this.handle.ctx);
        if (Array.isArray(result)) rows.push(...result);
      } catch (error) {
        issues.push(this.scriptErrorIssue(script.record.name, error, "ERROR"));
      }
      issues.push(...this.handle.drainIssues());
    }
    return { rows, issues };
  }

  private runGuard(
    name: "beforeEdit" | "beforeCommit" | "beforePaste",
    invoke: (script: CompiledScript) => boolean | void
  ): boolean {
    for (const script of this.scripts) {
      if (!script.hooks[name]) continue;
      const startedAt = performance.now();
      try {
        // Hook đồng bộ: trả Promise nghĩa là lỡ dùng async — coi như không chặn.
        const verdict: unknown = invoke(script);
        if (verdict instanceof Promise) {
          console.warn(
            `Script "${script.record.name}": hook ${name} phải đồng bộ, kết quả async bị bỏ qua.`
          );
        } else if (verdict === false) {
          return false;
        }
      } catch (error) {
        if (error instanceof ScriptTimeoutError) this.timedOut = true;
        console.warn(`Script "${script.record.name}" lỗi ở hook ${name}:`, error);
      } finally {
        const elapsed = performance.now() - startedAt;
        if (elapsed > SYNC_HOOK_BUDGET_MS) {
          console.warn(
            `Script "${script.record.name}": hook ${name} chạy ${elapsed.toFixed(1)}ms (ngân sách ${SYNC_HOOK_BUDGET_MS}ms).`
          );
        }
        this.handle.drainIssues();
      }
    }
    return true;
  }

  runBeforeEdit(cell: ScriptCellRef): boolean {
    return this.runGuard("beforeEdit", (script) =>
      script.hooks.beforeEdit!(this.handle.ctx, cell)
    );
  }

  runBeforeCommit(cell: ScriptCellRef, newValue: unknown): boolean {
    return this.runGuard("beforeCommit", (script) =>
      script.hooks.beforeCommit!(this.handle.ctx, cell, newValue)
    );
  }

  runBeforePaste(range: ScriptRangeRef): boolean {
    return this.runGuard("beforePaste", (script) =>
      script.hooks.beforePaste!(this.handle.ctx, range)
    );
  }

  async runBeforeExtract(rows: TempTableRow[]): Promise<ExtractRunResult> {
    const issues: TempTableValidationIssue[] = [];
    let current = rows;
    for (const script of this.scripts) {
      const hook = script.hooks.beforeExtract;
      if (!hook) continue;
      try {
        const result = await hook(this.handle.ctx, current);
        if (Array.isArray(result)) current = result;
      } catch (error) {
        issues.push(this.scriptErrorIssue(script.record.name, error));
      }
      issues.push(...this.handle.drainIssues());
    }
    return { rows: current, issues };
  }

  async runValidate(rows: TempTableRow[]): Promise<TempTableValidationIssue[]> {
    const issues: TempTableValidationIssue[] = [];
    for (const script of this.scripts) {
      const hook = script.hooks.validate;
      if (!hook) continue;
      try {
        const result = await hook(this.handle.ctx, rows);
        if (Array.isArray(result)) {
          for (const issue of result) this.handle.ctx.issues.add(issue);
        }
      } catch (error) {
        // ERROR: validate là hàng rào trước khi nộp — hạ xuống cảnh báo là fail-open.
        issues.push(this.scriptErrorIssue(script.record.name, error, "ERROR"));
      }
      issues.push(...this.handle.drainIssues());
    }
    return issues;
  }
}
