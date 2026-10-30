import { useLayoutEffect, useRef, useState } from "react";
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

/** Khoảng cách giữa các tab và giữa hàng tab với nút gom (`gap-1`). */
const GAP_PX = 4;

function tabClass(selected: boolean) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-1 rounded-md px-3 py-1.5",
    "text-sm leading-4.25 whitespace-nowrap",
    "transition-colors duration-150 outline-none",
    "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    selected
      ? "bg-primary text-primary-foreground font-semibold"
      : "text-muted-foreground hover:bg-accent hover:text-foreground font-medium"
  );
}

function DoneMark({ selected }: { selected: boolean }) {
  return (
    <Check
      aria-label="Đã xong"
      strokeWidth={2.5}
      className={cn("size-3.5", selected ? "text-primary-foreground" : "text-success-text")}
    />
  );
}

/**
 * Chọn các tab hiện trên hàng: đủ chỗ thì hiện hết; tràn thì chừa chỗ cho nút
 * gom, giữ tab đang chọn, rồi lấp các tab khác theo thứ tự cho tới khi hết chỗ.
 * Trả về tập key được hiện.
 */
function pickVisible(
  tabs: SheetTab[],
  value: string,
  widths: number[],
  available: number,
  overflowWidth: number
): Set<string> {
  const total = widths.reduce((sum, w) => sum + w, 0) + GAP_PX * Math.max(0, tabs.length - 1);
  if (total <= available) return new Set(tabs.map((t) => t.key));

  let budget = available - overflowWidth - GAP_PX;
  const shown = new Set<string>();
  const selectedIndex = tabs.findIndex((t) => t.key === value);
  if (selectedIndex >= 0) {
    shown.add(value);
    budget -= widths[selectedIndex] + GAP_PX;
  }
  for (let i = 0; i < tabs.length; i++) {
    if (i === selectedIndex) continue;
    const need = widths[i] + GAP_PX;
    if (need > budget) break;
    shown.add(tabs[i].key);
    budget -= need;
  }
  return shown;
}

function sameKeys(a: Set<string> | null, b: Set<string> | null) {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const k of b) if (!a.has(k)) return false;
  return true;
}

/**
 * Hàng tab biểu ở chân thẻ phiếu: tab đang chọn nền primary; biểu đã xong có
 * dấu tích xanh. Hàng hiện mọi tab vừa bề rộng; chỉ khi tràn thì phần không
 * vừa mới gom vào nút "Thêm N biểu" mở danh sách, tab đang chọn luôn nằm trong
 * hàng hiện. Bề rộng đo lại mỗi khi khung đổi cỡ.
 * `trailing` nằm sát mép phải (vd. nút toàn màn hình).
 */
export function SheetTabs({
  tabs,
  value,
  onChange,
  trailing,
  overflowLabel = (n) => `Thêm ${n} biểu`,
  className,
}: {
  tabs: SheetTab[];
  value: string;
  onChange: (k: string) => void;
  trailing?: ReactNode;
  /** Chữ trên nút gom tab tràn; mặc định "Thêm N biểu". */
  overflowLabel?: (hiddenCount: number) => string;
  className?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  // null = chưa đo được (khung chưa có bề rộng): hiện hết.
  const [shownKeys, setShownKeys] = useState<Set<string> | null>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const update = () => {
      const items = Array.from(measure.children) as HTMLElement[];
      const overflowButton = items.pop();
      const available = row.clientWidth;
      const next =
        available > 0
          ? pickVisible(
              tabs,
              value,
              items.map((el) => el.getBoundingClientRect().width),
              available,
              overflowButton?.getBoundingClientRect().width ?? 0
            )
          : null;
      setShownKeys((prev) => (sameKeys(prev, next) ? prev : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [tabs, value]);

  const visible = shownKeys ? tabs.filter((t) => shownKeys.has(t.key)) : tabs;
  const hidden = shownKeys ? tabs.filter((t) => !shownKeys.has(t.key)) : [];

  return (
    <div
      className={cn("flex w-full min-w-0 items-center justify-between gap-2", className)}
    >
      <div ref={rowRef} className="relative flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {/* Bản sao vô hình của mọi tab (chữ đậm như tab đang chọn để đo dư) và
            của nút gom, chỉ để đo bề rộng. */}
        <div
          ref={measureRef}
          aria-hidden
          className="pointer-events-none invisible absolute top-0 left-0 flex items-center gap-1"
        >
          {tabs.map((tab) => (
            <span key={tab.key} className={tabClass(true)}>
              {tab.label}
              {tab.done && <DoneMark selected />}
            </span>
          ))}
          <Button type="button" variant="outline" tabIndex={-1} className="shrink-0">
            <List aria-hidden />
            {overflowLabel(tabs.length)}
          </Button>
        </div>

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
                className={tabClass(selected)}
              >
                {tab.label}
                {tab.done && <DoneMark selected={selected} />}
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
