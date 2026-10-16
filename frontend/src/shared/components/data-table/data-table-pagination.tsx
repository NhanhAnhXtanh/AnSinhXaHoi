"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useId, useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

type DataTablePaginationProps = {
  currentPage: number;
  pageCount: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  total?: number;
};

export function DataTablePagination({
  currentPage,
  pageCount,
  setCurrentPage,
  pageSize,
  setPageSize,
  total,
}: DataTablePaginationProps) {
  const pageSizeLabelId = useId();

  const pageSizeOptions = useMemo(() => {
    const baseOptions = [10, 20, 30, 40, 50];
    const optionsSet = new Set(baseOptions);

    if (!optionsSet.has(pageSize)) {
      optionsSet.add(pageSize);
    }

    return Array.from(optionsSet).sort((a, b) => a - b);
  }, [pageSize]);

  return (
    <div
      className={cn(
        "flex",
        "items-center",
        "justify-between",
        "flex-wrap",
        "w-full",
        "gap-2"
      )}
    >
      {/*
        The range, not the count. "137 dòng" leaves somebody on page four
        working out which rows they are looking at; "Hiển thị 61–80 trong 137"
        answers it, and it is the same two numbers the table already holds.
        Numbers take the Vietnamese thousands dot (1.234), like every figure
        elsewhere on screen.

        The last page is short, so the upper bound is clamped to the total
        rather than computed from the page size — otherwise the final page of
        137 rows claims to be showing up to 140.
      */}
      <div
        className={cn(
          "flex-1",
          "text-sm",
          "text-muted-foreground",
          "tabular-nums",
          "whitespace-nowrap"
        )}
      >
        {typeof total === "number" ? (
          total === 0 ? (
            "Không có dòng nào"
          ) : (
            <>
              Hiển thị{" "}
              <span className="text-foreground font-medium">
                {formatCount((currentPage - 1) * pageSize + 1)}&ndash;
                {formatCount(Math.min(currentPage * pageSize, total))}
              </span>{" "}
              trong{" "}
              <span className="text-foreground font-medium">
                {formatCount(total)}
              </span>
            </>
          )
        ) : null}
      </div>
      <div className={cn("flex", "items-center", "flex-wrap", "gap-2")}>
        <div className={cn("flex", "items-center", "gap-2")}>
          <span
            id={pageSizeLabelId}
            className={cn("text-sm", "text-muted-foreground")}
          >
            Số dòng
          </span>
          <Select
            value={`${pageSize}`}
            onValueChange={(v) => setPageSize(Number(v))}
          >
            <SelectTrigger
              aria-labelledby={pageSizeLabelId}
              className={cn("h-8", "w-[70px]")}
            >
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={cn("flex", "items-center", "flex-wrap", "gap-2")}>
          <div
            className={cn(
              "flex",
              "items-center",
              "justify-center",
              "text-sm",
              "font-medium",
              "tabular-nums",
              "whitespace-nowrap"
            )}
          >
            Trang {formatCount(currentPage)} / {formatCount(pageCount)}
          </div>
          <div className={cn("flex", "items-center", "gap-2")}>
            <Button
              variant="outline"
              size="icon-sm"
              className={cn("hidden", "lg:flex")}
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              aria-label="Trang đầu"
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Trang trước"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === pageCount}
              aria-label="Trang sau"
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className={cn("hidden", "lg:flex")}
              onClick={() => setCurrentPage(pageCount)}
              disabled={currentPage === pageCount}
              aria-label="Trang cuối"
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 1234 -> "1.234": the thousands dot used for every number on screen. */
function formatCount(value: number) {
  return value.toLocaleString("vi-VN");
}

DataTablePagination.displayName = "DataTablePagination";
