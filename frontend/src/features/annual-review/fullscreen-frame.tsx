import { useEffect } from "react";
import type { ReactNode } from "react";
import { Maximize, Minimize } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

/**
 * Khung bọc thẻ làm việc: bình thường lấp chỗ của nó trong trang; bật toàn màn
 * hình thì phủ kín cửa sổ. Esc để thu nhỏ lại.
 */
export function FullscreenFrame({
  full,
  onExit,
  children,
}: {
  full: boolean;
  onExit: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full, onExit]);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        full && "bg-background fixed inset-0 z-40 p-4"
      )}
    >
      {children}
    </div>
  );
}

/** Nút bật / tắt toàn màn hình ở mép phải hàng tab biểu. */
export function FullscreenButton({
  full,
  onToggle,
}: {
  full: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={onToggle}
      aria-label={full ? "Thu nhỏ (Esc)" : "Toàn màn hình"}
      title={full ? "Thu nhỏ (Esc)" : "Toàn màn hình"}
    >
      {full ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
    </Button>
  );
}
