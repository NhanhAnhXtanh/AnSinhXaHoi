import { ChevronDown, FunnelX, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { ALL, type ListFilters } from "./filters";
import { STATUS_META, STATUS_OPTIONS, type DisplayStatus } from "./model";

/** Số điều kiện đang đặt trong "Bộ lọc khác". */
function moreFilterCount(f: ListFilters): number {
  return f.statuses.length + (f.templateSet !== ALL ? 1 : 0) + (f.templateVersion !== ALL ? 1 : 0);
}

/** Chip điều kiện đang lọc — bo rounded-md (nguyên tắc: chip lọc bo 8). */
function FilterChip({ children, onRemove, label }: { children: ReactNode; onRemove: () => void; label: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-md border bg-surface-subtle ps-2 pe-1 text-xs">
      {children}
      <button
        type="button"
        aria-label={`Bỏ điều kiện ${label}`}
        className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

/**
 * Thanh lọc trong panel bảng (Figma 309:14416 / 309:21351):
 * [Tìm ……] [Kỳ: Tất cả các kỳ] [Bộ lọc khác] [Làm mới]
 * và dòng chip điều kiện đang lọc + Xoá lọc.
 */
export function ListToolbar({
  filters,
  onChange,
  onClear,
  periods,
  templateSets,
  templateVersions,
  refreshing,
  onRefresh,
  hasQuickFilter,
}: {
  filters: ListFilters;
  onChange: (next: ListFilters) => void;
  onClear: () => void;
  periods: string[];
  templateSets: string[];
  templateVersions: string[];
  refreshing: boolean;
  onRefresh: () => void;
  hasQuickFilter: boolean;
}) {
  const set = <K extends keyof ListFilters>(key: K, value: ListFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleStatus = (s: DisplayStatus, on: boolean) =>
    set("statuses", on ? [...filters.statuses, s] : filters.statuses.filter((x) => x !== s));

  const moreCount = moreFilterCount(filters);
  const hasChips = filters.period !== ALL || moreCount > 0;
  const canClear = hasChips || filters.search.trim() !== "" || hasQuickFilter;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Tìm theo kỳ báo cáo..."
            aria-label="Tìm theo kỳ báo cáo"
            className="ps-9"
          />
        </div>

        <Select value={filters.period} onValueChange={(v) => set("period", v)}>
          <SelectTrigger className="w-60" aria-label="Lọc theo kỳ">
            <span className="text-muted-foreground">Kỳ:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tất cả các kỳ</SelectItem>
            {periods.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline">
              <SlidersHorizontal />
              Bộ lọc khác
              {moreCount > 0 && (
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums">
                  {moreCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-80 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Trạng thái</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Chọn trạng thái"
                    className="flex min-h-9 cursor-default items-center gap-1 rounded-md border border-input bg-card px-2 py-1 shadow-e1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <div className="flex flex-1 flex-wrap gap-1">
                      {filters.statuses.length === 0 ? (
                        <span className="px-1 text-sm text-muted-foreground">Tất cả trạng thái</span>
                      ) : (
                        filters.statuses.map((s) => (
                          <FilterChip key={s} label={STATUS_META[s].label} onRemove={() => toggleStatus(s, false)}>
                            {STATUS_META[s].label}
                          </FilterChip>
                        ))
                      )}
                    </div>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                  {STATUS_OPTIONS.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s}
                      checked={filters.statuses.includes(s)}
                      onCheckedChange={(on) => toggleStatus(s, on === true)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {STATUS_META[s].label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Bộ biểu mẫu</Label>
              <Select value={filters.templateSet} onValueChange={(v) => set("templateSet", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả bộ biểu mẫu</SelectItem>
                  {templateSets.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Phiên bản biểu mẫu</Label>
              <Select value={filters.templateVersion} onValueChange={(v) => set("templateVersion", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả phiên bản</SelectItem>
                  {templateVersions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Làm mới" onClick={onRefresh}>
              <RefreshCw className={cn(refreshing && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Làm mới</TooltipContent>
        </Tooltip>
      </div>

      {(hasChips || canClear) && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.period !== ALL && (
            <FilterChip label={`Kỳ ${filters.period}`} onRemove={() => set("period", ALL)}>
              Kỳ: {filters.period}
            </FilterChip>
          )}
          {filters.statuses.map((s) => (
            <FilterChip key={s} label={STATUS_META[s].label} onRemove={() => toggleStatus(s, false)}>
              Trạng thái: {STATUS_META[s].label}
            </FilterChip>
          ))}
          {filters.templateSet !== ALL && (
            <FilterChip label={filters.templateSet} onRemove={() => set("templateSet", ALL)}>
              Bộ biểu mẫu: {filters.templateSet}
            </FilterChip>
          )}
          {filters.templateVersion !== ALL && (
            <FilterChip label={filters.templateVersion} onRemove={() => set("templateVersion", ALL)}>
              {filters.templateVersion}
            </FilterChip>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            <FunnelX />
            Xoá lọc
          </Button>
        </div>
      )}
    </div>
  );
}
