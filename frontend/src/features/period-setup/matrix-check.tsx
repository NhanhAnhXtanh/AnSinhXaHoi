import { Check, Minus } from "lucide-react";

import { cn } from "@/shared/lib/utils";

/**
 * Ô tích của ma trận.
 *
 * Không dùng `Checkbox` của shadcn vì ô ma trận cần bốn dáng mà một checkbox
 * thường không có: đã lưu (nền đậm), chờ lưu (nền cam), chờ gỡ (viền đỏ, dấu
 * trừ) và nửa chừng ở ô tổng hàng/cột.
 */
export type CheckVisual =
  | "empty"
  | "saved"
  | "pendingAdd"
  | "pendingRemove"
  | "indeterminate";

export function MatrixCheck({
  visual,
  disabled,
  label,
  onToggle,
}: {
  visual: CheckVisual;
  disabled?: boolean;
  label: string;
  onToggle?: () => void;
}) {
  const checked = visual === "saved" || visual === "pendingAdd";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={visual === "indeterminate" ? "mixed" : checked}
      aria-disabled={disabled || undefined}
      aria-label={label}
      onClick={disabled ? undefined : onToggle}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-e1 outline-none transition-colors",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        visual === "empty" && "border-input bg-card",
        (visual === "saved" || visual === "indeterminate") &&
          "border-primary bg-primary text-primary-foreground",
        visual === "pendingAdd" &&
          "border-warning bg-warning text-warning-foreground",
        visual === "pendingRemove" &&
          "border-destructive bg-destructive-subtle text-destructive",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
      {(visual === "indeterminate" || visual === "pendingRemove") && (
        <Minus className="size-3" strokeWidth={3} />
      )}
    </button>
  );
}
