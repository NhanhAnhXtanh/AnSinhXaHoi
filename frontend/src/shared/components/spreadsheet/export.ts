import type { ExportSheetSource, WorkbookJson } from "./types";

// Xuất Excel không cần mở bảng tính trên màn — SpreadJS chỉ tải khi gọi hàm.

/**
 * Gộp nhiều biểu thành MỘT file Excel nhiều tab rồi tải về (bản Jmix "Xuất Excel" phiếu).
 * Tên tab = tên biểu; định dạng từng biểu giữ nguyên. Nạp SpreadJS khi gọi.
 */
export async function exportWorkbooksToXlsx(
  sources: readonly ExportSheetSource[],
  fileName: string
): Promise<void> {
  const runner = await import("./impl/export-runner");
  await runner.exportMergedWorkbooks(sources, fileName);
}

/** Xuất MỘT workbook JSON ra .xlsx mà không cần mở bảng tính trên màn. */
export async function exportWorkbookJsonToXlsx(
  workbook: WorkbookJson,
  fileName: string
): Promise<void> {
  const runner = await import("./impl/export-runner");
  await runner.exportWorkbookJson(workbook, fileName);
}
