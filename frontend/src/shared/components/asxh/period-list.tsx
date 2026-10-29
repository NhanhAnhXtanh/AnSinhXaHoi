import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { StatusBadge } from "@/shared/components/asxh/status-badge";
import type { StatusTone } from "@/shared/components/asxh/status-badge";
import { cn } from "@/shared/lib/utils";

export type PeriodKind = "thang" | "quy" | "6thang" | "nam";

export type PeriodItem = {
  id: string;
  name: string;
  /** Khoảng thời gian, đã viết sẵn: "01/10 – 31/12/2026". */
  range: string;
  kind: PeriodKind;
  tone: StatusTone;
  statusLabel: string;
};

const KIND_CHIPS: { key: PeriodKind | "all"; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "thang", label: "Tháng" },
  { key: "quy", label: "Quý" },
  { key: "6thang", label: "6 tháng" },
  { key: "nam", label: "Năm" },
];

/**
 * Panel danh sách kỳ ở cột trái (Thiết lập & điều hành, Tổng hợp).
 *
 * Đầu panel: tiêu đề + số kỳ; hàng chip loại kỳ chia đều (bo rounded-md,
 * không phải viên thuốc); thân là danh sách kỳ tự cuộn — mỗi dòng tên kỳ,
 * khoảng thời gian và badge trạng thái; dòng đang chọn nền accent có vạch
 * primary bên trái.
 */
export function PeriodList({
  periods,
  selectedId,
  onSelect,
  title = "Kỳ báo cáo",
  empty,
  className,
}: {
  periods: PeriodItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  title?: string;
  /** Hiện thay danh sách khi không có kỳ nào (vd. EmptyState). */
  empty?: ReactNode;
  className?: string;
}) {
  const [kind, setKind] = useState<PeriodKind | "all">("all");

  const visible = useMemo(
    () => (kind === "all" ? periods : periods.filter((p) => p.kind === kind)),
    [periods, kind]
  );

  return (
    <section
      className={cn(
        "bg-card text-card-foreground flex h-full min-h-0 flex-col overflow-hidden",
        "rounded-lg border shadow-e1",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3">
        <h2 className="text-base leading-6 font-semibold">{title}</h2>
        <span className="text-muted-foreground text-[13px] leading-5">
          {visible.length} kỳ
        </span>
      </div>

      <div
        role="group"
        aria-label="Loại kỳ"
        className="flex gap-1 border-b px-4 pb-3.5"
      >
        {KIND_CHIPS.map((chip) => {
          const active = chip.key === kind;
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              onClick={() => setKind(chip.key)}
              className={cn(
                "h-7 min-w-0 flex-1 basis-0 truncate rounded-md px-1 text-xs leading-5 font-medium",
                "transition-colors duration-150 outline-none",
                "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-accent border"
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {periods.length === 0 && empty ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {empty}
        </div>
      ) : (
        <div
          role="listbox"
          aria-label={title}
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
        >
          {visible.length === 0 && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              Không có kỳ nào thuộc loại này.
            </p>
          )}
          {visible.map((p) => {
            const selected = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(p.id)}
                className={cn(
                  "relative flex min-h-14 w-full shrink-0 items-center justify-between gap-2",
                  "rounded-md py-2 ps-3.5 pe-2.5 text-left",
                  "transition-colors duration-150 outline-none",
                  "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  selected ? "bg-accent" : "hover:bg-accent/60"
                )}
              >
                {selected && (
                  <span
                    aria-hidden
                    className="bg-primary absolute top-1/2 left-0 h-7 w-0.75 -translate-y-1/2 rounded-sm"
                  />
                )}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-foreground truncate text-sm leading-5 font-medium">
                    {p.name}
                  </span>
                  <span className="text-muted-foreground truncate text-xs leading-4">
                    {p.range}
                  </span>
                </span>
                <StatusBadge tone={p.tone} className="shrink-0">
                  {p.statusLabel}
                </StatusBadge>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

PeriodList.displayName = "PeriodList";
