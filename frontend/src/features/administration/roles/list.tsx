import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import React from "react";

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
import { CreateButton } from "@/shared/components/buttons/create";
import { Badge } from "@/shared/ui/badge";
import { Plus } from "lucide-react";
import type { Role } from "@/domains/role/types";
import {
  ActionsCell,
  ActionsHeader,
  MENU_ONLY_COLUMN,
  RecordActionsMenu,
} from "../record-actions";

const ADVANCED_FILTER_FIELDS: AdvancedFilterField[] = [
  { field: "name", label: "Tên vai trò", type: "text", placeholder: "Tất cả" },
  { field: "code", label: "Mã vai trò", type: "text", placeholder: "Tất cả" },
  {
    field: "systemRole",
    label: "Loại",
    type: "select",
    options: [
      { label: "Hệ thống", value: "true" },
      { label: "Tuỳ chỉnh", value: "false" },
    ],
  },
];

export const RoleList = () => {
  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Role>();

    return [
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Vai trò",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-muted-foreground text-xs">
              {row.original.description || "Chưa có mô tả"}
            </span>
          </div>
        ),
        size: 360,
      }),
      columnHelper.display({
        id: "permissions",
        header: "Quyền được cấp",
        enableSorting: false,
        // Số lượng thay vì liệt kê: một vai trò có thể có hàng chục quyền, danh
        // sách đầy đủ nằm ở màn chi tiết.
        cell: ({ row }) => (
          <Badge variant="outline" className="tabular-nums">
            {row.original.permissions.length} quyền
          </Badge>
        ),
        size: 150,
      }),
      columnHelper.accessor("systemRole", {
        id: "systemRole",
        header: "Loại",
        enableSorting: false,
        cell: ({ getValue }) =>
          getValue() ? (
            <Badge variant="neutral" dot>
              Hệ thống
            </Badge>
          ) : (
            <Badge variant="info" dot>
              Tuỳ chỉnh
            </Badge>
          ),
        size: 140,
      }),
      columnHelper.display({
        id: "actions",
        header: () => <ActionsHeader />,
        cell: ({ row }) => {
          const role = row.original;
          return (
            <ActionsCell>
              <RecordActionsMenu
                resource="roles"
                id={role.id}
                editLabel="Sửa vai trò"
                // Vai trò hệ thống không xoá được — API trả 409 — nên không
                // đưa mục Xoá ra rồi mới từ chối.
                remove={
                  role.systemRole
                    ? false
                    : {
                        label: "Xoá vai trò",
                        title: `Xoá vai trò ${role.name}?`,
                        description:
                          "Cán bộ đang giữ vai trò này sẽ mất các quyền của nó. Việc xoá không lấy lại được.",
                        successMessage: `Đã xoá vai trò ${role.name}`,
                      }
                }
              />
            </ActionsCell>
          );
        },
        enableSorting: false,
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
        title="Vai trò"
        description="Nhóm quyền dùng chung cho nhiều cán bộ: được làm gì và được thấy dữ liệu nào."
        canCreate={false}
        actions={
          <CreateButton resource="roles">
            <Plus className="size-4" />
            Thêm vai trò
          </CreateButton>
        }
      />
      <DataTable
        table={table}
        itemLabel="vai trò"
        toolbar={
          <>
            <ListToolbar
              table={table}
              search={
                <DataTableQuickFilter
                  table={table}
                  placeholder="Tìm theo tên vai trò..."
                />
              }
              filters={<DataTableAdvancedFilter table={table} fields={ADVANCED_FILTER_FIELDS} />}
            />
            <DataTableFilterChips table={table} fields={ADVANCED_FILTER_FIELDS} />
          </>
        }
      />
    </ListView>
  );
};
