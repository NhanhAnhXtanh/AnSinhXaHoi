import { useState, type ReactNode } from "react";
import {
  type BaseKey,
  useBack,
  useDeleteButton,
  useEditButton,
  useNavigation,
  useRefreshButton,
  useResourceParams,
  useShowButton,
} from "@refinedev/core";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Ellipsis,
  Eye,
  Pencil,
  RefreshCw,
  Trash,
  type LucideIcon,
} from "lucide-react";

import { Breadcrumb } from "@/shared/components/layout/breadcrumb";
import { Button, buttonVariants } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { cn } from "@/shared/lib/utils";
import { errorDescription } from "./labels";

/**
 * Thao tác trên một bản ghi của màn quản trị: nút ⋯ trên dòng bảng, cụm nút ở
 * đầu trang chi tiết, và hộp xác nhận.
 *
 * Quyền vẫn do Refine quyết như các nút `shared/components/buttons/*` cũ: mỗi
 * mục hỏi `useEditButton` / `useShowButton` / `useDeleteButton`, mục nào bị
 * `hidden` thì không hiện. Thay đổi duy nhất là cách trình bày — một nút ⋯
 * thay cho ba nút biểu tượng.
 */

export type MenuAction = {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  hidden?: boolean;
  destructive?: boolean;
};

export type DeleteConfig = {
  /** Chữ trên mục menu, ví dụ "Xoá người dùng". */
  label: string;
  /** Tiêu đề hộp xác nhận. */
  title: string;
  description: ReactNode;
  /** Chữ nút xác nhận; mặc định bằng `label`. */
  confirmLabel?: string;
  /** Thông báo nổi khi xoá xong. */
  successMessage: string;
};

