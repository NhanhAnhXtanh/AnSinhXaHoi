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
import { ShowButton } from "@/shared/components/buttons/show";
import { Badge } from "@/shared/ui/badge";
import {
  humanizeResource,
  splitPermissionCode,
  type Permission,
} from "@/domains/permission/types";
import { PERMISSION_ACTION_VARIANTS } from "@/shared/lib/status-variants";

/**
 * The permission catalogue, read-only.
 *
 * There is no create, edit or delete here, and not because they were left for
 * later: a permission only means something once an endpoint checks for it, so
 * a row invented from this screen would be one the UI could grant and the API
 * would never honour. New codes arrive in a migration with the code that
 * enforces them. What this screen is for is answering "what can be granted,
 * and what does each of these strings actually allow" without reading the seed
 * data — the question the role form's picker raises and cannot answer in the
 * space it has.
 *
 * The fields the filter offers are exactly the ones `PermissionSpecifications`
 * understands. Anything else would be accepted, ignored by the API, and read
 * to the user as a filter that does nothing.
 */
const ADVANCED_FILTER_FIELDS: AdvancedFilterField[] = [
  { field: "code", label: "Code", type: "text", placeholder: "Any" },
  { field: "name", label: "Name", type: "text", placeholder: "Any" },
  {
    field: "systemPermission",
    label: "System permission",
    type: "select",
    options: [
      { label: "Yes", value: "true" },
      { label: "No", value: "false" },
    ],
  },
];

export const PermissionList = () => {
  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Permission>();

    return [
      columnHelper.accessor("code", {
        id: "code",
        enableResizing: true,
        header: "Code",
        enableSorting: true,
        // The whole point of the row: this exact string is what @PreAuthorize
        // matches and what the access control provider asks for, so it is
        // shown verbatim and in mono rather than prettified.
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: "resource",
        header: "Resource",
        // Derived from the code rather than sent by the API, which is why it
        // does not sort: there is no column behind it to sort on. Sorting by
        // `code` groups by resource anyway, since the resource is its prefix.
        enableSorting: false,
        cell: ({ row }) => {
          const { resource, action } = splitPermissionCode(row.original.code);
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm">{humanizeResource(resource)}</span>
              <Badge
                variant={PERMISSION_ACTION_VARIANTS[action] ?? "outline"}
                className="text-[10px]"
              >
                {action}
              </Badge>
            </div>
          );
        },
        size: 220,
      }),
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Name",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.systemPermission && (
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
        id: "actions",
        header: "Actions",
        // Show only. Edit and delete would be hidden by access control anyway
        // — no `permissions:write` or `permissions:delete` code exists to
        // grant — but the endpoints do not exist either, so they are not
        // offered at all rather than offered and then refused.
        cell: ({ row }) => (
          <div className="flex gap-1">
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
          </div>
        ),
        enableSorting: false,
        ...actionsColumnWidth(1),
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
      <ListViewHeader description="The codes an endpoint checks before it answers. Written by migrations, read here." />
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
