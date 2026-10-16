import { CircleAlert } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

/** Phê duyệt không thành: phiếu giữ Chờ duyệt, cho thử lại. */
export function ApproveErrorDialog({
  open,
  onOpenChange,
  onRetry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>Không phê duyệt được</DialogTitle>
        </DialogHeader>

        <div
          role="alert"
          className="bg-destructive-subtle text-destructive-text flex items-start gap-2.5 rounded-md px-3 py-2.5"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <DialogDescription className="text-destructive-text text-sm">
            Chưa duyệt được phiếu này vì hệ thống chưa tính được số liệu của phiếu. Phiếu vẫn ở
            trạng thái Chờ duyệt. Bạn thử lại sau ít phút; nếu vẫn không được, hãy báo bộ phận hỗ
            trợ.
          </DialogDescription>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button type="button" onClick={onRetry}>
            Thử lại
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
