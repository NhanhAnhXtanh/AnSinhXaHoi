import { SlidersHorizontal } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";

import { STATUS_META, STATUS_ORDER, type ReviewStatus } from "../model";

export type FilterOption = { id: string; name: string };

export const ALL = "all";

export type MoreFilterValue = {
  statuses: ReviewStatus[];
  /** Id đơn vị cha (huyện / thành phố), hoặc ALL */
  district: string;
  /** Id bộ biểu mẫu, hoặc ALL */
  templateSet: string;
};

export const EMPTY_MORE_FILTERS: MoreFilterValue = {
  statuses: [],
  district: ALL,
  templateSet: ALL,
};

export function countMoreFilters(v: MoreFilterValue): number {
  return v.statuses.length + (v.district !== ALL ? 1 : 0) + (v.templateSet !== ALL ? 1 : 0);
}

/** Nút "Bộ lọc khác": Trạng thái (chọn nhiều), Huyện / thành phố, Bộ biểu mẫu. */
export function MoreFilters({
  value,
  onChange,
  districts,
  templateSets,
}: {
  value: MoreFilterValue;
  onChange: (next: MoreFilterValue) => void;
  districts: FilterOption[];
  templateSets: FilterOption[];
}) {
  const active = countMoreFilters(value);

  const toggleStatus = (s: ReviewStatus, on: boolean) => {
    const set = new Set(value.statuses);
    if (on) set.add(s);
    else set.delete(s);
    onChange({ ...value, statuses: STATUS_ORDER.filter((x) => set.has(x)) });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline">
          <SlidersHorizontal />
          Bộ lọc khác
          {active > 0 && (
            <Badge variant="default" className="ms-0.5 h-5 min-w-5 justify-center px-1.5">
              {active}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Trạng thái</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "border-input bg-card hover:bg-accent/40 shadow-e1 flex min-h-9 w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-sm",
                  "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]"
                )}
              >
                {value.statuses.length === 0 ? (
                  <span className="text-muted-foreground px-1">Tất cả trạng thái</span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {value.statuses.map((s) => (
                      <span
                        key={s}
                        className="bg-surface-subtle inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium"
                      >
                        {STATUS_META[s].label}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
              {STATUS_ORDER.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={value.statuses.includes(s)}
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
          <Label>Huyện / thành phố</Label>
          <Select value={value.district} onValueChange={(district) => onChange({ ...value, district })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả các huyện</SelectItem>
              {districts.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Bộ biểu mẫu</Label>
          <Select
            value={value.templateSet}
            onValueChange={(templateSet) => onChange({ ...value, templateSet })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả bộ biểu mẫu</SelectItem>
              {templateSets.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
