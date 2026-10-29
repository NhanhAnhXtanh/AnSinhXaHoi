import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";

import { STATUS, type AnnualStatus } from "./api";

/** Một tấm panel: thanh lọc · bảng · phân trang. */
export function ListPanel({
  toolbar,
  children,
  pager,
}: {
  toolbar: ReactNode;
  children: ReactNode;
  pager: ReactNode;
}) {
  return (
    <section className="bg-card text-card-foreground flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-e1">
      <div className="flex flex-wrap items-center gap-2 p-3">{toolbar}</div>
      <div className="min-w-0 border-t">{children}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5">
        {pager}
      </div>
    </section>
  );
}

export type StatusFilter = AnnualStatus | "all";

/** Ô tìm + "Trạng thái" + "Bộ lọc khác" (năm báo cáo) + làm mới (tải lại từ máy chủ). */
export function ListToolbar({
  search,
  onSearch,
  status,
  onStatus,
  year,
  onYear,
  years,
  onRefresh,
  refreshing = false,
}: {
  search: string;
  onSearch: (v: string) => void;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
  year: number | null;
  onYear: (y: number | null) => void;
  years: number[];
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  return (
    <>
      <div className="relative min-w-60 flex-1">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Tìm theo năm hoặc số văn bản…"
          aria-label="Tìm theo năm hoặc số văn bản"
          className="ps-9"
        />
      </div>
      <Select value={status} onValueChange={(v) => onStatus(v as StatusFilter)}>
        <SelectTrigger aria-label="Trạng thái" className="w-56 justify-between">
          <span className="flex min-w-0 items-center gap-1">
            <span className="text-muted-foreground">Trạng thái:</span>
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="all">Tất cả</SelectItem>
          {(Object.keys(STATUS) as AnnualStatus[]).map((k) => (
            <SelectItem key={k} value={k}>
              {STATUS[k].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className={cn(year !== null && "border-primary")}>
            <SlidersHorizontal aria-hidden />
            Bộ lọc khác
            {year !== null && (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[11px] leading-4.5">
                1
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex w-64 flex-col gap-2">
          <Label htmlFor="filter-year">Năm báo cáo</Label>
          <Select
            value={year === null ? "all" : String(year)}
            onValueChange={(v) => onYear(v === "all" ? null : Number(v))}
          >
            <SelectTrigger id="filter-year" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả các năm</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  Năm {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Làm mới"
        title="Làm mới"
        disabled={refreshing}
        onClick={onRefresh}
      >
        <RefreshCw aria-hidden className={cn(refreshing && "animate-spin")} />
      </Button>
    </>
  );
}

const PAGE_SIZES = [10, 20, 50];

/** Cắt trang phía máy; đổi bộ lọc thì về trang 1. */
export function usePaging<T>(rows: T[], resetKey: string) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  useEffect(() => setPage(1), [resetKey, size]);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  const slice = useMemo(
    () => rows.slice((current - 1) * size, current * size),
    [rows, current, size]
  );
  return { page: current, pages, size, setPage, setSize, slice, total: rows.length };
}

export function Pager({
  page,
  pages,
  size,
  total,
  unit,
  setPage,
  setSize,
}: {
  page: number;
  pages: number;
  size: number;
  total: number;
  unit: string;
  setPage: (p: number) => void;
  setSize: (s: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <>
      <p className="text-muted-foreground text-sm">
        {total === 0 ? `Hiển thị 0 ${unit}` : `Hiển thị ${from}–${to} trong ${total} ${unit}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Trang trước"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <Button
            key={p}
            type="button"
            variant={p === page ? "default" : "ghost"}
            size="icon-sm"
            aria-current={p === page ? "page" : undefined}
            onClick={() => setPage(p)}
          >
            {p}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Trang sau"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight aria-hidden />
        </Button>
        <Select value={String(size)} onValueChange={(v) => setSize(Number(v))}>
          <SelectTrigger size="sm" aria-label="Số dòng mỗi trang" className="ms-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s} / trang
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

/** Lọc chung cho danh sách và lịch sử. */
export function matchSubmission(
  s: { year: number; docNo: string; status: AnnualStatus },
  search: string,
  status: StatusFilter,
  year: number | null
): boolean {
  if (status !== "all" && s.status !== status) return false;
  if (year !== null && s.year !== year) return false;
  const q = search.trim().toLocaleLowerCase("vi");
  if (!q) return true;
  return String(s.year).includes(q) || s.docNo.toLocaleLowerCase("vi").includes(q);
}
