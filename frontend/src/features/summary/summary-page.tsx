import { useEffect } from "react";
import { useSearchParams } from "react-router";

import { AsxhPage, YearSelect, useReportYear } from "@/shared/components/asxh";
import { useConfirmDiscard } from "@/shared/components/form/unsaved-changes-guard";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";

import { PeriodMode } from "./period-mode";
import { YearMode } from "./year-mode";

type Mode = "ky" | "nam";

/**
 * Tổng hợp báo cáo (UC-50..56) — số liệu tổng hợp từ các phiếu đã được duyệt,
 * theo từng kỳ hoặc cả năm. Chế độ giữ trên đường dẫn (`?xem=nam`), năm dùng
 * chung với các màn khác.
 *
 * Màn khác mở thẳng một biểu của một kỳ (Lịch sử mở đợt): `?nam=` chọn năm một lần khi vào rồi
 * bỏ khỏi đường dẫn, `?ky=` (id kỳ) và `?bieu=` (id biểu) là lựa chọn ban đầu của chế độ Theo kỳ.
 */
export function SummaryPage() {
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get("xem") === "nam" ? "nam" : "ky";
  // Đổi chế độ đi bằng `replace` — UnsavedChangesGuard không chặn — nên tự hỏi khi đang có
  // số tổng hợp sửa dở chưa lưu ở chế độ Theo kỳ.
  const confirmDiscard = useConfirmDiscard();
  const setMode = (m: Mode) => {
    if (m === mode) return;
    confirmDiscard(() =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (m === "nam") next.set("xem", "nam");
          else next.delete("xem");
          return next;
        },
        { replace: true }
      )
    );
  };

  const { year, setYear } = useReportYear();

  const linkedYear = Number(params.get("nam"));
  useEffect(() => {
    if (!Number.isInteger(linkedYear) || linkedYear <= 0) return;
    if (linkedYear !== year) setYear(linkedYear);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("nam");
        return next;
      },
      { replace: true }
    );
  }, [linkedYear, year, setYear, setParams]);

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
      {mode === "ky" ? <PeriodMode key={year} year={year} /> : <YearMode year={year} onYearChange={setYear} />}
    </AsxhPage>
  );
}
