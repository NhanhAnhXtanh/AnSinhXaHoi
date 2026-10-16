import * as GC from "@mescius/spread-sheets";
import "@mescius/spread-sheets-io";

import type { ExportSheetSource, WorkbookJson } from "../types";
import {
  ensureXlsxName,
  mergeWorkbooksIntoTabs,
  prepareJsonForExport,
} from "../workbook-json";
import { applySpreadLicense } from "./license";
import { wrapSpreadWorkbook } from "./spread-adapter";

applySpreadLicense();

/**
 * Xuất một JSON workbook ra .xlsx bằng một workbook TẠM ngoài màn hình — bê từ bản
 * Jmix (core/report/workbookExportRunner.ts). Dựng lại bằng chính SpreadJS nên giữ
 * nguyên khung, màu, công thức, độ rộng cột. Workbook tạm luôn được huỷ ở finally.
 *
 * KHÔNG xuất thẳng workbook đang hiện trên màn: nó đang ẩn hàng tab (màn tự vẽ tab)
 * và có thể chứa sheet "Evaluation Version"; JSON được làm sạch trước
 * (`prepareJsonForExport`: bỏ sheet kỹ thuật, ép `tabStripVisible: true`).
 */
export async function exportJsonToXlsx(json: WorkbookJson, fileName: string): Promise<void> {
  // Container rời, KHÔNG gắn vào trang — người dùng không thấy bảng tạm nhấp nháy.
  const container = document.createElement("div");
  container.style.width = "1024px";
  container.style.height = "768px";
  const adapter = wrapSpreadWorkbook(new GC.Spread.Sheets.Workbook(container), {
    destroyWorkbook: true,
  });
  try {
    // Nạp ĐỒNG BỘ toàn bộ: workbook không gắn DOM, nạp dần sẽ thiếu các tab sau.
    await adapter.fromJSON(json, { incremental: false });
    const blob = await adapter.exportBlob();
    downloadBlob(blob, ensureXlsxName(fileName));
  } finally {
    adapter.destroy();
  }
}

/** Xuất một workbook (đã làm sạch cho file Excel). */
export function exportWorkbookJson(json: WorkbookJson, fileName: string): Promise<void> {
  return exportJsonToXlsx(prepareJsonForExport(json), fileName);
}

/** Gộp nhiều biểu thành một file Excel nhiều tab. */
export async function exportMergedWorkbooks(
  sources: readonly ExportSheetSource[],
  fileName: string
): Promise<void> {
  const merged = mergeWorkbooksIntoTabs(sources);
  if (!merged.sheetCount) {
    throw new Error("Phiếu chưa có biểu nào để xuất.");
  }
  await exportJsonToXlsx(merged, fileName);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
