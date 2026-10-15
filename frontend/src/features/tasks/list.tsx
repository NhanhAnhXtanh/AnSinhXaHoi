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
import type { Department as DepartmentRow } from "@/domains/department/types";
import type { User as UserRow } from "@/domains/user/types";
import type { Task } from "@/domains/task/types";
import {
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  STATUS_LABELS,
  STATUS_OPTIONS,
} from "@/domains/task/types";
import { TASK_PRIORITY_VARIANTS, TASK_STATUS_VARIANTS } from "@/shared/lib/status-variants";

const STATIC_FILTER_FIELDS: AdvancedFilterField[] = [
  { field: "id", label: "ID", type: "number", placeholder: "Any" },
  { field: "title", label: "Title", type: "text", placeholder: "Any" },
  {
    field: "status",
    label: "Status",
    type: "select",
    placeholder: "Any status",
    options: STATUS_OPTIONS,
  },
  {
    field: "priority",
    label: "Priority",
    type: "select",
    placeholder: "Any priority",
    options: PRIORITY_OPTIONS,
  },
  {
    field: "dueDate",
    label: "Due date",
    type: "text",
    // The backend reads `_gte`/`_lte` as real bounds on the date column.
    operators: ["gte", "lte", "eq"],
    defaultOperator: "lte",
    placeholder: "2026-12-31",
    hint: "An ISO date (YYYY-MM-DD).",
  },
  {
    // Not a column: "is this late?" is two conditions plus today's date, which
    // the server resolves so the answer cannot depend on a browser clock.
    field: "overdue",
    label: "Overdue",
    type: "select",
    operators: ["eq"],
    placeholder: "Any",
    options: [
      { label: "Overdue only", value: "true" },
      { label: "Not overdue", value: "false" },
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

export const TaskList = () => {
  // Reading users and departments are separate grants from reading tasks, so a
  // role can hold one without the others. Asking anyway would spend a request
  // on a guaranteed 403 and raise an error toast on every visit, for a filter
  // that could not be populated either way.
  const { data: canReadUsers } = useCan({ resource: "users", action: "list" });
  const { data: canReadDepartments } = useCan({
    resource: "departments",
    action: "list",
  });
  const mayReadUsers = canReadUsers?.can ?? false;
  const mayReadDepartments = canReadDepartments?.can ?? false;

  const { result: userResult } = useList<UserRow>({
    resource: "users",
    pagination: { pageSize: 200 },
    sorters: [{ field: "fullName", order: "asc" }],
    queryOptions: { enabled: mayReadUsers },
  });

  const { result: departmentResult } = useList<DepartmentRow>({
    resource: "departments",
    pagination: { pageSize: 200 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: mayReadDepartments },
  });

  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Task>();

    return [
      columnHelper.accessor("title", {
        id: "title",
        enableResizing: true,
        header: "Task",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.title}</span>
            {row.original.department ? (
              <span className="text-muted-foreground text-xs">
                {row.original.department.name}
              </span>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        id: "status",
        // Not sortable: the column stores the enum name, so ordering by it
        // orders alphabetically. The API leaves it out of its sort list for the
        // same reason, and offering the header would produce a sort that looks
        // like it worked.
        enableSorting: false,
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue();
          return (
            <Badge variant={TASK_STATUS_VARIANTS[status] ?? "secondary"}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
          );
        },
      }),
      columnHelper.accessor("priority", {
        id: "priority",
        // Same reason as status, and more visibly wrong: alphabetical order on
        // priority is HIGH, LOW, MEDIUM, URGENT.
        enableSorting: false,
        header: "Priority",
        cell: ({ getValue }) => {
          const priority = getValue();
          return (
            <Badge variant={TASK_PRIORITY_VARIANTS[priority] ?? "secondary"}>
              {PRIORITY_LABELS[priority] ?? priority}
            </Badge>
          );
        },
      }),
      columnHelper.display({
        id: "assignee",
        enableResizing: true,
        header: "Assignee",
        enableSorting: false,
        cell: ({ row }) => {
          const assignee = row.original.assignee;
          if (!assignee) {
            return (
              <span className="text-muted-foreground text-sm">Unassigned</span>
            );
          }
          return (
            <Link
              to={`/users/show/${assignee.id}`}
              className="text-sm hover:underline"
            >
              {assignee.fullName}
            </Link>
          );
        },
      }),
      columnHelper.accessor("dueDate", {
        id: "dueDate",
        header: "Due",
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className={
              row.original.overdue
                ? "text-destructive text-sm font-medium"
                : "text-muted-foreground text-sm"
            }
          >
            {formatDate(row.original.dueDate)}
            {row.original.overdue ? " · late" : ""}
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
      ...(mayReadUsers
        ? [
            {
              field: "assignee.id",
              label: "Assignee",
              type: "select" as const,
              placeholder: "Anyone",
              options: (userResult?.data ?? []).map((item) => ({
                label: item.fullName,
                value: String(item.id),
              })),
            },
          ]
        : []),
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
    [mayReadUsers, mayReadDepartments, userResult?.data, departmentResult?.data]
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
      <ListViewHeader description="Work assigned to people and departments. Anything past its due date is marked late." />
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
