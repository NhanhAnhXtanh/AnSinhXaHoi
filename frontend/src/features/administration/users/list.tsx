import { useCan, useList } from "@refinedev/core";
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
import type { Organization as OrganizationRow } from "@/domains/organization/types";
import type { Department as DepartmentRow } from "@/domains/department/types";
import type { User } from "@/domains/user/types";
import { STATUS_LABELS } from "@/domains/user/types";
import { USER_STATUS_VARIANTS } from "@/shared/lib/status-variants";

/**
 * The fixed half of the filter panel.
 *
 * The status options are written out rather than derived, because the three
 * values are a contract with `UserStatus` on the backend: a value that is not
 * one of them filters to nothing rather than failing loudly. The organization
 * and department filters are built inside the component instead, because their
 * options come from resources this account may not be allowed to read.
 */
const STATIC_FILTER_FIELDS: AdvancedFilterField[] = [
  { field: "id", label: "ID", type: "number", placeholder: "Any" },
  { field: "username", label: "Username", type: "text", placeholder: "Any" },
  { field: "email", label: "Email", type: "text", placeholder: "Any" },
  { field: "fullName", label: "Full name", type: "text", placeholder: "Any" },
  {
    field: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
      { label: "Locked", value: "locked" },
    ],
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

export const UserList = () => {
  // Reading organizations and departments are separate grants from reading
  // users. Asking anyway would spend a request on a guaranteed 403 and raise an
  // error toast on every visit, for a filter that could not be populated either
  // way — so the lookups are gated and the fields drop out below.
  const { data: canReadOrganizations } = useCan({
    resource: "organizations",
    action: "list",
  });
  const { data: canReadDepartments } = useCan({
    resource: "departments",
    action: "list",
  });
  const mayReadOrganizations = canReadOrganizations?.can ?? false;
  const mayReadDepartments = canReadDepartments?.can ?? false;

  const { result: organizationResult } = useList<OrganizationRow>({
    resource: "organizations",
    pagination: { pageSize: 200 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: mayReadOrganizations },
  });

  const { result: departmentResult } = useList<DepartmentRow>({
    resource: "departments",
    pagination: { pageSize: 200 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: mayReadDepartments },
  });

  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<User>();

    return [
      columnHelper.accessor("username", {
        id: "username",
        enableResizing: true,
        header: "Username",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.username}</span>
            <span className="text-muted-foreground text-xs">
              {row.original.email}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("fullName", {
        id: "fullName",
        enableResizing: true,
        header: "Full name",
        enableSorting: true,
      }),
      columnHelper.display({
        id: "placement",
        enableResizing: true,
        header: "Placement",
        // Not sortable: `_sort=organization` is not a property the API accepts,
        // and offering the header would produce a sort that quietly does
        // nothing. Filter by organization or department instead.
        enableSorting: false,
        cell: ({ row }) => {
          const { organization, department } = row.original;
          if (!organization) {
            return <span className="text-muted-foreground text-sm">—</span>;
          }
          return (
            <div className="flex flex-col">
              <span className="text-sm">{organization.name}</span>
              <span className="text-muted-foreground text-xs">
                {department?.name ?? "No department"}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ getValue }) => {
          const status = getValue();
          return (
            <Badge variant={USER_STATUS_VARIANTS[status] ?? "secondary"}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
          );
        },
      }),
      columnHelper.display({
        id: "roles",
        header: "Roles",
        // Not sortable: the value is a collection, and sorting a row by "its
        // roles" has no meaning the API could implement.
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.roles.map((role) => (
              <Badge key={role.id} variant="outline">
                {role.name}
              </Badge>
            ))}
          </div>
        ),
      }),
      columnHelper.accessor("lastLoginAt", {
        id: "lastLoginAt",
        header: "Last sign-in",
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
      ...STATIC_FILTER_FIELDS,
      // Offered only to somebody who may read the resource each filters on. A
      // select with no options is a control that looks broken rather than one
      // that explains itself.
      ...(mayReadOrganizations
        ? [
            {
              field: "organization.id",
              label: "Organization",
              type: "select" as const,
              placeholder: "Any organization",
              options: (organizationResult?.data ?? []).map((item) => ({
                label: item.name,
                value: String(item.id),
              })),
            },
          ]
        : []),
      // Not filtered by the organization filter above it, unlike the picker on
      // the form. This is a search, not a write: narrowing to one department is
      // already narrower than any organization it could belong to, and making
      // the two fields depend on each other would mean a filter that empties
      // itself when an unrelated one is cleared.
      ...(mayReadDepartments
        ? [
            {
              field: "department.id",
              label: "Department",
              type: "select" as const,
              placeholder: "Any department",
              options: (departmentResult?.data ?? []).map((item) => ({
                label: `${item.organization.name} · ${item.name}`,
                value: String(item.id),
              })),
            },
          ]
        : []),
    ],
    [
      mayReadOrganizations,
      mayReadDepartments,
      organizationResult?.data,
      departmentResult?.data,
    ]
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
      <ListViewHeader description="Accounts that can sign in, the roles they hold and where they are placed." />
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
