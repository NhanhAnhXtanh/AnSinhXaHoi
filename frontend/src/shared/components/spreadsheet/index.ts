// Bảng tính SpreadJS dùng chung. Import qua "@/shared/components/spreadsheet".
//
// Mọi thứ export ở đây đều NHẸ: SpreadJS chỉ tải khi <SpreadWorkbook>/<SpreadDesigner>
// được vẽ hoặc khi gọi hàm xuất Excel. Đừng export thứ gì từ `./impl/*` ra đây.

export type {
  WorkbookJson,
  SpreadWorkbookApi,
  SpreadWorkbookProps,
  SpreadDesignerProps,
  ScriptRunResult,
  ExportSheetSource,
} from "./types";

export { SpreadWorkbook, SpreadDesigner } from "./lazy";
export { exportWorkbooksToXlsx, exportWorkbookJsonToXlsx } from "./export";

export { runClientScript } from "./run-client-script";

export {
  buildExportFileName,
  mergeWorkbooksIntoTabs,
  stripEvaluationSheet,
} from "./workbook-json";

export { SCRIPT_HOOKS } from "./script/types";
export type { ScriptHookName, ScriptRecord, ScriptReportInfo, ScriptRunMode } from "./script/types";

// Màn soạn kịch bản trong Thiết kế mẫu: chạy thử từng kịch bản, đọc danh sách hook khai.
export { runScriptInDesigner } from "./script/designer-run";
export type { DesignerScriptRun, DesignerScriptRunOptions } from "./script/designer-run";
export { declaredHooksOf } from "./script/compile";

// Ô soạn quy tắc nhập (Monaco) — chỉ tải khi vẽ, như bảng tính.
export { ScriptEditor } from "./script-editor";
export type { ScriptEditorProps } from "./script-editor";
