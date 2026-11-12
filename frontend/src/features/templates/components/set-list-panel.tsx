import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";

import { EmptyState, formatDate } from "@/shared/components/asxh";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

import type { TemplateSet } from "../types";
import { includesFolded } from "@/shared/lib/fold-vi";

/**
 * Cột trái của Bộ biểu mẫu: tiêu đề + số bộ, ô tìm, danh sách thẻ bộ mẫu
 * (tên + "N biểu · cập nhật dd/MM/yyyy"); thẻ đang chọn viền màu chính.
 */
export function SetListPanel({
  sets,
  formCount,
  selectedId,
  onSelect,
  className,
}: {
  sets: TemplateSet[];
  formCount: (setId: string) => number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    if (!query.trim()) return sets;
    return sets.filter((s) => includesFolded(s.name, query));
  }, [sets, query]);

  return (
    <section
      aria-label="Danh sách bộ mẫu"
      className={cn(
        "bg-card flex min-h-0 flex-col overflow-hidden rounded-lg border shadow-e1",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold">Danh sách bộ mẫu</h2>
        <span className="text-muted-foreground text-xs">{sets.length} bộ</span>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            value={query}
            placeholder="Tìm bộ mẫu…"
            aria-label="Tìm bộ mẫu"
            className="pl-9"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-3">
        {shown.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Không tìm thấy bộ mẫu"
            description="Thử tìm bằng từ khác."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((set) => {
              const selected = set.id === selectedId;
              return (
                <li key={set.id}>
                  <button
                    type="button"
                    aria-current={selected || undefined}
                    onClick={() => onSelect(set.id)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left",
                      "transition-colors duration-150 outline-none",
                      "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                      selected
                        ? "border-primary bg-surface-subtle"
                        : "bg-card hover:bg-surface-subtle"
                    )}
                  >
                    <span className="w-full truncate text-sm leading-5 font-semibold">
                      {set.name}
                    </span>
                    <span className="text-muted-foreground text-xs leading-4">
                      {formCount(set.id)} biểu · cập nhật {formatDate(set.updatedAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
