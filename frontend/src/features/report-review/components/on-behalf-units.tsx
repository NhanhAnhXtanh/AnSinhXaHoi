import { TriangleAlert, UsersRound } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

import type { ReportDataUnits } from "../api";
import { unitLabel } from "./data-unit-label";

/** Số tên đơn vị hiện thẳng trên dải; còn lại gom vào "và N đơn vị khác". */
const INLINE_NAMES = 3;

/**
 * Dải "Phiếu nhập hộ" phía trên bảng tính của màn Xem phiếu: biểu nào nhập hộ,
 * cho những đơn vị nào; mã đơn vị không có trong danh mục được báo trước vì phê
 * duyệt sẽ bị từ chối.
 */
export function OnBehalfStrip({
  data,
  submitterName,
}: {
  data: ReportDataUnits | undefined;
  submitterName: string;
}) {
  if (!data) return null;
  if (data.sheets.length === 0 && !data.errorMessage) return null;

  return (
    <div className="flex flex-col gap-1.5 border-b bg-info-subtle px-4 py-2 text-sm text-info-text">
      {data.sheets.map((s) => {
        const known = s.units.filter((u) => u.known);
        const unknown = s.units.filter((u) => !u.known);
        const inline = s.units.slice(0, INLINE_NAMES);
        const rest = s.units.length - inline.length;
        return (
          <div key={s.sheetId} className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <UsersRound className="size-4 shrink-0" aria-hidden />
            <span className="font-medium">Phiếu nhập hộ</span>
            <span>
              · {submitterName} nhập biểu {s.templateShortName} cho {s.units.length} đơn vị
              {data.recorded ? " (số liệu đã ghi cho từng đơn vị)" : " (khi duyệt, số liệu ghi cho từng đơn vị)"}:{" "}
              {inline.map((u, i) => (
                <span key={u.budgetCode} className={cn(!u.known && "font-medium text-warning-text")}>
                  {i > 0 && ", "}
                  {unitLabel(u)}
                </span>
              ))}
            </span>
            {rest > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-info-text underline">
                    và {rest} đơn vị khác
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-0">
                  <div className="border-b px-3 py-2 text-sm font-medium">
                    Biểu {s.templateShortName} nhập hộ cho {s.units.length} đơn vị
                  </div>
                  <ol className="max-h-72 list-decimal overflow-y-auto py-2 ps-8 pe-3 text-sm">
                    {s.units.map((u) => (
                      <li key={u.budgetCode} className={cn("py-0.5", !u.known && "text-warning-text")}>
                        {unitLabel(u)}
                        {!u.known && " — không có trong danh mục đơn vị"}
                      </li>
                    ))}
                  </ol>
                </PopoverContent>
              </Popover>
            )}
            {unknown.length > 0 && (
              <span className="flex w-full items-center gap-1.5 text-warning-text">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                {unknown.length === 1 ? "Có 1 mã đơn vị" : `Có ${unknown.length} mã đơn vị`} không có trong
                danh mục ({unknown.map((u) => u.budgetCode).join(", ")}) nên chưa phê duyệt được. Bạn trả lại
                để đơn vị chọn lại đơn vị{known.length > 0 ? " ở các dòng đó" : ""}.
              </span>
            )}
          </div>
        );
      })}
      {data.errorMessage && (
        <div className="flex items-center gap-1.5 text-warning-text">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          Chưa đọc được danh sách đơn vị được nhập hộ: {data.errorMessage}
        </div>
      )}
    </div>
  );
}
