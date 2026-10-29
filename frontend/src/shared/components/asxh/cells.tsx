import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/** Ô bảng hai dòng: dòng chính đậm vừa, dòng phụ nhỏ xám. */
export function TwoLineCell({
  primary,
  secondary,
  className,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <span className="text-foreground truncate text-sm leading-5 font-medium">
        {primary}
      </span>
      {secondary && (
        <span className="text-muted-foreground truncate text-xs leading-4">
          {secondary}
        </span>
      )}
    </div>
  );
}

TwoLineCell.displayName = "TwoLineCell";

/** Ô tiến độ: thanh 72px cao 6px + chữ "6/10 biểu". */
export function ProgressCell({
  done,
  total,
  unit = "biểu",
  className,
}: {
  done: number;
  total: number;
  /** Đơn vị đếm sau con số; mặc định "biểu". Truyền "" để bỏ. */
  unit?: string;
  className?: string;
}) {
  const pct =
    total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="bg-accent relative h-1.5 w-18 shrink-0 overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-muted-foreground text-xs leading-4 font-medium whitespace-nowrap tabular-nums">
        {done}/{total}
        {unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

ProgressCell.displayName = "ProgressCell";
