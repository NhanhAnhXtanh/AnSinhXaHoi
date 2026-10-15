import * as React from "react";

import { cn } from "@/shared/lib/utils";

/**
 * The data table's primitives.
 *
 * Two conventions here are the whole difference between a business table and
 * a styled `<table>`:
 *
 * **The header is a label, not a heading.** `text-overline` — 11px, uppercase,
 * semibold, tracked out — on `--surface-subtle`, one step off the card. It is
 * deliberately quieter than the data underneath it, because in a table of
 * forty rows the column names are read once and the values are read forty
 * times, and the band is what keeps the labels from being mistaken for a first
 * row of data once the table is scrolled.
 *
 * The tint belongs to the header band and to nothing else around it: the
 * filter zone above it and the pager below it sit on the card itself, so the
 * panel reads as one sheet with one strip across it rather than three stacked
 * blocks.
 *
 * **Rows have a fixed height, not a padded one.** `h-12` on the cell rather
 * than vertical padding alone means a row with a chip in it is exactly as tall
 * as a row with plain text, so the eye can track across the table without the
 * baseline moving. Both heights are `calc(var(--spacing) * n)`, so they follow
 * the density setting like everything else.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="scrollbar-fade relative w-full max-w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom border-collapse text-sm",
          className
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({
  className,
  sticky,
  ...props
}: React.ComponentProps<"thead"> & {
  /**
   * Pin the header while the body scrolls. Only useful inside a container that
   * scrolls vertically — in a page-scrolled table it pins to nothing.
   */
  sticky?: boolean;
}) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b [&_tr]:border-border [&_tr:hover]:bg-transparent",
        sticky && "sticky top-0 z-10",
        className
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-surface-subtle border-t border-border font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border transition-colors",
        "hover:bg-accent/40 data-[state=selected]:bg-accent/60",
        className
      )}
      {...props}
    />
  );
}

/**
 * Column alignment. `right` also switches on tabular figures, because the only
 * reason to right-align a column is that it holds numbers meant to line up.
 */
const ALIGN: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right tabular-nums",
};

function TableHead({
  className,
  align = "left",
  ...props
}: Omit<React.ComponentProps<"th">, "align"> & {
  align?: "left" | "center" | "right";
}) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-overline text-muted-foreground bg-surface-subtle",
        "h-11 px-3 align-middle whitespace-nowrap",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        ALIGN[align],
        className
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  align = "left",
  ...props
}: Omit<React.ComponentProps<"td">, "align"> & {
  align?: "left" | "center" | "right";
}) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-12 px-3 py-2 align-middle whitespace-nowrap",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        ALIGN[align],
        className
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-3 text-xs", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
