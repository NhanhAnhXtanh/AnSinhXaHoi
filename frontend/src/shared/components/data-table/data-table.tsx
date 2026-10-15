"use client";

import type { HttpError, BaseRecord } from "@refinedev/core";
import { useResourceParams } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Column } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Inbox,
  Loader2,
  ShieldOff,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { cn } from "@/shared/lib/utils";
import { isScopedResource } from "@/shared/api/session";

/**
 * `defaultColumn` for a table that opts into column resizing.
 *
 * TanStack treats resizing as opt-out — `getCanResize()` is
 * `(columnDef.enableResizing ?? true) && (options.enableColumnResizing ?? true)`
 * — so turning the table option on hands a drag handle to every column,
 * including the ones where dragging achieves nothing. This flips the column
 * half of that expression, which makes resizing opt-in: a column becomes
 * draggable by declaring `enableResizing: true`, and only that column does.
 *
 * Pair it with `enableColumnResizing: true` on the table. Without the table
 * option the per-column flag is ANDed away and nothing resizes.
 *
 *     const table = useTable({
 *       columns,
 *       enableColumnResizing: true,
 *       columnResizeMode: "onChange",
 *       defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
 *     });
 */
export const RESIZABLE_COLUMN_DEFAULTS = {
  enableResizing: false,
  minSize: 80,
  maxSize: 900,
};

/**
 * Width for an action column holding `buttons` icon-only `icon-sm` buttons in a
 * `gap-1` row — the minimum that fits them, and nothing more.
 *
 * The arithmetic, so the number is checkable rather than guessed. Every spacing
 * utility here compiles to `calc(var(--spacing) * n)`, so all three terms scale
 * with the density setting:
 *
 *     TableCell `px-3` ->  3 units each side  ->  6 units
 *     `icon-sm`        ->  `size-8`           ->  8 units per button
 *     `gap-1`          ->  1 unit             ->  1 unit per gap
 *
 *     width = unit * (6 + 8n + (n - 1)) = unit * (9n + 5)
 *
 * A column's `size` is a plain number, so it cannot scale with density — and it
 * is the *exact* rendered width whenever the table overflows its card, which is
 * precisely when a column too narrow for its buttons would clip them. So the
 * unit used here is the largest of the three (`spacious`, `0.2875rem` = 4.6px):
 * a width that is safe at every density. Anything smaller clips Delete for
 * anyone who has not left the density on its default.
 *
 * `minSize` comes along because `RESIZABLE_COLUMN_DEFAULTS` floors columns at
 * 80px and `getSize()` clamps to it — without this, a one-button column asks
 * for 56 and silently renders at 80.
 */
export function actionsColumnWidth(buttons: number) {
  const SPACIOUS_UNIT = 4.6;
  // The `+ 1` is not padding for taste — it absorbs subpixel accumulation:
  // each flex item is laid out at a fraction of a pixel and the row rounds up
  // once. Being a pixel generous costs nothing; being a pixel short clips the
  // last button.
  const width = Math.ceil(SPACIOUS_UNIT * (9 * buttons + 5)) + 1;

  return { size: width, minSize: width };
}

type DataTableProps<TData extends BaseRecord> = {
  table: UseTableReturnType<TData, HttpError>;
  /**
   * The filter zone, rendered inside the panel above the header row —
   * `ListToolbar` and the active-filter chips.
   *
   * It is a prop rather than a sibling the page renders above `<DataTable>`
   * because the panel is drawn in here, and a toolbar outside it is a floating
   * control that belongs to nothing: the search narrows *this* table, so it
   * lives on the same sheet as the rows it narrows. One block, three zones
   * divided by hairlines — filters, rows, pager.
   */
  toolbar?: ReactNode;
};

