"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

export type DataTableSorterProps<TData> = {
  column: Column<TData>;
} & React.ComponentProps<typeof Button>;

export function DataTableSorter<TData>({
  column,
  className,
  ...props
}: DataTableSorterProps<TData>) {
  // The column's id is an internal field name, so the label talks about the
  // order rather than naming the field.
  const title =
    column.getIsSorted() === "desc"
      ? "Đang xếp giảm dần — bấm để đổi"
      : column.getIsSorted() === "asc"
      ? "Đang xếp tăng dần — bấm để đổi"
      : "Sắp xếp theo cột này";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => column.toggleSorting(undefined, true)}
      title={title}
      aria-label={title}
      {...props}
      className={cn("data-[state=open]:bg-accent", "w-5 h-5", className)}
    >
      {column.getIsSorted() === "desc" ? (
        <ArrowDown className={cn("text-primary", "!w-3", "!h-3")} />
      ) : column.getIsSorted() === "asc" ? (
        <ArrowUp className={cn("text-primary", "!w-3", "!h-3")} />
      ) : (
        <ChevronsUpDown
          className={cn("text-muted-foreground", "!w-3", "!h-3")}
        />
      )}
    </Button>
  );
}

DataTableSorter.displayName = "DataTableSorter";
