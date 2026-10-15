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
import type { Role } from "@/domains/role/types";

const ADVANCED_FILTER_FIELDS: AdvancedFilterField[] = [
  { field: "code", label: "Code", type: "text", placeholder: "Any" },
  { field: "name", label: "Name", type: "text", placeholder: "Any" },
  {
    field: "systemRole",
    label: "System role",
    type: "select",
    options: [
      { label: "Yes", value: "true" },
      { label: "No", value: "false" },
    ],
  },
];

export const RoleList = () => {
  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Role>();

    return [
      columnHelper.accessor("code", {
        id: "code",
        header: "Code",
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue()}</span>
        ),
      }),
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Name",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.systemRole && (
              <Badge variant="secondary" className="text-[10px]">
                System
              </Badge>
            )}
          </div>
        ),
      }),
      columnHelper.accessor("description", {
        id: "description",
        enableResizing: true,
        header: "Description",
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm">
            {getValue() ?? "—"}
          </span>
        ),
      }),
      columnHelper.display({
        id: "permissions",
        header: "Permissions",
        enableSorting: false,
        // The count rather than the codes: a role can grant a dozen, and the
        // full list belongs on the show page where there is room for it.
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.permissions.length}</Badge>
        ),
        size: 120,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-1">
            <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            {/*
              A system role cannot be deleted — the API answers 409 — so the
              button is not offered rather than offered and then refused.
            */}
            {!row.original.systemRole && (
              <DeleteButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            )}
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
      <ListViewHeader description="What each role may do, and which rows it may reach." />
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