/* ------------------------------------------------------------------------- */
/* Hộp xác nhận                                                              */
/* ------------------------------------------------------------------------- */

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Quay lại",
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            className={cn(
              destructive && buttonVariants({ variant: "destructive" })
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------------------- */
/* Nút ⋯                                                                     */
/* ------------------------------------------------------------------------- */

type RecordActionsMenuProps = {
  /** Mặc định suy ra từ đường dẫn, như các nút cũ. */
  resource?: string;
  /** Mặc định đọc `:id` trên đường dẫn. */
  id?: BaseKey;
  /** `false` để không có mục Sửa. */
  editLabel?: string | false;
  /** `false` để không có mục Xem chi tiết. */
  showLabel?: string | false;
  /** Các việc khác, nằm giữa Xem chi tiết và Xoá. */
  items?: MenuAction[];
  /** `false` để không có mục Xoá. */
  remove?: DeleteConfig | false;
  onDeleted?: () => void;
  ariaLabel?: string;
};

export function RecordActionsMenu({
  resource,
  id,
  editLabel = "Sửa",
  showLabel = "Xem chi tiết",
  items = [],
  remove = false,
  onDeleted,
  ariaLabel = "Thao tác",
}: RecordActionsMenuProps) {
  const navigate = useNavigate();
  const edit = useEditButton({ resource, id });
  const show = useShowButton({ resource, id });
  const del = useDeleteButton({
    resource,
    id,
    onSuccess: () => onDeleted?.(),
    successNotification: remove
      ? { type: "success", message: remove.successMessage }
      : undefined,
    errorNotification: (error) => ({
      type: "error",
      message: "Không xoá được",
      description: errorDescription(error),
    }),
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const visibleItems = items.filter((item) => !item.hidden);
  const showEdit = editLabel !== false && !edit.hidden;
  const showShow = showLabel !== false && !show.hidden;
  const showDelete = remove !== false && !del.hidden;

  if (!showEdit && !showShow && visibleItems.length === 0 && !showDelete) {
    return null;
  }

  return (
    <>
      {/* `modal={false}`: menu đóng rồi mới mở hộp xác nhận, không bị hai lớp
          phủ giành nhau con trỏ. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={ariaLabel}
            data-print="hide"
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {showEdit && (
            <DropdownMenuItem
              disabled={edit.disabled}
              onSelect={() => navigate(edit.to)}
            >
              <Pencil />
              {editLabel}
            </DropdownMenuItem>
          )}
          {showShow && (
            <DropdownMenuItem
              disabled={show.disabled}
              onSelect={() => navigate(show.to)}
            >
              <Eye />
              {showLabel}
            </DropdownMenuItem>
          )}
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem
                key={item.key}
                disabled={item.disabled}
                variant={item.destructive ? "destructive" : "default"}
                onSelect={item.onSelect}
              >
                {Icon && <Icon />}
                {item.label}
              </DropdownMenuItem>
            );
          })}
          {showDelete && remove && (
            <>
              {(showEdit || showShow || visibleItems.length > 0) && (
                <DropdownMenuSeparator />
              )}
              <DropdownMenuItem
                variant="destructive"
                disabled={del.disabled || del.loading}
                onSelect={() => setConfirmOpen(true)}
              >
                <Trash />
                {remove.label}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {remove && (
        <ConfirmActionDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={remove.title}
          description={remove.description}
          confirmLabel={remove.confirmLabel ?? remove.label}
          destructive
          onConfirm={() => {
            del.onConfirm();
            setConfirmOpen(false);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------------- */
/* Cụm nút đầu trang chi tiết: [nút chính Sửa] [⋯]                            */
/* ------------------------------------------------------------------------- */

export function RecordHeaderActions({
  resource,
  id,
  editLabel = "Sửa",
  showLabel = false,
  items = [],
  remove = false,
}: {
  resource?: string;
  id?: BaseKey;
  /** `false` khi màn đang là màn sửa — không cần nút Sửa nữa. */
  editLabel?: string | false;
  /** Mục "Xem chi tiết" trong ⋯ — dùng ở màn sửa. */
  showLabel?: string | false;
  items?: MenuAction[];
  remove?: DeleteConfig | false;
}) {
  const navigate = useNavigate();
  const { list } = useNavigation();
  const { identifier } = useResourceParams({ resource });
  const edit = useEditButton({ resource, id });
  const refresh = useRefreshButton({ resource, id });

  return (
    <div data-print="hide" className="flex shrink-0 items-center gap-2">
      {editLabel !== false && !edit.hidden && (
        <Button
          type="button"
          disabled={edit.disabled}
          onClick={() => navigate(edit.to)}
        >
          <Pencil className="size-4" />
          {editLabel}
        </Button>
      )}
      <RecordActionsMenu
        resource={resource}
        id={id}
        editLabel={false}
        showLabel={showLabel}
        items={[
          {
            key: "refresh",
            label: refresh.loading ? "Đang tải lại..." : "Tải lại",
            icon: RefreshCw,
            disabled: refresh.loading,
            onSelect: refresh.onClick,
          },
          ...items,
        ]}
        remove={remove}
        // Màn đang nói về chính bản ghi vừa xoá, nên phải rời đi — ở lại thì
        // lần tải lại sau đó sẽ thành lỗi "không tìm thấy".
        onDeleted={() => {
          if (identifier) list(identifier);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Đầu trang chi tiết / tạo / sửa                                            */
/* ------------------------------------------------------------------------- */

/**
 * Breadcrumb + nút quay lại + tiêu đề (+ badge) + một dòng mô tả, cụm thao tác
 * bên phải. Thay cho `CreateViewHeader` / `EditViewHeader` / `ShowViewHeader`
 * ở các màn quản trị, vì các header đó gắn sẵn nút chữ tiếng Anh.
 */
export function AdminPageHeader({
  title,
  description,
  badge,
  actions,
  back = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  back?: boolean;
}) {
  const goBack = useBack();

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb />
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className={cn("flex min-w-0 items-center gap-1", back && "-ml-2.5")}>
            {back && (
              <Button
                type="button"
                data-print="hide"
                variant="ghost"
                size="icon"
                aria-label="Quay lại"
                onClick={goBack}
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <h1 className="min-w-0 truncate text-3xl leading-9 font-bold tracking-tight">
              {title}
            </h1>
            {badge && <div className="ml-2 shrink-0">{badge}</div>}
          </div>
          {description && (
            <p className="text-muted-foreground mt-1.5 max-w-3xl text-sm">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
    </div>
  );
}

/** Tiêu đề cột thao tác, canh phải. */
export function ActionsHeader() {
  return <span className="ms-auto">Thao tác</span>;
}

/** Ô thao tác của dòng bảng, canh phải. */
export function ActionsCell({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2">{children}</div>;
}

/** Bề rộng cột chỉ có nút ⋯ — đủ cho chữ "THAO TÁC" ở tiêu đề. */
export const MENU_ONLY_COLUMN = { size: 104, minSize: 104 };
