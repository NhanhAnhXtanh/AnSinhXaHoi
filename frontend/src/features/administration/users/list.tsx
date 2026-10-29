import { useCan, useList } from "@refinedev/core";
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
import {
  ACCOUNT_LEVEL_LABELS,
  accountLevelOf,
  type RoleSummary,
  type User,
} from "@/domains/user/types";
import { Plus } from "lucide-react";
import { formatDateTimeVi, USER_STATUS_FILTER_OPTIONS } from "../labels";
import {
  ActionsCell,
  ActionsHeader,
  MENU_ONLY_COLUMN,
} from "../record-actions";
import { UserRowActions } from "./user-actions";
import { UserStatusBadge } from "./user-status-badge";

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
  { field: "fullName", label: "Họ tên", type: "text", placeholder: "Tất cả" },
  { field: "username", label: "Tên đăng nhập", type: "text", placeholder: "Tất cả" },
  { field: "email", label: "Thư điện tử", type: "text", placeholder: "Tất cả" },
  {
    field: "status",
    label: "Trạng thái",
    type: "select",
    options: USER_STATUS_FILTER_OPTIONS,
  },
];

/** Dòng `/api/report_units` mà ô lọc "Đơn vị" cần — khai cục bộ, không nhập feature khác. */
type ReportUnitRow = { id: number; name: string };

export const UserList = () => {
  // Đọc đơn vị báo cáo và vai trò là quyền riêng, khác quyền đọc người dùng. Hỏi khi
  // không có quyền chỉ tốn một yêu cầu chắc chắn 403 và một thông báo lỗi mỗi lần vào
  // màn — nên chỉ tải khi có quyền, không có thì ô lọc đó không hiện.
  const { data: canReadUnits } = useCan({ resource: "report_units", action: "list" });
  const { data: canReadRoles } = useCan({ resource: "roles", action: "list" });
  const mayReadUnits = canReadUnits?.can ?? false;
  const mayReadRoles = canReadRoles?.can ?? false;

  const { result: unitResult } = useList<ReportUnitRow>({
    resource: "report_units",
    pagination: { pageSize: 1000 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: mayReadUnits },
  });

  const { result: roleResult } = useList<RoleSummary>({
    resource: "roles",
    pagination: { pageSize: 100 },
    sorters: [{ field: "code", order: "asc" }],
    queryOptions: { enabled: mayReadRoles },
  });

  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<User>();

    return [
      columnHelper.accessor("fullName", {
        id: "fullName",
        enableResizing: true,
        header: "Họ tên",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {row.original.fullName || row.original.username}
            </span>
            <span className="text-muted-foreground text-xs">
              {row.original.username}
            </span>
          </div>
        ),
      }),
      columnHelper.display({
        id: "placement",
        enableResizing: true,
        header: "Đơn vị công tác",
        // Không sắp xếp được: API không nhận `_sort=reportUnit`, cho bấm tiêu đề thì
        // thành một lần sắp xếp không làm gì. Dùng ô lọc Đơn vị thay vào.
        enableSorting: false,
        // Figma 309:16321: tên đơn vị báo cáo (hoặc "—"), dòng dưới là cấp tài khoản.
        cell: ({ row }) => {
          const { reportUnit } = row.original;
          return (
            <div className="flex flex-col">
              <span className="text-sm">
                {reportUnit ? (
                  reportUnit.name
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
              <span className="text-muted-foreground text-xs">
                Tài khoản cấp {ACCOUNT_LEVEL_LABELS[accountLevelOf(row.original)]}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: "Trạng thái",
        enableSorting: true,
        cell: ({ getValue }) => <UserStatusBadge status={getValue()} />,
      }),
      columnHelper.display({
        id: "roles",
        header: "Vai trò",
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
        header: "Đăng nhập gần nhất",
        enableSorting: true,
        cell: ({ getValue }) => {
          const value = getValue();
          return (
            <span className="text-sm tabular-nums">
              {value ? (
                formatDateTimeVi(value)
              ) : (
                <span className="text-muted-foreground">Chưa đăng nhập</span>
              )}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: () => <ActionsHeader />,
        // Chỉ một nút ⋯: Sửa, Xem chi tiết, Đặt lại mật khẩu, Khoá và Xoá đều
        // nằm trong menu, mục nào tài khoản này không có quyền thì ẩn.
        cell: ({ row }) => (
          <ActionsCell>
            <UserRowActions user={row.original} />
          </ActionsCell>
        ),
        enableSorting: false,
        ...MENU_ONLY_COLUMN,
      }),
    ];
  }, []);

  const advancedFilterFields = React.useMemo<AdvancedFilterField[]>(
    () => [
      ...STATIC_FILTER_FIELDS,
      {
        field: "accountLevel",
        label: "Cấp tài khoản",
        type: "select" as const,
        placeholder: "Tất cả",
        operators: ["eq" as const],
        options: [
          { label: "Cấp Đơn vị", value: "don_vi" },
          { label: "Cấp Sở hoặc UBND", value: "so_ubnd" },
        ],
      },
      // Chỉ hiện với người được đọc danh mục tương ứng: một ô chọn không có lựa chọn
      // nào trông như hỏng chứ không tự giải thích được.
      ...(mayReadUnits
        ? [
            {
              field: "reportUnit.id",
              label: "Đơn vị",
              type: "select" as const,
              placeholder: "Tất cả đơn vị",
              options: (unitResult?.data ?? []).map((item) => ({
                label: item.name,
                value: String(item.id),
              })),
            },
          ]
        : []),
      ...(mayReadRoles
        ? [
            {
              field: "roles.id",
              label: "Vai trò",
              type: "select" as const,
              placeholder: "Tất cả vai trò",
              operators: ["eq" as const],
              options: (roleResult?.data ?? []).map((item) => ({
                label: item.name,
                value: String(item.id),
              })),
            },
          ]
        : []),
    ],
    [mayReadUnits, mayReadRoles, unitResult?.data, roleResult?.data]
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
      <ListViewHeader
        title="Người dùng"
        description="Tài khoản đăng nhập, vai trò và đơn vị công tác của từng cán bộ."
        canCreate={false}
        actions={
          <CreateButton resource="users">
            <Plus className="size-4" />
            Thêm người dùng
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
                  placeholder="Tìm theo họ tên hoặc tên đăng nhập..."
                />
              }
              filters={<DataTableAdvancedFilter table={table} fields={advancedFilterFields} />}
            />
            <DataTableFilterChips table={table} fields={advancedFilterFields} />
          </>
        }
      />
    </ListView>
  );
};
