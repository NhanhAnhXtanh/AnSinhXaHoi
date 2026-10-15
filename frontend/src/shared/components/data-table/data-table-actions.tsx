"use client";

import { useState } from "react";
import type { BaseRecord, HttpError } from "@refinedev/core";
import { useExport, useResourceParams } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Column } from "@tanstack/react-table";
import {
  Columns3Icon,
  DownloadIcon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

/* --------------------------------------------------------------------------
   Refresh
   -------------------------------------------------------------------------- */

/**
 * Re-read the current page.
 *
 * Deliberately not the `RefreshButton` the detail screens use: that one is
 * built on `useRefreshButton`, which invalidates a *record* and needs an id. A
 * list has no id — what it has is a query with the current filters, sorters and
 * page already in it, so refetching that query is the whole operation.
 *
 * It spins on `isFetching` rather than `isLoading`, because `isLoading` is only
 * true on the very first fetch: a refresh of data already on screen would
 * otherwise give no sign it had happened at all.
 */
export function DataTableRefresh<TData extends BaseRecord>({
  table,
  className,
}: {
  table: UseTableReturnType<TData, HttpError>;
  className?: string;
}) {
  const { tableQuery } = table.refineCore;
  const isFetching = tableQuery.isFetching;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Refresh"
          disabled={isFetching}
          onClick={() => void tableQuery.refetch()}
          className={className}
        >
          <RefreshCwIcon className={cn(isFetching && "animate-spin")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Refresh</TooltipContent>
    </Tooltip>
  );
}

/* --------------------------------------------------------------------------
   Column visibility
   -------------------------------------------------------------------------- */

/** The header text, when it is a plain string — otherwise the column's id. */
function columnLabel<TData>(column: Column<TData, unknown>) {
  const header = column.columnDef.header;
  if (typeof header === "string" && header.trim()) return header;
  return column.id;
}

/**
 * Show and hide columns.
 *
 * The actions column is excluded on purpose. It is not data — it is how a row
 * is opened and deleted — so hiding it takes the screen's controls away and
 * leaves nothing to say where they went.
 */
export function DataTableColumnToggle<TData extends BaseRecord>({
  table,
  className,
}: {
  table: UseTableReturnType<TData, HttpError>;
  className?: string;
}) {
  const columns = table.reactTable
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() && column.id !== "actions");

  if (columns.length === 0) return null;

  const hidden = columns.filter((column) => !column.getIsVisible()).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className={className}>
          <Columns3Icon />
          Columns
          {hidden > 0 && (
            <span className="text-muted-foreground tabular-nums">
              ({columns.length - hidden}/{columns.length})
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-52 overflow-y-auto">
        <DropdownMenuLabel>Columns shown</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            // Radix closes on select by default, which would mean reopening the
            // menu for every column somebody wants to turn off.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(value) => column.toggleVisibility(!!value)}
          >
            <span className="truncate">{columnLabel(column)}</span>
          </DropdownMenuCheckboxItem>
        ))}
        {hidden > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                columns.forEach((column) => column.toggleVisibility(true))
              }
            >
              Show all
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* --------------------------------------------------------------------------
   Export
   -------------------------------------------------------------------------- */

/**
 * A cell as one CSV field.
 *
 * A list cell is often an object — an assignee, a department, a category — and
 * `String(value)` on one of those writes `[object Object]` into the file, which
 * is worse than leaving the column out. So a summary object is reduced to the
 * one field a person would have read on screen, and anything genuinely
 * structured falls back to JSON rather than to nonsense.
 */
function toField(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["fullName", "name", "title", "code", "username"]) {
      if (typeof record[key] === "string") return record[key] as string;
    }
    if (Array.isArray(value)) return value.map(toField).join("; ");
    return JSON.stringify(value);
  }
  return String(value);
}

/** RFC 4180: quote the field and double any quote inside it. */
function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row.map((field) => `"${field.replace(/"/g, '""')}"`).join(",")
    )
    .join("\r\n");
}

function download(filename: string, csv: string) {
  // The BOM is what makes Excel open a UTF-8 CSV as UTF-8 rather than as the
  // system codepage — without it every accented name arrives mojibake.
  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export the table.
 *
 * Two items, because they answer different questions and only one of them is
 * cheap. **This page** is the rows already in the browser and needs no request:
 * the columns are the ones currently shown, in the order they are shown, so
 * hiding a column from the Columns menu takes it out of the file too. **All
 * rows** goes back to the API through refine's `useExport`, page by page,
 * carrying the current filters and sorters so the file matches the table
 * rather than the whole resource.
 *
 * Both write the *stored* value rather than the rendered one — `2024-03-04`
 * rather than "Mar 4, 2024", `active` rather than "Active". A CSV is opened in
 * a spreadsheet, where a real date sorts and a formatted one is a string.
 *
 * A row-level scope still applies to the second one: the export reads through
 * the same endpoint, so it can only ever contain rows the caller may read.
 */
export function DataTableExport<TData extends BaseRecord>({
  table,
  className,
}: {
  table: UseTableReturnType<TData, HttpError>;
  className?: string;
}) {
  const { resource, identifier } = useResourceParams();
  const name = identifier ?? resource?.name ?? "export";
  const { filters, sorters } = table.refineCore;
  const [open, setOpen] = useState(false);

  const { triggerExport, isLoading } = useExport<TData>({
    resource: resource?.name,
    filters,
    sorters,
    // `download` and `useBom` both default to true, which is what writes the
    // file and what makes Excel read it back as UTF-8.
    filename: name,
    // `_can` is the row-level flag object the API stamps on each row so the
    // UI knows which buttons to offer. It is plumbing, and in a spreadsheet it
    // is a column of `[object Object]`.
    mapData: (record) => {
      const fields: Record<string, unknown> = { ...record };
      delete fields._can;
      return fields;
    },
  });

  const exportPage = () => {
    const columns = table.reactTable
      .getVisibleLeafColumns()
      .filter((column) => column.id !== "actions" && column.accessorFn);

    const head = columns.map((column) => columnLabel(column));
    const body = table.reactTable
      .getRowModel()
      .rows.map((row) =>
        columns.map((column) => toField(row.getValue(column.id)))
      );

    download(`${name}-page.csv`, toCsv([head, ...body]));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className={className}>
          {isLoading ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <DownloadIcon />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Download as CSV</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={exportPage}>
          <span className="flex flex-col">
            <span>This page</span>
            <span className="text-muted-foreground text-xs">
              The rows and columns on screen
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isLoading}
          onSelect={() => void triggerExport()}
        >
          <span className="flex flex-col">
            <span>All rows</span>
            <span className="text-muted-foreground text-xs">
              Every match for the current filters
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

DataTableRefresh.displayName = "DataTableRefresh";
DataTableColumnToggle.displayName = "DataTableColumnToggle";
DataTableExport.displayName = "DataTableExport";
