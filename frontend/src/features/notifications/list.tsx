import React, { type ComponentProps } from "react";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { CheckCheckIcon } from "lucide-react";

import {
  DataTable,
  RESIZABLE_COLUMN_DEFAULTS,
} from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import {
  DataTableAdvancedFilter,
  DataTableFilterChips,
  type AdvancedFilterField,
} from "@/shared/components/data-table/data-table-advanced-filter";
import {
  ListToolbar,
  ListView,
  ListViewHeader,
} from "@/shared/components/views/list-view";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useNotifications, type Notification } from "@/shared/hooks/use-notifications";
import { cn } from "@/shared/lib/utils";
import { formatDateTime } from "@/shared/lib/format";

/**
 * Everything this account has been told, as a table.
 *
 * A resource with only a list and a delete, deliberately. There is no create
 * screen because a person does not write a notification — the application
 * raises one, in the same transaction as whatever warranted it — and no edit
 * screen because the only mutation a recipient may make is marking one read,
 * which is a button rather than a form.
 *
 * Every row belongs to the signed-in account. That is not a filter this page
 * applies; the API has no way to return anybody else's.
 */

const ADVANCED_FILTER_FIELDS: AdvancedFilterField[] = [
  { field: "title", label: "Title", type: "text", placeholder: "Any" },
  {
    field: "level",
    label: "Level",
    type: "select",
    options: [
      { label: "Info", value: "INFO" },
      { label: "Success", value: "SUCCESS" },
      { label: "Warning", value: "WARNING" },
      { label: "Error", value: "ERROR" },
    ],
  },
  {
    field: "read",
    label: "Status",
    type: "select",
    options: [
      { label: "Unread", value: "false" },
      { label: "Read", value: "true" },
    ],
  },
];

/**
 * The level maps onto the badge's own status family rather than a hand-mixed
 * wash. `bg-info/10` and friends are an alpha over whatever is behind them, so
 * the same chip came out one colour on a card and another on a hovered row;
 * the subtle tokens are opaque and tuned against the surface they land on.
 */
const LEVEL_VARIANT: Record<
  Notification["level"],
  ComponentProps<typeof Badge>["variant"]
> = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "destructive",
};

export const NotificationList = () => {
  // Shares the bell's hook, so marking one read here updates the badge without
  // either component knowing the other exists.
  const { markRead, markAllRead, unreadCount, refresh } = useNotifications();

  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Notification>();

    return [
      columnHelper.accessor("level", {
        id: "level",
        header: "Level",
        enableSorting: true,
        cell: ({ getValue }) => {
          const level = getValue();
          return (
            <Badge variant={LEVEL_VARIANT[level]} dot>
              {level.charAt(0) + level.slice(1).toLowerCase()}
            </Badge>
          );
        },
        size: 120,
      }),
      columnHelper.accessor("title", {
        id: "title",
        enableResizing: true,
        header: "Title",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className={cn("text-sm", !row.original.read && "font-semibold")}>
              {row.original.title}
            </span>
            {row.original.body && (
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {row.original.body}
              </span>
            )}
          </div>
        ),
      }),
      columnHelper.accessor("createdAt", {
        id: "createdAt",
        header: "Received",
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(getValue())}
          </span>
        ),
        size: 200,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        enableSorting: false,
        // Not `actionsColumnWidth(2)`: that formula is for icon-only buttons,
        // and "Mark read" keeps its label. It is not a CRUD icon whose meaning
        // a tooltip can carry — it is the only thing a recipient may change
        // about a notification — so the label stays and the column is sized to
        // it: the outline button (~110px with its icon, gap and border at the
        // widest density) plus a gap, the delete button and the cell padding.
        size: 176,
        minSize: 176,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {!row.original.read && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => void markRead(row.original.id)}
              >
                <CheckCheckIcon className="size-3.5" />
                Mark read
              </Button>
            )}
            <DeleteButton recordItemId={row.original.id} iconOnly size="icon-sm" />
          </div>
        ),
      }),
    ];
  }, [markRead]);

  const table = useTable<Notification>({
    columns,
    // Drag the divider in the header to resize; double-click it to go back to
    // the column's default width.
    // Resizing is opt-in per column: `RESIZABLE_COLUMN_DEFAULTS` turns it off
    // by default and a column asks for a handle with `enableResizing: true`.
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    // The row's actions are the cell somebody scrolls sideways *in order to*
    // reach, so they are the one cell that must not be what scrolls away.
    // `getCommonStyles` in `data-table.tsx` renders a pinned column sticky, but
    // only ever reads pinning state and never sets it, so a column stays where
    // it was declared until a table asks for this.
    //
    // Sticky positioning costs nothing while the table fits its card — the cell
    // never leaves its static position — so this is unconditional rather than
    // switched on once the table is measured to overflow.
    initialState: {
      columnPinning: { right: ["actions"] },
    },
    refineCoreProps: {
      syncWithLocation: true,
    },
  });

  // The table is Refine's and the bell's counts are react-query state it knows
  // nothing about, so deleting a row here would otherwise leave the badge
  // counting something that is gone. Rather than widen the shared
  // `DeleteButton` with a success callback, this keys off the table's own
  // query: whenever its rows change — a delete, a filter, a page — the counts
  // are re-read. They are one cheap `count`, and the "Mark all read (N)" button
  // on this very page is a reason to want them accurate anyway.
  const rowsUpdatedAt = table.refineCore.tableQuery.dataUpdatedAt;
  React.useEffect(() => {
    refresh();
  }, [rowsUpdatedAt, refresh]);

  return (
    <ListView>
      <ListViewHeader description="Everything this account has been told. Nothing here was written by hand — the application raises it." />
      <DataTable
        table={table}
        toolbar={
          <>
            <ListToolbar
              table={table}
              search={<DataTableQuickFilter table={table} />}
              filters={
                <DataTableAdvancedFilter
                  table={table}
                  fields={ADVANCED_FILTER_FIELDS}
                />
              }
              actions={
                unreadCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => void markAllRead()}
                    className="gap-1.5"
                  >
                    <CheckCheckIcon className="size-4" />
                    Mark all read ({unreadCount})
                  </Button>
                )
              }
            />
            <DataTableFilterChips
              table={table}
              fields={ADVANCED_FILTER_FIELDS}
            />
          </>
        }
      />
    </ListView>
  );
};
