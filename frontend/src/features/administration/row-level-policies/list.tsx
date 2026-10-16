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
  DataTable,
  RESIZABLE_COLUMN_DEFAULTS,
} from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { CreateButton } from "@/shared/components/buttons/create";
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
import { Plus } from "lucide-react";
import { CoverageMatrix } from "./coverage-matrix";
import { KIND_LABELS } from "./labels";
import { useManagedResources } from "./use-managed-resources";
import { ACTIONS, type RowLevelPolicy } from "@/domains/row-level-policy/types";
import { actionLabel, resourceLabel } from "../labels";
import {
  ActionsCell,
  ActionsHeader,
  MENU_ONLY_COLUMN,
  RecordActionsMenu,
} from "../record-actions";

const ADVANCED_FILTER_FIELDS: AdvancedFilterField[] = [
  {
    field: "action",
    label: "Thao tác",
    type: "select",
    options: ACTIONS.map((action) => ({ label: actionLabel(action), value: action })),
  },
  {
    field: "kind",
    label: "Loại",
    type: "select",
    options: [
      { label: KIND_LABELS.SCOPE, value: "SCOPE" },
      { label: KIND_LABELS.FILTER, value: "FILTER" },
    ],
  },
  {
    field: "enabled",
    label: "Trạng thái",
    type: "select",
    options: [
      { label: "Đang bật", value: "true" },
      { label: "Tạm tắt", value: "false" },
    ],
  },
];

export const RowLevelPolicyList = () => {
  const resources = useManagedResources();
  // Lọc theo dữ liệu áp dụng: chọn từ danh sách tên tiếng Việt thay cho ô gõ mã.
  const filterFields = React.useMemo<AdvancedFilterField[]>(
    () => [
      {
        field: "resource",
        label: "Dữ liệu áp dụng",
        type: "select",
        options: resources.map((resource) => ({
          label: resourceLabel(resource),
          value: resource,
        })),
      },
      ...ADVANCED_FILTER_FIELDS,
    ],
    [resources]
  );

  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<RowLevelPolicy>();

    return [
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Phạm vi",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {(row.original.description || row.original.policyGroup) && (
              <span className="text-muted-foreground text-xs">
                {row.original.description || row.original.policyGroup}
              </span>
            )}
          </div>
        ),
        size: 320,
      }),
      columnHelper.accessor("resource", {
        id: "resource",
        header: "Dữ liệu áp dụng",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-sm">{resourceLabel(row.original.resource)}</span>
            <span className="text-muted-foreground text-xs">
              Thao tác: {actionLabel(row.original.action)}
            </span>
          </div>
        ),
        size: 200,
      }),
      columnHelper.display({
        id: "role",
        header: "Vai trò",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.role ? (
            <Badge variant="outline">
              {row.original.role.name || row.original.role.code}
            </Badge>
          ) : (
            // Không phải "thiếu": phạm vi hạn chế không gắn vai trò nào.
            <Badge variant="outline">Mọi vai trò</Badge>
          ),
        size: 180,
      }),
      columnHelper.accessor("kind", {
        id: "kind",
        header: "Loại",
        enableSorting: true,
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant={row.original.kind === "FILTER" ? "warning" : "info"}
                dot
              >
                {KIND_LABELS[row.original.kind] ?? row.original.kind}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {row.original.kind === "FILTER"
                ? "Áp dụng cho mọi người và luôn thu hẹp dữ liệu — không vai trò nào thoát được."
                : "Thuộc một vai trò và cộng thêm với các phạm vi khác của cán bộ, nên có thêm vai trò chỉ thấy rộng hơn."}
            </TooltipContent>
          </Tooltip>
        ),
        size: 120,
      }),
      columnHelper.accessor("enabled", {
        id: "enabled",
        header: "Trạng thái",
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="text-sm">{getValue() ? "Đang bật" : "Tạm tắt"}</span>
        ),
        size: 120,
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
                Đã bị tắt khi khởi động vì điều kiện không còn hợp lệ:{" "}
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
        header: () => <ActionsHeader />,
        enableSorting: false,
        cell: ({ row }) => (
          <ActionsCell>
            <RecordActionsMenu
              resource="row_level_policies"
              id={row.original.id}
              editLabel="Sửa phạm vi"
              remove={{
                label: "Xoá phạm vi",
                title: `Xoá phạm vi “${row.original.name}”?`,
                description:
                  "Phần dữ liệu phạm vi này mở ra hoặc giới hạn sẽ trở về mặc định. Việc xoá không lấy lại được.",
                successMessage: `Đã xoá phạm vi ${row.original.name}`,
              }}
            />
          </ActionsCell>
        ),
        ...MENU_ONLY_COLUMN,
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
      <ListViewHeader
        title="Phạm vi dữ liệu"
        description="Mỗi vai trò được thấy những dòng dữ liệu nào, và những giới hạn áp dụng cho mọi người."
        canCreate={false}
        actions={
          <CreateButton resource="row_level_policies">
            <Plus className="size-4" />
            Thêm phạm vi dữ liệu
          </CreateButton>
        }
      />
      <DataTable
        table={table}
        toolbar={
          <>
            <ListToolbar
              table={table}
              search={
                <DataTableQuickFilter
                  table={table}
                  placeholder="Tìm theo tên phạm vi..."
                />
              }
              filters={<DataTableAdvancedFilter table={table} fields={filterFields} />}
            />
            <DataTableFilterChips table={table} fields={filterFields} />
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
