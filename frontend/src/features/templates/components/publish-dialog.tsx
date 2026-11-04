import { useEffect, useId, useState } from "react";

import { formatDate } from "@/shared/components/asxh";
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
import { cn } from "@/shared/lib/utils";

import type { TemplateVersion } from "../types";
import { firstOfNextMonth, nextDay, parseVnDate, versionLabel } from "../model";
import { DateInput } from "@/shared/components/date-input";

/**
 * Hộp "Ban hành phiên bản N?" (UC-13): một ô Áp dụng từ ngày, điền sẵn ngày đã
 * lưu (chưa có thì ngày 1 tháng sau). Ngày phải sau ngày áp dụng của bản
 * nguồn — kiểm sơ ở đây cho nhanh, máy chủ kiểm lại và trả câu báo.
 */
export function PublishDialog({
  version,
  previous,
  onOpenChange,
  onSubmit,
}: {
  /** Phiên bản cần ban hành; null = hộp đóng. */
  version: TemplateVersion | null;
  /** Bản nguồn còn ngày áp dụng — để viết gợi ý và kiểm ngày sớm nhất. */
  previous?: TemplateVersion;
  onOpenChange: (open: boolean) => void;
  /** Gửi ban hành; trả câu lỗi để hiện dưới ô ngày, hoặc null khi xong. */
  onSubmit: (version: TemplateVersion, isoDate: string) => Promise<string | null>;
}) {
  const inputId = useId();
  const hintId = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Giữ phiên bản vừa mở để chữ trong hộp không mất khi hộp đang mờ dần lúc đóng.
  const [shown, setShown] = useState<TemplateVersion | null>(version);

  useEffect(() => {
    if (!version) return;
    setShown(version);
    setText(formatDate(version.effectiveFrom ?? firstOfNextMonth()));
    setError(null);
    setBusy(false);
  }, [version]);

  const min = previous?.effectiveFrom ? nextDay(previous.effectiveFrom) : null;

  async function submit() {
    if (!version || busy) return;
    if (!text.trim()) {
      setError("Hãy chọn ngày áp dụng trước khi ban hành.");
      return;
    }
    const iso = parseVnDate(text);
    if (!iso) {
      setError("Ngày chưa đúng. Hãy nhập theo dạng ngày/tháng/năm, ví dụ 01/11/2026.");
      return;
    }
    if (min && iso < min) {
      setError(`Ngày áp dụng phải từ ${formatDate(min)} trở đi.`);
      return;
    }
    setBusy(true);
    const failure = await onSubmit(version, iso);
    setBusy(false);
    if (failure) setError(failure);
  }

  const label = shown ? versionLabel(shown) : "";

  return (
    <Dialog open={version !== null} onOpenChange={(open) => !busy && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ban hành {label.toLowerCase()}?</DialogTitle>
          <DialogDescription>
            Sau khi ban hành, bạn không sửa được thiết kế và quy tắc của phiên
            bản này nữa. Phiên bản chỉ có hiệu lực từ ngày áp dụng.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Label htmlFor={inputId}>
            Áp dụng từ ngày <span className="text-destructive-text">*</span>
          </Label>
          <DateInput
            id={inputId}
            value={text}
            min={min}
            disabled={busy}
            invalid={Boolean(error)}
            describedBy={hintId}
            onChange={(next) => {
              setText(next);
              setError(null);
            }}
          />
          <p
            id={hintId}
            className={cn(
              "text-xs",
              error ? "text-destructive-text" : "text-muted-foreground"
            )}
          >
            {error ??
              (previous?.effectiveFrom
                ? `Phải sau ngày áp dụng của ${versionLabel(previous).toLowerCase()} (${formatDate(previous.effectiveFrom)}).`
                : "Phiên bản đầu tiên của biểu chọn ngày tự do.")}
          </p>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Quay lại
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Đang ban hành…" : `Ban hành ${label.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
