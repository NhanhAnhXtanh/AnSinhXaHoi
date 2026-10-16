import { useMemo, useState } from "react";
import { Building2, Check, ChevronDown, Search } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Separator } from "@/shared/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import type { Unit } from "./fixtures";

/**
 * Ô "Phạm vi": Toàn tỉnh · Khối xã · Khối huyện, hoặc một đơn vị cụ thể (gõ để
 * tìm). Chỉ liệt kê đơn vị đã có phiếu được duyệt trong kỳ.
 */
export function ScopePicker({
  value,
  onChange,
  units,
  disabled,
  disabledReason,
}: {
  value: string;
  onChange: (scope: string) => void;
  /** Đơn vị có phiếu được duyệt trong kỳ. */
  units: Unit[];
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const huyen = units.filter((u) => u.block === "huyen").length;
  const xa = units.filter((u) => u.block === "xa").length;

  const groups = [
    { key: "tinh", label: "Toàn tỉnh", count: units.length },
    ...(xa > 0 && huyen > 0
      ? [
          { key: "khoi-xa", label: "Khối xã", count: xa },
          { key: "khoi-huyen", label: "Khối huyện", count: huyen },
        ]
      : []),
  ];

  const label =
    groups.find((g) => g.key === value)?.label ??
    units.find((u) => u.id === value)?.name ??
    "Toàn tỉnh";

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    return q ? units.filter((u) => u.name.toLocaleLowerCase("vi").includes(q)) : units;
  }, [units, query]);

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
    setQuery("");
  };

  const trigger = (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className="w-55 justify-between"
      aria-label={`Phạm vi: ${label}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Building2 aria-hidden className="text-muted-foreground" />
        <span className="truncate">Phạm vi: {label}</span>
      </span>
      <ChevronDown aria-hidden className="text-muted-foreground" />
    </Button>
  );

  if (disabled) {
    return disabledReason ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex rounded-md outline-none">
            {trigger}
          </span>
        </TooltipTrigger>
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    ) : (
      trigger
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1">
        <div role="listbox" aria-label="Phạm vi tổng hợp" className="flex flex-col">
          {groups.map((g) => (
            <ScopeOption
              key={g.key}
              selected={value === g.key}
              onSelect={() => pick(g.key)}
              label={`${g.label} · ${g.count} đơn vị`}
            />
          ))}
        </div>
        <Separator className="my-1" />
        <div className="relative px-1 py-1">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gõ để tìm đơn vị"
            aria-label="Tìm đơn vị"
            className="h-8 ps-8"
          />
        </div>
        <div
          role="listbox"
          aria-label="Đơn vị"
          className="flex max-h-60 flex-col overflow-y-auto"
        >
          {filtered.length === 0 && (
            <p className="text-muted-foreground px-2 py-4 text-center text-sm">
              Không có đơn vị nào khớp.
            </p>
          )}
          {filtered.map((u) => (
            <ScopeOption
              key={u.id}
              selected={value === u.id}
              onSelect={() => pick(u.id)}
              label={u.name}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ScopeOption({
  selected,
  onSelect,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-sm",
        "outline-none hover:bg-accent focus-visible:bg-accent",
        selected && "bg-accent font-medium"
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {selected && <Check aria-hidden className="size-4" />}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
