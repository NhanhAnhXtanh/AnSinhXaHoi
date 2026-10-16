import type { SpreadWorkbookApi, WorkbookJson } from "../types";
import { isTechnicalSheetName, stripEvaluationSheet } from "../workbook-json";
import { exportWorkbookJson } from "./export-runner";
import type { SpreadAdapter } from "./spread-adapter";

export type WorkbookApiHooks = {
  /** Sau khi nạp file: đặt lại khoá tab/ẩn hàng tab… (JSON nạp vào có thể ghi đè). */
  afterImport?: () => void;
};

/** Dựng `SpreadWorkbookApi` (thứ feature cầm) trên adapter SpreadJS. */
export function createWorkbookApi(
  adapter: SpreadAdapter,
  hooks: WorkbookApiHooks = {}
): SpreadWorkbookApi {
  const businessSheetIndexes = (): number[] => {
    const result: number[] = [];
    for (let i = 0; i < adapter.getSheetCount(); i += 1) {
      if (!isTechnicalSheetName(adapter.getSheetName(i))) result.push(i);
    }
    return result;
  };

  const api: SpreadWorkbookApi = {
    toJSON() {
      return stripEvaluationSheet(adapter.workbook.toJSON() as WorkbookJson);
    },
    getSheetNames() {
      return businessSheetIndexes().map((i) => adapter.getSheetName(i));
    },
    setActiveSheet(name) {
      const index = adapter.getSheetIndex(name);
      if (index >= 0) adapter.setActiveSheet(index);
    },
    exportXlsx(fileName) {
      return exportWorkbookJson(adapter.workbook.toJSON() as WorkbookJson, fileName);
    },
    async importFile(file) {
      adapter.suspendPaint();
      try {
        await adapter.importFile(file);
        hooks.afterImport?.();
      } catch (error) {
        console.error("Không nạp được tệp bảng tính:", error);
        throw new Error("Không mở được tệp này. Hãy chọn tệp Excel (.xlsx) hoặc tệp bảng tính đã lưu.");
      } finally {
        adapter.resumePaint();
      }
    },
    getCellValue(sheet, row, col) {
      const index = adapter.getSheetIndex(sheet);
      if (index < 0) return undefined;
      return adapter.getValue(index, row, col);
    },
    raw() {
      return adapter.workbook;
    },
  };
  return api;
}
