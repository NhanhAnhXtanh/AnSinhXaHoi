import { useCustom } from "@refinedev/core";

import { customResult } from "@/shared/hooks/use-custom-result";

import { dataUnitsUrl, type ReportDataUnits } from "../api";
import { unitLabel } from "./data-unit-label";

/**
 * Phiếu nhập hộ (UC-46) cho những đơn vị nào — đọc một lần cho cả phiếu.
 * `onBehalf` false = phiếu thường (hoặc chưa đọc xong / lỗi mạng: khi đó dải không hiện).
 */
export function useReportDataUnits(reportId: number) {
  const { result, query } = useCustom<ReportDataUnits>({
    url: dataUnitsUrl(reportId),
    method: "get",
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const data = customResult(result?.data, "sheets");
  const sheets = data?.sheets ?? [];
  const units = sheets.flatMap((s) => s.units);
  return {
    data,
    loading: query.isLoading,
    onBehalf: sheets.length > 0,
    unknownCodes: units.filter((u) => !u.known).map((u) => u.budgetCode),
    /** Câu ngắn cho hộp xác nhận phê duyệt; null = phiếu thường. */
    approveNote:
      sheets.length === 0
        ? null
        : sheets
            .map(
              (s) =>
                `Biểu ${s.templateShortName} là biểu nhập hộ: số liệu sẽ được ghi cho ${s.units.length} đơn vị (${s.units
                  .map(unitLabel)
                  .join(", ")}), không ghi cho đơn vị nộp phiếu.`
            )
            .join(" "),
  };
}

