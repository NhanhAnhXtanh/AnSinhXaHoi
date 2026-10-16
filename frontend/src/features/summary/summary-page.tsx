import { useState } from "react";
import { useSearchParams } from "react-router";

import { AsxhPage, YearSelect, useReportYear } from "@/shared/components/asxh";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";

import { PERIODS_2026, YEAR_REPORTS, type SummaryPeriod, type YearReport } from "./fixtures";
import { PeriodMode, type PeriodEdits } from "./period-mode";
import { YearMode, yearStatusOf } from "./year-mode";

/** Năm có danh sách kỳ trong dữ liệu mẫu. */
const PERIOD_YEAR = 2026;

type Mode = "ky" | "nam";

/**
 * Tổng hợp báo cáo — số liệu tổng hợp từ các phiếu đã được duyệt, theo từng kỳ
 * hoặc cả năm. Hai chế độ dùng chung trạng thái (kỳ, báo cáo năm) để việc ở
 * chế độ này hiện ngay ở chế độ kia: nộp báo cáo năm thì kỳ bị khoá sửa, kỳ còn
 * biểu sửa dở thì báo cáo năm chưa nộp được.
 */
export function SummaryPage() {
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get("xem") === "nam" ? "nam" : "ky";
  const setMode = (m: Mode) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (m === "nam") next.set("xem", "nam");
        else next.delete("xem");
        return next;
      },
      { replace: true }
    );

  const { year, setYear } = useReportYear();
  const [periods, setPeriods] = useState<SummaryPeriod[]>(PERIODS_2026);
  const [reports, setReports] = useState<YearReport[]>(YEAR_REPORTS);
  const [edits, setEdits] = useState<PeriodEdits>({});

  const yearPeriods = year === PERIOD_YEAR ? periods : [];
  const yearStatus = yearStatusOf(reports.find((r) => r.year === year));
  const lockReason =
    yearStatus === "cho-duyet"
      ? `Năm ${year} đã nộp UBND, không sửa được`
      : yearStatus === "da-duyet"
        ? `UBND đã duyệt năm ${year}, không sửa được`
        : null;

  return (
    <AsxhPage
      title="Tổng hợp báo cáo"
      description="Số liệu tổng hợp từ các phiếu đã được duyệt, theo từng kỳ hoặc cả năm."
      fill
      actions={
        <>
          <YearSelect />
          <Tabs value={mode} onValueChange={(v) => setMode(v === "nam" ? "nam" : "ky")}>
            <TabsList aria-label="Xem theo">
              <TabsTrigger value="ky" className="px-3">
                Theo kỳ
              </TabsTrigger>
              <TabsTrigger value="nam" className="px-3">
                Theo năm
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </>
      }
    >
      {mode === "ky" ? (
        <PeriodMode
          key={year}
          year={year}
          periods={yearPeriods}
          onPeriodsChange={(updater) => setPeriods((prev) => updater(prev))}
          edits={edits}
          onEditsChange={setEdits}
          lockReason={lockReason}
        />
      ) : (
        <YearMode
          year={year}
          onYearChange={setYear}
          reports={reports}
          onReportsChange={setReports}
          periods={yearPeriods}
        />
      )}
    </AsxhPage>
  );
}
