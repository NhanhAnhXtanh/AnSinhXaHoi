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
export type { ScriptHookName, ScriptRunMode } from "./script/types";
