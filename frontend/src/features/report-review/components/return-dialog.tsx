import { useId, useState } from "react";

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

import type { ReviewReport } from "../fixtures";

const MAX_REASON = 1000;

/** Hộp "Trả lại phiếu": chỉ một ô lý do, bắt buộc, tối đa 1.000 ký tự. */
export function ReturnDialog({
  report,
  open,
  onOpenChange,
  onConfirm,
}: {
  report: ReviewReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
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

  const submit = () => {
    const text = reason.trim();
    if (!text) {
      setError("Chưa nhập lý do trả lại.");
      document.getElementById(fieldId)?.focus();
      return;
    }
    onConfirm(text);
    setReason("");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>Trả lại phiếu</DialogTitle>
          <DialogDescription>
            Phiếu {report.period.name} của {report.orgName} sẽ về lại đơn vị để sửa và nộp lại. Đơn
            vị sẽ thấy lý do bạn nhập bên dưới.
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
          <Button type="button" variant="destructive" onClick={submit}>
            Trả lại phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
