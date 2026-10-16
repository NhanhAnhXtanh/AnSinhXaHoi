import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

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
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";

import type { TemplateVersion } from "../fixtures";
import { firstOfNextMonth, parseVnDate, versionLabel } from "../model";
import { minEffectiveDate, publishVersion } from "../store";

/**
 * Hộp "Ban hành phiên bản N?" (UC-13): một ô Áp dụng từ ngày, điền sẵn ngày đã
 * lưu (chưa có thì ngày 1 tháng sau). Ngày phải sau ngày áp dụng của bản trước.
 */
export function PublishDialog({
  version,
  previousLabel,
  onOpenChange,
  onPublished,
}: {
  /** Phiên bản cần ban hành; null = hộp đóng. */
  version: TemplateVersion | null;
  /** "phiên bản 3 (01/07/2026)" — để viết gợi ý dưới ô ngày. */
  previousLabel?: string;
  onOpenChange: (open: boolean) => void;
  onPublished?: (version: TemplateVersion) => void;
}) {
  const inputId = useId();
  const hintId = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Giữ phiên bản vừa mở để chữ trong hộp không mất khi hộp đang mờ dần lúc đóng.
  const [shown, setShown] = useState<TemplateVersion | null>(version);

  useEffect(() => {
    if (!version) return;
    setShown(version);
    setText(formatDate(version.effectiveFrom ?? firstOfNextMonth()));
    setError(null);
  }, [version]);

  const min = version ? minEffectiveDate(version.id) : null;

  function submit() {
    if (!version) return;
    if (!text.trim()) {
      setError("Hãy chọn ngày áp dụng trước khi ban hành.");
      return;
    }
    const iso = parseVnDate(text);
    if (!iso) {
      setError("Ngày chưa đúng. Hãy nhập theo dạng ngày/tháng/năm, ví dụ 01/11/2026.");
      return;
    }
    const result = publishVersion(version.id, iso);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(
      `Đã ban hành ${versionLabel(version).toLowerCase()}, áp dụng từ ${formatDate(iso)}.`
    );
    onOpenChange(false);
    onPublished?.(result.value);
  }

  const label = shown ? versionLabel(shown) : "";

  return (
    <Dialog open={version !== null} onOpenChange={onOpenChange}>
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
            submit();
          }}
        >
          <Label htmlFor={inputId}>
            Áp dụng từ ngày <span className="text-destructive-text">*</span>
          </Label>
          <Input
            id={inputId}
            value={text}
            inputMode="numeric"
            placeholder="ngày/tháng/năm"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={hintId}
            onChange={(e) => {
              setText(e.target.value);
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
              (min && previousLabel
                ? `Phải sau ngày áp dụng của ${previousLabel}.`
                : "Phiên bản đầu tiên của biểu chọn ngày tự do.")}
          </p>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Quay lại
            </Button>
            <Button type="submit">Ban hành {label.toLowerCase()}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
