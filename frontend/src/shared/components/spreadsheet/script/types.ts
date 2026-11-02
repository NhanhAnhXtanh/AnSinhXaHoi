// Hợp đồng script theo phiên bản mẫu — bê nguyên từ bản Jmix
// (asxh/src/main/frontend/quyettoan/core/script/types.ts) để script cũ đã lưu
// trong CSDL chạy y nguyên. File này KHÔNG import SpreadJS.
//
// Một script = mã JS kết thúc bằng `return defineScript({ onLoad(ctx) {...}, ... })`.
// Mọi năng lực đi qua `ctx` (facade), không bao giờ đưa workbook/DOM thô vào scope.

export const SCRIPT_HOOKS = [
  "onLoad",
  "beforeEdit",
  "beforeCommit",
  "beforePaste",
  "afterInject",
  "beforeExtract",
  "validate",
  "getInputData",
  "getSummaryData",
] as const;

export type ScriptHookName = (typeof SCRIPT_HOOKS)[number];

/**
 * - `input`: nhập liệu / xem phiếu.
 * - `summary`: màn tổng hợp CHỈ XEM.
 * - `summary-edit`: Sở sửa số tổng hợp.
 * - `designer`: chạy thử trong màn thiết kế mẫu.
 */
export type ScriptRunMode = "designer" | "input" | "summary" | "summary-edit";

export const SCRIPT_RUN_MODES: readonly ScriptRunMode[] = [
  "designer",
  "input",
  "summary",
  "summary-edit",
];

/** Một dòng số liệu do getInputData trả về (7 cột). */
export interface TempTableRow {
  organizationCode: string;
  organizationName: string;
  indicatorCode: string;
  indicatorName: string;
  quantity: number | null;
  amount: number | null;
  note?: string | null;
  orderNo?: number | null;
}

export interface SummaryDataRow {
  organizationCode?: string;
  indicatorCode: string;
  indicatorName: string;
  slot?: "" | "ALL" | "HK1" | "HK2" | "YEAR";
  quantity?: number | null;
  amount?: number | null;
  allocatedAmount?: number | null;
  note?: string | null;
  orderNo?: number | null;
}

export interface TempTableValidationIssue {
  severity: "ERROR" | "WARNING";
  code: string;
  message: string;
  businessKey?: string;
  tableRowIndex?: number;
  field?: "quantity" | "amount";
  source?: { sheetName: string; row: number; column: number };
}

export interface ScriptCellRef {
  sheetName: string;
  row: number;
  col: number;
}

export interface ScriptRangeRef extends ScriptCellRef {
  rowCount: number;
  colCount: number;
}

/**
 * Một kịch bản cần biên dịch — một dòng `asxh_template_scripts` (như `qt_template_script` của bản
 * Jmix). Máy chủ gửi các kịch bản đang bật của phiên bản dưới dạng mảng JSON trong `scriptText`.
 */
export interface ScriptRecord {
  id: string;
  name: string;
  /** null = chạy cho mọi biểu. */
  sheetCode: string | null;
  code: string;
  displayOrder: number;
  enabled: boolean;
}

/** Ngữ cảnh phiếu — script chỉ được đọc. */
export interface ScriptReportInfo {
  reportId: string;
  sheetCode: string;
  status: string;
  organizationCode: string;
}

/**
 * Phần workbook script được chạm tới. Adapter SpreadJS thật (`spread-adapter.ts`)
 * thoả interface này; các hàm `?` chỉ có ở adapter thật (gọi bằng `?.`).
 */
export interface ScriptWorkbookAdapter {
  getValue(sheetIndex: number, row: number, col: number): unknown;
  setValue(sheetIndex: number, row: number, col: number, value: unknown): void;
  getFormula(sheetIndex: number, row: number, col: number): string;
  getSheetIndex(sheetName: string): number;
  setCellLocked(sheetIndex: number, row: number, col: number, locked: boolean): void;
  setAllCellsLocked?(sheetIndex: number, locked: boolean): void;
  insertClonedRows(sheetIndex: number, templateRow: number, count: number): void;
  deleteRow(sheetIndex: number, atRow: number): void;
  applyComboBox?(
    sheetIndex: number,
    row: number,
    col: number,
    rowCount: number,
    items: { text: string; value: string }[]
  ): void;
  applyAddRowButton?(
    sheetIndex: number,
    row: number,
    col: number,
    caption: string,
    command: (clickedRow: number, clickedCol: number) => void
  ): void;
  applyCellButtons?(
    sheetIndex: number,
    row: number,
    col: number,
    buttons: {
      caption: string;
      command: (clickedRow: number, clickedCol: number) => void;
    }[]
  ): void;
  /** Gắn bộ chặn sửa ô; trả hàm gỡ. Chỉ adapter thật có — màn soạn kịch bản dùng để "Chạy" từng kịch bản. */
  onBeforeEdit?(guard: (cell: ScriptCellRef) => boolean | void): () => void;
  onBeforeCommit?(guard: (cell: ScriptCellRef, newValue: unknown) => boolean | void): () => void;
  onBeforePaste?(guard: (range: ScriptRangeRef) => boolean | void): () => void;
}

