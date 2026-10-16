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
import { Badge } from "@/shared/ui/badge";
import { splitPermissionCode, type Permission } from "@/domains/permission/types";
import { PERMISSION_ACTION_VARIANTS } from "@/shared/lib/status-variants";
import { actionLabel, resourceLabel, YES_NO_OPTIONS } from "../labels";
import {
  ActionsCell,
  ActionsHeader,
  MENU_ONLY_COLUMN,
  RecordActionsMenu,
} from "../record-actions";

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
  { field: "name", label: "Tên quyền", type: "text", placeholder: "Tất cả" },
  { field: "code", label: "Mã quyền", type: "text", placeholder: "Tất cả" },
  {
    field: "systemPermission",
    label: "Quyền hệ thống",
    type: "select",
    options: YES_NO_OPTIONS,
  },
];

export const PermissionList = () => {
  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Permission>();

    return [
      columnHelper.display({
        id: "resource",
        header: "Chức năng",
        // Derived from the code rather than sent by the API, which is why it
        // does not sort: there is no column behind it to sort on. Sorting by
        // `code` groups by resource anyway, since the resource is its prefix.
        enableSorting: false,
        cell: ({ row }) => {
          const { resource, action } = splitPermissionCode(row.original.code);
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm">{resourceLabel(resource)}</span>
              <Badge
                variant={PERMISSION_ACTION_VARIANTS[action] ?? "outline"}
                className="text-[10px]"
              >
                {actionLabel(action)}
              </Badge>
            </div>
          );
        },
        size: 220,
      }),
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Tên quyền",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.systemPermission && (
              <Badge variant="neutral" dot>
                Hệ thống
              </Badge>
            )}
          </div>
        ),
      }),
      columnHelper.accessor("code", {
        id: "code",
        enableResizing: true,
        header: "Mã quyền",
        enableSorting: true,
        // Đúng chuỗi máy chủ kiểm, nên hiện nguyên văn.
        cell: ({ getValue }) => (
          <span className="text-muted-foreground font-mono text-xs">
            {getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("description", {
        id: "description",
        enableResizing: true,
        header: "Mô tả",
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm">
            {getValue() ?? "—"}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <ActionsHeader />,
        // Chỉ Xem chi tiết: không có điểm cuối sửa / xoá quyền, nên không đưa
        // ra rồi mới từ chối.
        cell: ({ row }) => (
          <ActionsCell>
            <RecordActionsMenu
              resource="permissions"
              id={row.original.id}
              editLabel={false}
            />
          </ActionsCell>
        ),
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
        title="Quyền"
        description="Danh sách các quyền có thể cấp cho vai trò. Quyền do hệ thống tạo sẵn, ở đây chỉ để xem."
        canCreate={false}
      />
      <DataTable
        table={table}
        toolbar={
          <>
            <ListToolbar
              table={table}
              search={
                <DataTableQuickFilter table={table} placeholder="Tìm theo tên quyền..." />
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
