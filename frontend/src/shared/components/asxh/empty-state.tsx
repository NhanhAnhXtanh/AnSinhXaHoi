import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/shared/lib/utils";

/**
 * Trạng thái rỗng / không có quyền / không tìm thấy.
 *
 * - `panel` (mặc định): giữa thân panel bảng — vòng tròn 56px nền accent,
 *   icon 24px, tiêu đề 16px đậm vừa, mô tả 14px tối đa 384px, nút cách 16px.
 * - `page`: cả vùng nội dung (cao tối thiểu 60% cửa sổ) — vòng tròn nền muted
 *   đệm 16px, icon 32px, tiêu đề 24px, mô tả tối đa 448px.
 * - `inline`: một dòng chữ xám trong thẻ nhỏ, không vòng tròn icon.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "panel",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  variant?: "panel" | "page" | "inline";
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm",
          className
        )}
      >
        <span>{title}</span>
        {description && <span>{description}</span>}
        {action}
      </div>
    );
  }

  const page = variant === "page";

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center",
        page ? "min-h-[60svh] py-12" : "py-12",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full",
          page ? "bg-muted p-4" : "bg-accent size-14"
        )}
      >
        <Icon
          aria-hidden
          className={cn("text-muted-foreground", page ? "size-8" : "size-6")}
        />
      </div>
      <h3
        className={cn(
          "text-foreground font-semibold",
          page ? "mt-2 text-2xl leading-8" : "text-base leading-6"
        )}
      >
        {title}
      </h3>
      {description && (
        <div
          className={cn(
            "text-muted-foreground text-sm",
            page ? "max-w-md" : "max-w-sm"
          )}
        >
          {description}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

EmptyState.displayName = "EmptyState";

/**
 * Đang tải: vòng xoay + chữ, đặt đúng chỗ đang chờ (không phủ cả trang).
 * `hint` là dòng thứ hai, chỉ hiện khi đã chờ quá `hintDelayMs` (mặc định 10 giây).
 */
export function LoadingState({
  label = "Đang tải…",
  hint,
  hintDelayMs = 10_000,
  variant = "panel",
  className,
}: {
  label?: string;
  hint?: string;
  hintDelayMs?: number;
  variant?: "panel" | "page";
  className?: string;
}) {
  const [showHint, setShowHint] = useState(hintDelayMs <= 0);

  useEffect(() => {
    if (!hint || hintDelayMs <= 0) return;
    const t = window.setTimeout(() => setShowHint(true), hintDelayMs);
    return () => window.clearTimeout(t);
  }, [hint, hintDelayMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        variant === "page" && "min-h-[60svh]",
        className
      )}
    >
      <LoaderCircle
        aria-hidden
        className="text-muted-foreground size-6 animate-spin"
      />
      <p className="text-muted-foreground text-sm">{label}</p>
      {hint && showHint && (
        <p className="text-muted-foreground max-w-sm text-xs">{hint}</p>
      )}
    </div>
  );
}

LoadingState.displayName = "LoadingState";
