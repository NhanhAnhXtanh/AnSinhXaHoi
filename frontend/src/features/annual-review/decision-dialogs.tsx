import { useEffect, useState } from "react";
import { CircleX, LoaderCircle } from "lucide-react";

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

const MAX_REASON = 500;

/**
 * Hộp ghi lý do (Trả lại / Mở lại báo cáo năm): một ô lý do bắt buộc, tối đa
 * 500 ký tự. Bấm nút khi chưa ghi thì báo lỗi dưới ô.
 *
 * `onConfirm` gửi lên máy chủ: trả `null` khi xong (hộp tự đóng), hoặc câu lỗi
 * để hiện ngay dưới ô (hộp giữ nguyên chữ đã gõ để người dùng sửa).
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  emptyError,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  emptyError: string;
  onConfirm: (reason: string) => Promise<string | null>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setError(null);
    setBusy(false);
  }, [open]);

  const submit = async () => {
    const text = reason.trim();
    if (!text) {
      setError(emptyError);
      return;
    }
    if (text.length > MAX_REASON) {
      setError(`Lý do dài quá ${MAX_REASON} ký tự, hãy viết ngắn lại.`);
      return;
    }
    setBusy(true);
    try {
      const failure = await onConfirm(text);
      if (failure) {
        setError(failure);
        return;
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="decision-reason">
            {label} <span className="text-destructive-text">*</span>
          </Label>
          <Textarea
            id="decision-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            rows={3}
            disabled={busy}
            aria-invalid={Boolean(error)}
          />
          {error ? (
            <p className="text-destructive-text flex items-start gap-1.5 text-xs leading-4">
              <CircleX aria-hidden className="mt-px size-3.5 shrink-0" />
              {error}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs leading-4">
              Tối đa {MAX_REASON} ký tự.
              {reason.length > 0 && ` Đã viết ${reason.length}.`}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Quay lại
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy && <LoaderCircle aria-hidden className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
