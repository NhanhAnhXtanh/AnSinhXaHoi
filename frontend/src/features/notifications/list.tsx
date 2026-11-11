import React, { type ComponentProps } from "react";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { CheckCheck } from "lucide-react";

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
import { Button } from "@/shared/ui/button";
import { useNotifications, type Notification } from "@/shared/hooks/use-notifications";
import { cn } from "@/shared/lib/utils";
import { NotificationRowActions } from "./row-actions";
import { formatDateTimeVi, relativeDayVi } from "./format";

/**
 * Mọi thông báo gửi tới tài khoản này, dạng bảng (Figma 311:84353).
 *
 * Chỉ có danh sách và xoá, có chủ ý: không ai tự viết thông báo — hệ thống tạo
 * ra cùng lúc với việc đáng báo — và việc duy nhất người nhận được làm là đánh
 * dấu đã đọc. Mọi dòng đều của tài khoản đang đăng nhập; API không trả thông
 * báo của người khác.
 */

const LEVEL_LABELS: Record<Notification["level"], string> = {
  INFO: "Thông tin",
  SUCCESS: "Hoàn thành",
  WARNING: "Cảnh báo",
  ERROR: "Cần xử lý",
};

const ADVANCED_FILTER_FIELDS: AdvancedFilterField[] = [
  { field: "title", label: "Nội dung", type: "text", placeholder: "Tất cả" },
  {
    field: "level",
    label: "Mức độ",
    type: "select",
    options: [
      { label: LEVEL_LABELS.INFO, value: "INFO" },
      { label: LEVEL_LABELS.SUCCESS, value: "SUCCESS" },
      { label: LEVEL_LABELS.WARNING, value: "WARNING" },
      { label: LEVEL_LABELS.ERROR, value: "ERROR" },
    ],
  },
  {
    field: "read",
    label: "Trạng thái",
    type: "select",
    options: [
      { label: "Chưa đọc", value: "false" },
      { label: "Đã đọc", value: "true" },
    ],
  },
];

/**
 * Mức độ dùng họ màu nhạt của badge chứ không pha tay, để cùng một chip ra
 * cùng một màu trên thẻ lẫn trên dòng đang rê chuột.
 */
const LEVEL_VARIANT: Record<
  Notification["level"],
  ComponentProps<typeof Badge>["variant"]
> = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "destructive",
};

export const NotificationList = () => {
  // Dùng chung hook với chuông thông báo, nên đánh dấu đã đọc ở đây cũng cập
  // nhật số trên chuông.
  const { markRead, markAllRead, unreadCount, refresh } = useNotifications();

  // Bảng là của Refine, còn `markRead` chỉ làm mới số đếm của chuông — nên sau
  // khi đánh dấu, bảng cũng được tải lại để cột "Trạng thái" đổi theo.
  const refetchRowsRef = React.useRef<() => void>(() => {});

  const handleMarkRead = React.useCallback(
    async (id: number) => {
      await markRead(id);
      refetchRowsRef.current();
    },
    [markRead]
  );

  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<Notification>();

    return [
      columnHelper.accessor("title", {
        id: "title",
        enableResizing: true,
        header: "Nội dung",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className={cn("text-sm", !row.original.read && "font-semibold")}>
              {row.original.title}
            </span>
            {row.original.body && (
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {row.original.body}
              </span>
            )}
          </div>
        ),
        size: 380,
      }),
      columnHelper.accessor("createdAt", {
        id: "createdAt",
        header: "Nhận lúc",
        enableSorting: true,
        cell: ({ getValue }) => (
          <div className="flex flex-col">
            <span className="text-sm tabular-nums">
              {formatDateTimeVi(getValue())}
            </span>
            <span className="text-xs text-muted-foreground">
              {relativeDayVi(getValue())}
            </span>
          </div>
        ),
        size: 170,
      }),
      columnHelper.accessor("read", {
        id: "read",
        header: "Trạng thái",
        enableSorting: false,
        cell: ({ getValue }) => (
          <Badge variant="outline">{getValue() ? "Đã đọc" : "Chưa đọc"}</Badge>
        ),
        size: 130,
      }),
      columnHelper.accessor("level", {
        id: "level",
        header: "Mức độ",
        enableSorting: true,
        cell: ({ getValue }) => {
          const level = getValue();
          return (
            <Badge variant={LEVEL_VARIANT[level]} dot>
              {LEVEL_LABELS[level] ?? level}
            </Badge>
          );
        },
        size: 140,
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="ms-auto">Thao tác</span>,
        enableSorting: false,
        // Nút chính nền nhạt rộng cố định ("Đánh dấu đã đọc" hoặc "Xem") và
        // nút ⋯ chứa các việc còn lại, kể cả Xoá.
        size: 228,
        minSize: 228,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <NotificationRowActions
              notification={row.original}
              onMarkRead={handleMarkRead}
            />
          </div>
        ),
      }),
    ];
  }, [handleMarkRead]);

  const table = useTable<Notification>({
    columns,
    // Kéo vạch ở tiêu đề cột để đổi độ rộng; nhấp đúp để về mặc định.
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    // Cột thao tác ghim bên phải, để không bị cuộn ngang mất.
    initialState: {
      columnPinning: { right: ["actions"] },
    },
    refineCoreProps: {
      syncWithLocation: true,
    },
  });

  const { refetch } = table.refineCore.tableQuery;
  React.useEffect(() => {
    refetchRowsRef.current = () => {
      void refetch();
    };
  }, [refetch]);

  // Số đếm của chuông là trạng thái react-query mà bảng không biết, nên mỗi
  // khi dòng của bảng đổi — xoá, lọc, sang trang — số đếm được đọc lại.
  const rowsUpdatedAt = table.refineCore.tableQuery.dataUpdatedAt;
  React.useEffect(() => {
    refresh();
  }, [rowsUpdatedAt, refresh]);

  return (
    <ListView>
      <ListViewHeader
        title="Thông báo"
        description="Những việc hệ thống nhắc bạn: phiếu đến hạn, phiếu bị trả lại, phiếu đã nộp."
        canCreate={false}
        actions={
          unreadCount > 0 ? (
            <Button
              onClick={async () => {
                await markAllRead();
                refetchRowsRef.current();
              }}
            >
              <CheckCheck className="size-4" />
              Đánh dấu đã đọc tất cả ({unreadCount})
            </Button>
          ) : undefined
        }
      />
      <DataTable
        table={table}
        itemLabel="thông báo"
        toolbar={
          <>
            <ListToolbar
              table={table}
              search={
                <DataTableQuickFilter
                  table={table}
                  placeholder="Tìm trong thông báo..."
                />
              }
              filters={
                <DataTableAdvancedFilter
                  table={table}
                  fields={ADVANCED_FILTER_FIELDS}
                />
              }
            />
            <DataTableFilterChips
              table={table}
              fields={ADVANCED_FILTER_FIELDS}
            />
          </>
        }
      />
    </ListView>
  );
};