export function DataTable<TData extends BaseRecord>({
  table,
  toolbar,
}: DataTableProps<TData>) {
  const {
    reactTable: { getHeaderGroups, getRowModel, getTotalSize },
    refineCore: {
      tableQuery,
      currentPage,
      setCurrentPage,
      pageCount,
      pageSize,
      setPageSize,
    },
  } = table;

  // Visible, not all: a column hidden from the Columns menu must drop out of
  // the loading skeleton and out of the empty row's `colSpan` too, or the
  // skeleton renders more cells than the header has and the "no data" cell
  // spans past the last column.
  const leafColumns = table.reactTable.getVisibleLeafColumns();
  const isLoading = tableQuery.isLoading;

  // Opt-in per table: `column.getCanResize()` defaults to true in TanStack, so
  // gating on the table option is what keeps tables that never asked for
  // resizing free of drag handles.
  const canResizeColumns = table.reactTable.options.enableColumnResizing === true;
  const columnSizing = table.reactTable.getState().columnSizing;
  const isResizing = Boolean(
    table.reactTable.getState().columnSizingInfo.isResizingColumn
  );

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [isOverflowing, setIsOverflowing] = useState({
    horizontal: false,
    vertical: false,
  });

  useEffect(() => {
    const checkOverflow = () => {
      if (tableRef.current && tableContainerRef.current) {
        const table = tableRef.current;
        const container = tableContainerRef.current;

        const horizontalOverflow = table.offsetWidth > container.clientWidth;
        const verticalOverflow = table.offsetHeight > container.clientHeight;

        setIsOverflowing({
          horizontal: horizontalOverflow,
          vertical: verticalOverflow,
        });
      }
    };

    checkOverflow();

    // Check on window resize
    window.addEventListener("resize", checkOverflow);

    // Check when table data changes
    const timeoutId = setTimeout(checkOverflow, 100);

    return () => {
      window.removeEventListener("resize", checkOverflow);
      clearTimeout(timeoutId);
    };
    // `columnSizing` is in here so a drag that pushes the table past the
    // container re-runs the check — the pinned-column shadows read it.
  }, [tableQuery.data?.data, pageSize, columnSizing]);

  return (
    <div className={cn("flex", "flex-col", "flex-1", "gap-4")}>
      <div
        ref={tableContainerRef}
        className={cn(
          "overflow-hidden",
          "rounded-lg",
          "border",
          "border-border",
          "bg-card",
          "shadow-e1"
        )}
      >
        {toolbar && (
          // `px-3` is the table cell's own padding, so the search field starts
          // on the same vertical line as the first column rather than a few
          // pixels off it. `space-y-3` gives the chips their gap only when
          // there are chips — an empty `DataTableFilterChips` renders no
          // element at all, so nothing spaces against it.
          <div className="space-y-3 border-b border-border px-3 py-3">
            {toolbar}
          </div>
        )}

        <Table
          ref={tableRef}
          // `minWidth` keeps the table filling the card while the columns add
          // up to less than the container; past that the sizes drive the width
          // and the wrapper scrolls horizontally.
          style={{
            tableLayout: "fixed",
            width: canResizeColumns ? getTotalSize() : "100%",
            minWidth: "100%",
          }}
          className={cn(isResizing && "select-none")}
        >
          <TableHeader>
            {getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isPlaceholder = header.isPlaceholder;

                  const sorted = header.column.getIsSorted();

                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                          ? "descending"
                          : header.column.getCanSort()
                          ? "none"
                          : undefined
                      }
                      style={{
                        ...getCommonStyles({
                          column: header.column,
                          isOverflowing: isOverflowing,
                        }),
                      }}
                      className={getPinnedClasses({ column: header.column })}
                    >
                      {isPlaceholder ? null : header.column.getCanSort() ? (
                        // `getToggleSortingHandler` rather than a hand-rolled
                        // `toggleSorting` call: it is what honours the
                        // shift-click multi-sort modifier, and it cycles
                        // asc -> desc -> unsorted rather than trapping the
                        // column in one of two states.
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "group/sort -mx-1 flex max-w-full items-center gap-1",
                            "rounded px-1 py-0.5 text-inherit",
                            // Preflight resets `text-transform` on `button`,
                            // so the header's own `text-overline` stops at the
                            // element boundary and a sortable column comes out
                            // in sentence case beside its unsortable
                            // neighbours. Restate it on the button.
                            "text-overline",
                            "transition-colors hover:text-foreground",
                            "focus-visible:outline-none focus-visible:ring-2",
                            "focus-visible:ring-ring/50",
                            sorted && "text-foreground"
                          )}
                        >
                          <span className="truncate">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </span>
                          <SortIndicator sorted={sorted} />
                        </button>
                      ) : (
                        <div className={cn("flex", "items-center", "gap-1")}>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </div>
                      )}

                      {canResizeColumns && header.column.getCanResize() && (
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize column ${header.column.id}`}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          // The header may itself be clickable (sorting), and
                          // finishing a drag must not count as a click on it.
                          onClick={(event) => event.stopPropagation()}
                          onDoubleClick={() => header.column.resetSize()}
                          className={cn(
                            "absolute inset-y-0 -right-1 z-20 flex w-2 touch-none",
                            "cursor-col-resize select-none items-center justify-center",
                            // Grab area is 8px wide for the pointer; the line
                            // that appears under it is 2px, so the header still
                            // reads as a header when nothing is happening.
                            "after:h-1/2 after:w-0.5 after:rounded-full",
                            "after:bg-transparent after:transition-colors",
                            "hover:after:bg-primary/60",
                            header.column.getIsResizing() &&
                              "after:bg-primary after:h-full"
                          )}
                        />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="relative">
            {isLoading ? (
              <>
                {Array.from({ length: pageSize < 1 ? 1 : pageSize }).map(
                  (_, rowIndex) => (
                    <TableRow
                      key={`skeleton-row-${rowIndex}`}
                      aria-hidden="true"
                      className="group/row"
                    >
                      {leafColumns.map((column) => (
                        <TableCell
                          key={`skeleton-cell-${rowIndex}-${column.id}`}
                          style={{
                            ...getCommonStyles({
                              column,
                              isOverflowing: isOverflowing,
                            }),
                          }}
                          className={cn(
                            "truncate",
                            getPinnedClasses({ column })
                          )}
                        >
                          <div className="h-8" />
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                )}
                <TableRow>
                  <TableCell
                    colSpan={leafColumns.length}
                    className={cn("absolute", "inset-0", "pointer-events-none")}
                  >
                    <Loader2
                      className={cn(
                        "absolute",
                        "top-1/2",
                        "left-1/2",
                        "animate-spin",
                        "text-primary",
                        "h-8",
                        "w-8",
                        "-translate-x-1/2",
                        "-translate-y-1/2"
                      )}
                    />
                  </TableCell>
                </TableRow>
              </>
            ) : getRowModel().rows?.length ? (
              getRowModel().rows.map((row) => {
                return (
                  <TableRow
                    key={row.original?.id ?? row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="group/row"
                  >
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <TableCell
                          key={cell.id}
                          style={{
                            ...getCommonStyles({
                              column: cell.column,
                              isOverflowing: isOverflowing,
                            }),
                          }}
                          className={getPinnedClasses({ column: cell.column })}
                        >
                          {/*
                            `truncate` on the wrapper alone only ellipsises
                            text that is a direct child of it. A cell that
                            stacks two lines — a title over a department, a
                            name over a code — puts its text inside a flex
                            column, and those children overflow the wrapper's
                            `overflow: hidden` and get cut mid-word with no
                            ellipsis to say so. Flex items are blockified, so
                            handing them the same treatment is enough.
                          */}
                          <div className="min-w-0 truncate [&>div]:min-w-0 [&>div>span]:truncate">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <DataTableNoData
                isOverflowing={isOverflowing}
                columnsLength={leafColumns.length}
              />
            )}
          </TableBody>
        </Table>

        {/*
          The pager lives inside the panel, on the panel's own footer surface,
          because it is part of the table rather than a control next to one:
          floating it underneath leaves the card ending in a hard edge and the
          page controls belonging to nothing in particular.
        */}
        {!isLoading && getRowModel().rows?.length > 0 && (
          <div
            data-print="hide"
            className={cn("border-t border-border px-3 py-2")}
          >
            <DataTablePagination
              currentPage={currentPage}
              pageCount={pageCount}
              setCurrentPage={setCurrentPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              total={tableQuery.data?.total}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The mark that says a column can be sorted, and how it is sorted now.
 *
 * It is drawn on *every* sortable column rather than only the active one, and
 * that is the whole reason it exists: a column header that sorts on click and
 * looks exactly like one that does not is a feature nobody finds. Unsorted, it
 * sits at a third opacity — present enough to be an affordance, quiet enough
 * that a row of them is not a row of icons.
 */
function SortIndicator({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") {
    return <ArrowUp className="text-primary size-3 shrink-0" />;
  }
  if (sorted === "desc") {
    return <ArrowDown className="text-primary size-3 shrink-0" />;
  }
  return (
    <ChevronsUpDown
      className={cn(
        "size-3 shrink-0 opacity-35 transition-opacity",
        "group-hover/sort:opacity-80"
      )}
    />
  );
}

function DataTableNoData({
  isOverflowing,
  columnsLength,
}: {
  isOverflowing: { horizontal: boolean; vertical: boolean };
  columnsLength: number;
}) {
  // A narrowed account sees exactly what a system with no data looks like, and
  // has no way to tell the two apart. Saying which it is costs one sentence and
  // saves the support ticket that would otherwise be raised.
  const { resource } = useResourceParams();
  const scoped = isScopedResource(resource?.name);

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={columnsLength}
        className={cn("relative", "text-center")}
        style={{ height: "490px" }}
      >
        <div
          className={cn(
            "absolute",
            "inset-0",
            "flex",
            "flex-col",
            "items-center",
            "justify-center",
            "gap-2",
            "bg-card"
          )}
          style={{
            position: isOverflowing.horizontal ? "sticky" : "absolute",
            left: isOverflowing.horizontal ? "50%" : "50%",
            transform: "translateX(-50%)",
            zIndex: isOverflowing.horizontal ? 2 : 1,
            width: isOverflowing.horizontal ? "fit-content" : "100%",
            minWidth: "300px",
          }}
        >
          {/*
            An empty table with nothing but a sentence in the middle of it
            reads as a page that failed to load. The medallion is what says
            "this rendered, and the answer is none" — and it costs one element.
          */}
          <span
            className={cn(
              "mb-1 flex size-14 items-center justify-center rounded-full",
              "bg-accent text-muted-foreground [&_svg]:size-6"
            )}
          >
            {scoped ? <ShieldOff /> : <Inbox />}
          </span>
          <div className={cn("text-base", "font-semibold", "text-foreground")}>
            {scoped ? "Nothing in your data scope" : "No records yet"}
          </div>
          <div className={cn("max-w-sm", "text-sm", "text-muted-foreground")}>
            {scoped
              ? "You can open this resource, but no rows fall within the scope your roles grant."
              : "This table is empty for the time being."}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function getCommonStyles<TData>({
  column,
  isOverflowing,
}: {
  column: Column<TData>;
  isOverflowing: {
    horizontal: boolean;
    vertical: boolean;
  };
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");

  return {
    // The shadow is the only part gated on the measurement: it says "there is
    // more table behind this", so it should appear only when there is.
    boxShadow:
      isOverflowing.horizontal && isLastLeftPinnedColumn
        ? "-4px 0 4px -4px var(--border) inset"
        : isOverflowing.horizontal && isFirstRightPinnedColumn
        ? "4px 0 4px -4px var(--border) inset"
        : undefined,
    // The anchoring itself is not gated, and that is deliberate.
    // `isOverflowing` is a manual measurement refreshed by a window `resize`
    // listener, the row data and `columnSizing` — so it goes stale on anything
    // that resizes the *container* without resizing the window, collapsing the
    // sidebar being the obvious one. Gating `position` on it means the column
    // silently stops being frozen exactly when the table just got narrower.
    //
    // Sticky positioning costs nothing when there is nothing to scroll: with no
    // overflow the cell never leaves its static position, so this is identical
    // to `relative` until the table is actually wider than its card.
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: 1,
    position: isPinned ? "sticky" : "relative",
    // The frozen cell's background is a class, not a style — see
    // `getPinnedClasses`. An inline background would win over the row's
    // `hover:` and `data-[state=selected]:` rules and leave the frozen column
    // as the one part of the row that does not respond to the pointer.
    borderTopRightRadius:
      isOverflowing.horizontal && isPinned === "right"
        ? "var(--radius)"
        : undefined,
    borderBottomRightRadius:
      isOverflowing.horizontal && isPinned === "right"
        ? "var(--radius)"
        : undefined,
    borderTopLeftRadius:
      isOverflowing.horizontal && isPinned === "left"
        ? "var(--radius)"
        : undefined,
    borderBottomLeftRadius:
      isOverflowing.horizontal && isPinned === "left"
        ? "var(--radius)"
        : undefined,
    width: column.getSize(),
    zIndex: isPinned ? 1 : 0,
  };
}

/**
 * The classes a frozen cell needs in order to read as part of its row.
 *
 * A sticky cell slides over the ones behind it, so it has to be opaque. Two
 * things about *which* opaque, both of which only become visible once a column
 * is actually pinned:
 *
 * - It is `bg-card`, not `bg-background`. The table is drawn inside a `bg-card`
 *   panel and those are different tokens in both modes — `0.105` against `0.18`
 *   lightness in dark — so painting the frozen column in `--background` draws a
 *   stripe down the edge of the table rather than hiding it.
 * - The row's hover and selected colours have to be restated here through
 *   `group/row`. The row paints them on the `<tr>`, which an opaque cell covers,
 *   so without this the frozen column stays pale while the rest of the row
 *   lights up — and the actions are exactly what the pointer is travelling to.
 */
export function getPinnedClasses<TData>({
  column,
}: {
  column: Column<TData>;
}): string | undefined {
  if (!column.getIsPinned()) return undefined;

  return cn(
    "bg-card",
    // A pinned *header* cell has to stay on the header band, or the frozen
    // column shows a white stripe through an otherwise tinted strip.
    "[&[data-slot=table-head]]:bg-surface-subtle",
    "group-hover/row:bg-accent/40",
    "group-data-[state=selected]/row:bg-accent/60"
  );
}

DataTable.displayName = "DataTable";
