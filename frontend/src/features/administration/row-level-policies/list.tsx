import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { TriangleAlert } from "lucide-react";
import React from "react";

import {
  DataTableAdvancedFilter,
  DataTableFilterChips,
  type AdvancedFilterField,
} from "@/shared/components/data-table/data-table-advanced-filter";
import {
  actionsColumnWidth,
  DataTable,
  RESIZABLE_COLUMN_DEFAULTS,
} from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import {
  ListToolbar,
  ListView,
  ListViewHeader,
} from "@/shared/components/views/list-view";
import { Badge } from "@/shared/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { CoverageMatrix } from "./coverage-matrix";
import { ACTIONS, type RowLevelPolicy } from "@/domains/row-level-policy/types";

const ADVANCED_FILTER_FIELDS: AdvancedFilterField[] = [
  { field: "resource", label: "Resource", type: "text", placeholder: "Any" },
  {
    field: "action",
    label: "Action",
    type: "select",
    options: ACTIONS.map((action) => ({ label: action, value: action })),
  },
  {
    field: "kind",
    label: "Kind",
    type: "select",
    options: [
      { label: "Scope", value: "SCOPE" },
      { label: "Filter", value: "FILTER" },
    ],
  },
  {
    field: "enabled",
    label: "Enabled",
    type: "select",
    options: [
      { label: "Yes", value: "true" },
      { label: "No", value: "false" },
    ],
  },
];

export const RowLevelPolicyList = () => {
  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<RowLevelPolicy>();

    return [
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Policy",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{row.original.name}</span>
              {!row.original.enabled && (
                <Badge variant="outline" className="text-[10px]">
                  Off
                </Badge>
              )}
            </div>
            {row.original.policyGroup && (
              <span className="text-muted-foreground text-xs">
                {row.original.policyGroup}
              </span>
            )}
          </div>
        ),
      }),
      columnHelper.accessor("kind", {
        id: "kind",
        header: "Kind",
        enableSorting: true,
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant={row.original.kind === "FILTER" ? "default" : "secondary"}
              >
                {row.original.kind}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {row.original.kind === "FILTER"
                ? "Applies to everyone and always intersects — there is no role to not-hold in order to escape it."
                : "Belongs to one role and unions with the caller's other scopes, so holding one more role only ever widens."}
            </TooltipContent>
          </Tooltip>
        ),
        size: 120,
      }),
      columnHelper.display({
        id: "role",
        header: "Role",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.role ? (
            <span className="font-mono text-xs">{row.original.role.code}</span>
          ) : (
            // Not "missing": a filter has no role by design.
            <span className="text-muted-foreground text-sm">everyone</span>
          ),
        size: 140,
      }),
      columnHelper.accessor("resource", {
        id: "resource",
        header: "Resource",
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue()}</span>
        ),
        size: 160,
      }),
      columnHelper.accessor("action", {
        id: "action",
        header: "Action",
        enableSorting: true,
        cell: ({ getValue }) => <Badge variant="outline">{getValue()}</Badge>,
        size: 110,
      }),
      columnHelper.display({
        id: "health",
        header: "",
        enableSorting: false,
        // The quarantine note, next to the policy rather than only in a log:
        // the person who can fix it is looking at this screen.
        cell: ({ row }) =>
          row.original.invalidReason ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <TriangleAlert className="text-destructive h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                Disabled at startup because it no longer compiles:{" "}
                {row.original.invalidReason}
              </TooltipContent>
            </Tooltip>
          ) : null,
        size: 48,
        // `RESIZABLE_COLUMN_DEFAULTS` floors every column at 80px, and
        // `getSize()` clamps to it — so a warning-icon column has to opt out of
        // the floor or it silently widens to 80.
        minSize: 48,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            <DeleteButton recordItemId={row.original.id} iconOnly size="icon-sm" />
          </div>
        ),
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
      <ListViewHeader description="Which rows a role can reach, and the prohibitions that apply to everybody." />
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
      {/*
        Below the table rather than on a screen of its own. The gap the matrix
        shows is a gap in the rows above it, and putting them a click apart is
        what lets somebody read the list, see nothing wrong, and leave.
      */}
      <CoverageMatrix />
    </ListView>
  );
};
