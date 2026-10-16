import { formatNumber } from "@/shared/components/asxh/format";
import { cn } from "@/shared/lib/utils";

/**
 * Hàng thẻ lọc nhanh trên bảng (Tất cả / Cần nhập / Bị trả lại / Đã nộp…).
 *
 * Các thẻ chia đều chiều ngang. Thẻ đang chọn viền primary 2px trên nền
 * surface-subtle; bấm lại thẻ đang chọn là bỏ chọn (`onChange(null)`).
 */
export function QuickFilterCards({
  items,
  value,
  onChange,
  className,
}: {
  items: { key: string; label: string; count: number }[];
  value: string | null;
  onChange: (key: string | null) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Lọc nhanh"
      className={cn("flex flex-wrap gap-4", className)}
    >
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : item.key)}
            className={cn(
              "flex min-w-40 flex-1 basis-0 flex-col items-start gap-1 text-left",
              "rounded-lg border px-5 py-3.5 shadow-e1",
              "transition-colors duration-150 outline-none",
              "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              selected
                ? "border-primary bg-surface-subtle ring-primary ring-1 ring-inset"
                : "bg-card hover:bg-surface-subtle"
            )}
          >
            <span
              className={cn(
                "text-sm leading-5 font-medium",
                selected ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </span>
            <span className="text-foreground text-3xl leading-9 font-bold tabular-nums">
              {formatNumber(item.count)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

QuickFilterCards.displayName = "QuickFilterCards";
