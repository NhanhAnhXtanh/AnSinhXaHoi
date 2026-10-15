import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import React from "react";

import {
  actionsColumnWidth,
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
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { Badge } from "@/shared/ui/badge";
import type { Organization } from "@/domains/organization/types";
import { STATUS_LABELS, STATUS_OPTIONS } from "@/domains/organization/types";
import { ORGANIZATION_STATUS_VARIANTS } from "@/shared/lib/status-variants";

/**
 * Every field here is one `OrganizationSpecifications` handles on the backend.
 * An unknown one would be ignored rather than rejected, which reads as a filter
 * that quietly does nothing — worse than not offering it.
 */
const ADVANCED_FILTER_FIELDS: AdvancedFilterField[] = [
  { field: "id", label: "ID", type: "number", placeholder: "Any" },
  { field: "code", label: "Code", type: "text", placeholder: "Any" },
  { field: "name", label: "Name", type: "text", placeholder: "Any" },
  { field: "email", label: "Email", type: "text", placeholder: "Any" },
  {
    field: "status",
    label: "Status",
    type: "select",
    options: STATUS_OPTIONS,
  },
];

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const OrganizationList = () => {
  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Organization>();

    return [
      columnHelper.accessor("code", {
        id: "code",
        header: "Code",
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-medium">{getValue()}</span>
        ),
      }),
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Name",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {row.original.description ? (
              <span className="text-muted-foreground line-clamp-1 text-xs">
                {row.original.description}
              </span>
            ) : null}
          </div>
        ),
      }),
      columnHelper.display({
        id: "contact",
        enableResizing: true,
        header: "Contact",
        // Not sortable: two fields rendered as one cell, and the API sorts by
        // properties rather than by whatever this happens to concatenate.
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-col text-sm">
            <span>{row.original.email ?? "—"}</span>
            <span className="text-muted-foreground text-xs">
              {row.original.phone ?? "—"}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ getValue }) => {
          const status = getValue();
          return (
            <Badge variant={ORGANIZATION_STATUS_VARIANTS[status] ?? "secondary"}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
          );
        },
      }),
      columnHelper.accessor("createdAt", {
        id: "createdAt",
        header: "Created",
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm">
            {formatDate(getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-1">
            <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            <DeleteButton recordItemId={row.original.id} iconOnly size="icon-sm" />
          </div>
        ),
        enableSorting: false,
        ...actionsColumnWidth(3),
      }),
    ];
  }, []);

  const table = useTable({
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

  return (
    <ListView>
      <ListViewHeader description="The bodies that accounts, departments and work belong to." />
      <DataTable
        table={table}
        toolbar={
          <>
            <ListToolbar
              table={table}
              search={<DataTableQuickFilter table={table} />}
              filters={<DataTableAdvancedFilter table={table} fields={ADVANCED_FILTER_FIELDS} />}
            />
            <DataTableFilterChips table={table} fields={ADVANCED_FILTER_FIELDS} />
          </>
        }
      />
    </ListView>
  );
};
