import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/** Khung tóm tắt nhãn — giá trị trong hộp thoại (nền nhạt, viền mảnh). */
export function SummaryBox({
  rows,
  className,
}: {
  rows: { label: ReactNode; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-surface-subtle px-3 py-2.5 text-sm",
        className
      )}
    >
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className="text-right font-medium text-foreground">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
