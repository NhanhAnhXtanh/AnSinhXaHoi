import { useState } from "react";

import { AsxhPage, YearSelect, formatDate, useReportYear } from "@/shared/components/asxh";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { cn } from "@/shared/lib/utils";

import { BySheetView } from "./by-sheet-view";
import { ByUnitView } from "./by-unit-view";
import { FIXTURE_YEAR } from "./fixtures";

type Mode = "sheet" | "unit";

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/** "Thứ Năm, 15/10/2026" */
function todayLabel(): string {
  const now = new Date();
  return `${WEEKDAYS[now.getDay()]}, ${formatDate(now)}`;
}

/**
 * Trang chủ.
 *
 * Hai cách nhìn cùng một năm báo cáo, đổi bằng nút phân đoạn ở đầu trang:
 * "Theo phiếu" đếm phiếu của các kỳ đang nhận số liệu, "Theo đơn vị" xem
 * từng đơn vị đã nộp tới đâu. Màn không cuộn trang (`fill`): mỗi khối tự cuộn
 * phần nội dung của nó.
 *
 * Chưa có API: số liệu lấy từ `fixtures.ts`. Không phải tài nguyên dữ liệu
 * nên vẫn nằm trong `UNGUARDED_RESOURCES` (xem `shared/lib/permissions.ts`).
 */
export const Dashboard = () => {
  const { year } = useReportYear();
  const [mode, setMode] = useState<Mode>("sheet");
  const hasData = year === FIXTURE_YEAR;

  return (
    <AsxhPage
      title="Trang chủ"
      description={
        mode === "sheet"
          ? `${todayLabel()} · Tổng quan phiếu báo cáo năm ${year}`
          : `Tiến độ nộp của từng đơn vị, năm ${year}`
      }
      actions={
        <>
          <YearSelect />
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => {
              // Bấm lại nút đang chọn thì giữ nguyên, không bỏ chọn.
              if (v === "sheet" || v === "unit") setMode(v);
            }}
            aria-label="Cách xem"
            className="rounded-md bg-accent p-0.5"
          >
            {(
              [
                ["sheet", "Theo phiếu"],
                ["unit", "Theo đơn vị"],
              ] as const
            ).map(([value, label]) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className={cn(
                  "h-8 rounded-[calc(var(--radius)-2px)] px-3 first:rounded-l-[calc(var(--radius)-2px)] last:rounded-r-[calc(var(--radius)-2px)]",
                  "text-muted-foreground hover:bg-transparent hover:text-foreground",
                  "data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-e1"
                )}
              >
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </>
      }
      fill
      className="max-xl:h-auto"
    >
      {mode === "sheet" ? (
        <BySheetView year={year} hasData={hasData} />
      ) : (
        <ByUnitView year={year} hasData={hasData} />
      )}
    </AsxhPage>
  );
};
