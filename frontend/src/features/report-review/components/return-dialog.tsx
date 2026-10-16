import { useId, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { formatNumber } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

const MAX_REASON = 1000;

/**
 * Hộp "Trả lại phiếu": chỉ một ô lý do, bắt buộc, tối đa 1.000 ký tự. Trả lại
 * sinh phiên bản phiếu mới cho đơn vị sửa (BR-42.1) — bản đang xem giữ nguyên để
 * đối chiếu.
 *
 * `onConfirm` trả `true` khi máy chủ đã nhận: hộp xoá ô lý do; `false` thì giữ
 * nguyên chữ đã gõ để người dùng thử lại.
 */
export function ReturnDialog({
  periodName,
  unitName,
  open,
  onOpenChange,
  onConfirm,
  pending = false,
}: {
  periodName: string;
  unitName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<boolean>;
  pending?: boolean;
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason("");
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (pending) return;
    const text = reason.trim();
    if (!text) {
      setError("Chưa nhập lý do trả lại.");
      document.getElementById(fieldId)?.focus();
      return;
    }
    if (await onConfirm(text)) {
      setReason("");
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>Trả lại phiếu</DialogTitle>
          <DialogDescription>
            Phiếu {periodName} của {unitName} sẽ về lại đơn vị để sửa và nộp lại. Đơn vị sẽ thấy lý
            do bạn nhập bên dưới.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId}>
            Lý do trả lại <span className="text-destructive-text">*</span>
          </Label>
          <Textarea
            id={fieldId}
            value={reason}
            maxLength={MAX_REASON}
            rows={3}
            className="min-h-20"
            placeholder="Ghi rõ biểu và dòng cần sửa để đơn vị điều chỉnh lại số liệu."
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setReason(e.target.value);
              if (error && e.target.value.trim()) setError(null);
            }}
          />
          <div className="flex items-start gap-3 text-xs">
            {error && (
              <p id={errorId} className="text-destructive-text">
                {error}
              </p>
            )}
            <span className="text-muted-foreground ms-auto tabular-nums">
              {formatNumber(reason.length)} / {formatNumber(MAX_REASON)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Quay lại
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => void submit()}>
            {pending && <LoaderCircle className="animate-spin" />}
            Trả lại phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
