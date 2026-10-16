import { useMemo } from "react";
import type { ReactNode } from "react";
import { Check, List } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";

type SheetTab = { key: string; label: string; done?: boolean };

/**
 * Hàng tab biểu ở chân thẻ phiếu: tab đang chọn nền primary; biểu đã xong có
 * dấu tích xanh. Quá `maxVisible` tab thì phần còn lại gom vào nút
 * "Thêm N biểu" mở danh sách; tab đang chọn luôn nằm trong hàng hiện.
 * `trailing` nằm sát mép phải (vd. nút toàn màn hình).
 */
export function SheetTabs({
  tabs,
  value,
  onChange,
  maxVisible = 8,
  trailing,
  overflowLabel = (n) => `Thêm ${n} biểu`,
  className,
}: {
  tabs: SheetTab[];
  value: string;
  onChange: (k: string) => void;
  maxVisible?: number;
  trailing?: ReactNode;
  /** Chữ trên nút gom tab tràn; mặc định "Thêm N biểu". */
  overflowLabel?: (hiddenCount: number) => string;
  className?: string;
}) {
  const { visible, hidden } = useMemo(() => {
    const limit = Math.max(1, maxVisible);
    if (tabs.length <= limit) return { visible: tabs, hidden: [] as SheetTab[] };
    let shown = tabs.slice(0, limit);
    const selectedIndex = tabs.findIndex((t) => t.key === value);
    if (selectedIndex >= limit) {
      shown = [...tabs.slice(0, limit - 1), tabs[selectedIndex]];
    }
    const shownKeys = new Set(shown.map((t) => t.key));
    return { visible: shown, hidden: tabs.filter((t) => !shownKeys.has(t.key)) };
  }, [tabs, value, maxVisible]);

  return (
    <div
      className={cn("flex w-full min-w-0 items-center justify-between gap-2", className)}
    >
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        <div role="tablist" aria-label="Biểu" className="flex items-center gap-1">
          {visible.map((tab) => {
            const selected = tab.key === value;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onChange(tab.key)}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-1 rounded-md px-3 py-1.5",
                  "text-sm leading-4.25 whitespace-nowrap",
                  "transition-colors duration-150 outline-none",
                  "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  selected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground font-medium"
                )}
              >
                {tab.label}
                {tab.done && (
                  <Check
                    aria-label="Đã xong"
                    strokeWidth={2.5}
                    className={cn(
                      "size-3.5",
                      selected ? "text-primary-foreground" : "text-success-text"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        {hidden.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="shrink-0">
                <List aria-hidden />
                {overflowLabel(hidden.length)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              {hidden.map((tab) => (
                <DropdownMenuItem key={tab.key} onSelect={() => onChange(tab.key)}>
                  <span className="flex-1">{tab.label}</span>
                  {tab.done && (
                    <Check
                      aria-label="Đã xong"
                      strokeWidth={2.5}
                      className="text-success-text size-3.5"
                    />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {trailing && (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      )}
    </div>
  );
}

SheetTabs.displayName = "SheetTabs";
