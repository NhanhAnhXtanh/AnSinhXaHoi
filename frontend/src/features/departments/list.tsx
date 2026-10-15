import { useCan, useList } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import React from "react";
import { Link } from "react-router";

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
import type { Department } from "@/domains/department/types";
import { STATUS_LABELS, STATUS_OPTIONS } from "@/domains/department/types";
import { DEPARTMENT_STATUS_VARIANTS } from "@/shared/lib/status-variants";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const DepartmentList = () => {
  // Reading organizations is a separate grant from reading departments, so a
  // role can hold one without the other. Asking anyway would spend a request on
  // a guaranteed 403 and raise an error toast on every visit, for a filter that
  // could not be populated either way — so the lookup is gated and the filter
  // field drops out below.
  const { data: canReadOrganizations } = useCan({
    resource: "organizations",
    action: "list",
  });
  const mayReadOrganizations = canReadOrganizations?.can ?? false;

  // Every organization, for the options of the organization filter. The rows
  // themselves do not need this: each department already carries its own.
  const {
    result: { data: organizations },
    query: { isLoading: organizationsLoading },
  } = useList<Organization>({
    resource: "organizations",
    pagination: { currentPage: 1, pageSize: 999 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: mayReadOrganizations },
  });

  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Department>();

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
      columnHelper.accessor("organization.name", {
        id: "organization",
        enableResizing: true,
        header: "Organization",
        // Not sortable: `_sort=organization` is not a property the API accepts,
        // and offering the header would produce a sort that quietly does
        // nothing. Filter by organization instead.
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to={`/organizations/show/${row.original.organization.id}`}
            className="text-sm hover:underline"
          >
            {row.original.organization.name}
          </Link>
        ),
      }),
      columnHelper.display({
        id: "contact",
        enableResizing: true,
        header: "Contact",
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
            <Badge variant={DEPARTMENT_STATUS_VARIANTS[status] ?? "secondary"}>
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

  const advancedFilterFields = React.useMemo<AdvancedFilterField[]>(
    () => [
      { field: "id", label: "ID", type: "number", placeholder: "Any" },
      { field: "code", label: "Code", type: "text", placeholder: "Any" },
      { field: "name", label: "Name", type: "text", placeholder: "Any" },
      { field: "email", label: "Email", type: "text", placeholder: "Any" },
      {
        field: "status",
        label: "Status",
        type: "select",
        placeholder: "Any status",
        options: STATUS_OPTIONS,
      },
      // Offered only to somebody who may read the resource it filters on. A
      // select with no options is a control that looks broken rather than one
      // that explains itself.
      ...(mayReadOrganizations
        ? [
            {
              field: "organization.id",
              label: "Organization",
              type: "select" as const,
              placeholder: organizationsLoading
                ? "Loading..."
                : "Any organization",
              options:
                organizations?.map((item) => ({
                  label: item.name,
                  value: String(item.id),
                })) ?? [],
            },
          ]
        : []),
    ],
    [organizations, organizationsLoading, mayReadOrganizations]
  );

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
      <ListViewHeader description="Teams inside an organization. A user and a task are each placed in one." />
      <DataTable
        table={table}
        toolbar={
          <>
            <ListToolbar
              table={table}
              search={<DataTableQuickFilter table={table} />}
              filters={<DataTableAdvancedFilter table={table} fields={advancedFilterFields} />}
            />
            <DataTableFilterChips table={table} fields={advancedFilterFields} />
          </>
        }
      />
    </ListView>
  );
};
