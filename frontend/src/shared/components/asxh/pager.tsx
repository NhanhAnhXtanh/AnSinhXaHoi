import { ChevronLeft, ChevronRight, Ellipsis } from "lucide-react";

import { formatNumber } from "./format";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";

const PAGE_SIZES = [10, 20, 50];

/** Dãy số trang gọn: 1 … 4 5 6 … 12. */
function pageList(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/** Chân panel bảng: "Hiển thị 1–10 trong 12 phiếu" · trang · số dòng mỗi trang. */
export function Pager({
  page,
  pageSize,
  total,
  unit = "phiếu",
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  unit?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3">
      <p className="text-muted-foreground text-sm">
        {total === 0
          ? `Hiển thị 0 ${unit}`
          : `Hiển thị ${formatNumber(from)}–${formatNumber(to)} trong ${formatNumber(total)} ${unit}`}
      </p>

      {total > 0 && (
        <div className="flex items-center gap-4 sm:ms-auto">
          <nav aria-label="Phân trang" className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Trang trước"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft />
            </Button>
            {pageList(page, pageCount).map((p, i) =>
              p === "gap" ? (
                <span
                  key={`gap-${i}`}
                  aria-hidden
                  className="text-muted-foreground flex w-8 justify-center"
                >
                  <Ellipsis className="size-4" />
                </span>
              ) : (
                <Button
                  key={p}
                  type="button"
                  variant={p === page ? "default" : "ghost"}
                  size="icon-sm"
                  aria-current={p === page ? "page" : undefined}
                  className={cn("tabular-nums", p !== page && "text-muted-foreground")}
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Trang sau"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight />
            </Button>
          </nav>

          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger size="sm" className="w-32" aria-label="Số dòng mỗi trang">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s} / trang
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