export interface ScriptContext {
  readonly mode: ScriptRunMode;
  readonly report: Readonly<ScriptReportInfo> | null;
  /** Vùng nhớ chung giữa mọi script của cùng một lần nạp workbook. */
  readonly shared: Record<string, unknown>;
  readonly cell: {
    get(sheetName: string, row: number, col: number): unknown;
    /** Từ chối ghi đè ô có công thức. */
    set(sheetName: string, row: number, col: number, value: unknown): void;
    getFormula(sheetName: string, row: number, col: number): string;
    lock(sheetName: string, row: number, col: number, locked: boolean): void;
    lockAll(sheetName: string, locked: boolean): void;
  };
  readonly rows: {
    clone(sheetName: string, templateRow: number, count: number): void;
    setDropdown(
      sheetName: string,
      col: number,
      firstRow: number,
      rowCount: number,
      items: { text: string; value: string }[]
    ): void;
    addRowButton(
      sheetName: string,
      row: number,
      col: number,
      caption: string,
      onClick: (clickedRow: number, clickedCol: number) => void
    ): void;
    setRowButtons(
      sheetName: string,
      row: number,
      col: number,
      buttons: {
        caption: string;
        onClick: (clickedRow: number, clickedCol: number) => void;
      }[]
    ): void;
    deleteRow(sheetName: string, row: number): void;
  };
  readonly api: {
    fetch(path: string, init?: RequestInit): Promise<unknown>;
    get(path: string): Promise<unknown>;
    post(path: string, body?: unknown): Promise<unknown>;
    push(path: string, body?: unknown): Promise<unknown>;
    put(path: string, body?: unknown): Promise<unknown>;
    patch(path: string, body?: unknown): Promise<unknown>;
  };
  readonly ui: {
    message(text: string): void;
  };
  readonly export: {
    download(filename: string, data: unknown): void;
  };
  readonly issues: {
    add(issue: TempTableValidationIssue): void;
  };
}

export interface ScriptHooks {
  onLoad?(ctx: ScriptContext): void | Promise<void>;
  beforeEdit?(ctx: ScriptContext, cell: ScriptCellRef): boolean | void;
  beforeCommit?(
    ctx: ScriptContext,
    cell: ScriptCellRef,
    newValue: unknown
  ): boolean | void;
  beforePaste?(ctx: ScriptContext, range: ScriptRangeRef): boolean | void;
  afterInject?(ctx: ScriptContext): void | Promise<void>;
  beforeExtract?(
    ctx: ScriptContext,
    rows: TempTableRow[]
  ): TempTableRow[] | void | Promise<TempTableRow[] | void>;
  validate?(
    ctx: ScriptContext,
    rows: TempTableRow[]
  ):
    | TempTableValidationIssue[]
    | void
    | Promise<TempTableValidationIssue[] | void>;
  getInputData?(ctx: ScriptContext): TempTableRow[] | Promise<TempTableRow[]>;
  getSummaryData?(
    ctx: ScriptContext
  ): SummaryDataRow[] | Promise<SummaryDataRow[]>;
}

export interface CompiledScript {
  record: ScriptRecord;
  hooks: ScriptHooks;
  declaredHooks: ScriptHookName[];
}

export interface ScriptCompileError {
  record: ScriptRecord;
  message: string;
  /** Dừng vì chạy quá giới hạn thời gian ngay khi nạp (vòng lặp ở mức ngoài cùng). */
  timedOut?: boolean;
}

/** Mã issue engine tự sinh khi script hỏng. */
export const SCRIPT_ERROR_CODE = "SCRIPT_ERROR";
