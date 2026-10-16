import { useState } from "react";
import { useDeleteButton } from "@refinedev/core";
import { useNavigate } from "react-router";
import { Check, Ellipsis, Eye, Trash } from "lucide-react";

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
import type { Notification } from "@/shared/hooks/use-notifications";

/**
 * Thao tác trên một dòng thông báo: nút chính nền nhạt rộng cố định + nút ⋯.
 *
 * Nút chính là "Đánh dấu đã đọc" khi chưa đọc, "Xem" khi đã đọc và thông báo
 * có đường dẫn. Xoá nằm trong ⋯, qua hộp xác nhận; quyền xoá do Refine quyết
 * như nút Xoá cũ (`useDeleteButton`, mục bị ẩn khi không có quyền).
 */
export function NotificationRowActions({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: number) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const del = useDeleteButton({
    resource: "notifications",
    id: notification.id,
    successNotification: { type: "success", message: "Đã xoá thông báo" },
    errorNotification: (error) => ({
      type: "error",
      message: "Không xoá được thông báo",
      description:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : undefined,
    }),
  });

  const unread = !notification.read;
  const link = notification.link;

  const open = () => {
    if (!link) return;
    // Mở một thông báo là đã đọc nó, như khi bấm trên chuông.
    if (unread) void onMarkRead(notification.id);
    if (/^https?:\/\//.test(link)) window.location.assign(link);
    else navigate(link);
  };

  return (
    <>
      {unread ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-36"
          onClick={() => void onMarkRead(notification.id)}
        >
          <Check className="size-3.5" />
          Đánh dấu đã đọc
        </Button>
      ) : link ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-36"
          onClick={open}
        >
          <Eye className="size-3.5" />
          Xem
        </Button>
      ) : null}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Thao tác"
            data-print="hide"
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {link && (
            <DropdownMenuItem onSelect={open}>
              <Eye />
              Xem
            </DropdownMenuItem>
          )}
          {unread && (
            <DropdownMenuItem onSelect={() => void onMarkRead(notification.id)}>
              <Check />
              Đánh dấu đã đọc
            </DropdownMenuItem>
          )}
          {!del.hidden && (
            <>
              {(link || unread) && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant="destructive"
                disabled={del.disabled || del.loading}
                onSelect={() => setConfirmOpen(true)}
              >
                <Trash />
                Xoá thông báo
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá thông báo này?</AlertDialogTitle>
            <AlertDialogDescription>
              “{notification.title}” sẽ bị xoá khỏi danh sách của bạn và không
              lấy lại được.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Quay lại</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                del.onConfirm();
                setConfirmOpen(false);
              }}
            >
              Xoá thông báo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
