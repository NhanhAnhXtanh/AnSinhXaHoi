import { useCallback, useState } from "react";
import { useDataProvider } from "@refinedev/core";
import { toast } from "sonner";

import {
  buildExportFileName,
  exportWorkbooksToXlsx,
  type ExportSheetSource,
  type WorkbookJson,
} from "@/shared/components/spreadsheet";

import {
  SHEETS_RESOURCE,
  errorMessage,
  parseWorkbook,
  type InputReportRecord,
  type InputReportSheetRecord,
} from "./api";

/** Nhiều nhất số biểu một phiếu — đủ rộng cho bộ mẫu thật (≈10 biểu). */
const MAX_SHEETS = 200;

/**
 * Xuất Excel cả phiếu (UC-45): mọi biểu của phiếu ghép thành MỘT tệp .xlsx, mỗi
 * biểu một tab. Biểu đang mở trên màn lấy số trên màn (kể cả phần chưa lưu) qua
 * `overrides`; biểu khác lấy bản đã lưu, chưa lưu lần nào thì lấy khung mẫu.
 * Xuất ở trình duyệt, không ghi gì lên máy chủ (BR-45.1).
 */
export function useExportReport() {
  const dataProvider = useDataProvider();
  const [exporting, setExporting] = useState(false);

  const exportReport = useCallback(
    async (report: InputReportRecord, overrides?: ReadonlyMap<number, WorkbookJson>) => {
      if (exporting) return;
      setExporting(true);
      const provider = dataProvider();
      try {
        const { data: sheets } = await provider.getList<InputReportSheetRecord>({
          resource: SHEETS_RESOURCE,
          pagination: { currentPage: 1, pageSize: MAX_SHEETS, mode: "server" },
          filters: [{ field: "report.id", operator: "eq", value: report.id }],
        });
        if (sheets.length === 0) {
          toast.info("Phiếu chưa có biểu nào để xuất.");
          return;
        }

        const sources: ExportSheetSource[] = [];
        for (const sheet of sheets) {
          const code = sheet.template.shortName;
          let workbook: WorkbookJson | null = overrides?.get(sheet.id) ?? null;
          if (!workbook) {
            const { data } = await provider.getOne<InputReportSheetRecord>({
              resource: SHEETS_RESOURCE,
              id: sheet.id,
            });
            workbook = parseWorkbook(data.dataJson) ?? parseWorkbook(data.templateWorkbookJson);
          }
          if (!workbook) {
            toast.error(`Không đọc được số liệu của biểu ${code}. Bạn thử lại sau ít phút.`);
            return;
          }
          sources.push({ sheetCode: code, sheetName: code, workbookJson: workbook });
        }

        const fileName = buildExportFileName(report.unit.name, report.period.name, report.revisionNo);
        await exportWorkbooksToXlsx(sources, fileName);
        toast.success(`Đã xuất phiếu ${report.period.name} ra tệp ${fileName}.`);
      } catch (error) {
        toast.error(errorMessage(error, "Chưa xuất được tệp Excel. Bạn thử lại sau ít phút."));
      } finally {
        setExporting(false);
      }
    },
    [dataProvider, exporting]
  );

  return { exportReport, exporting };
}
