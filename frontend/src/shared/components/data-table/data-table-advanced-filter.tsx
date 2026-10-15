"use client";

import { useEffect, useMemo, useState } from "react";
import type { BaseRecord, CrudOperators, HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { SlidersHorizontal, X } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Separator } from "@/shared/ui/separator";
import {
  CRUD_OPERATOR_LABELS,
  DataTableFilterOperatorSelect,
} from "@/shared/components/data-table/data-table-filter";
import { cn } from "@/shared/lib/utils";

export type AdvancedFilterFieldType = "text" | "number" | "select";

/**
 * Only these operators survive the simple-rest provider AND this API:
 *   ne / gte / lte -> field_ne= / field_gte= / field_lte=
 *   contains       -> field_like=
 *   anything else  -> field= (plain equals)
 * So gt, lt, startswith, endswith and between would silently behave as equals,
 * and `in` gets serialised as field=a,b which matches nothing. Offer only the
 * operators that actually filter.
 */
const OPERATORS_BY_TYPE: Record<AdvancedFilterFieldType, CrudOperators[]> = {
  text: ["contains", "eq", "ne"],
  number: ["eq", "ne", "gte", "lte"],
  select: ["eq", "ne"],
};

export type AdvancedFilterField = {
  /**
   * Column id, which is also the field name sent to the data provider.
   */
  field: string;
  label: string;
  type: AdvancedFilterFieldType;
  /**
   * Overrides the operator list derived from `type`.
   */
  operators?: CrudOperators[];
  defaultOperator?: CrudOperators;
  /**
   * Required for `type: "select"`.
   */
  options?: { label: string; value: string }[];
  placeholder?: string;
  /**
   * Hint rendered under the input, e.g. to explain a backend limitation.
   */
  hint?: string;
};

/**
 * A filter entry as stored by TanStack. Refine's `columnFiltersToCrudFilters`
 * reads the extra `operator` key, so the whole filter state (quick filter,
 * advanced panel, column headers) can live in `columnFilters` and stay in sync
 * instead of fighting over `refineCore.setFilters`.
 */
type FilterEntry = { id: string; value: unknown; operator?: CrudOperators };

function readEntries(columnFilters: ColumnFiltersState): FilterEntry[] {
  return columnFilters as unknown as FilterEntry[];
}

function operatorsFor(field: AdvancedFilterField): CrudOperators[] {
  return field.operators ?? OPERATORS_BY_TYPE[field.type];
}

function defaultOperatorFor(field: AdvancedFilterField): CrudOperators {
  return field.defaultOperator ?? operatorsFor(field)[0];
}

function operatorLabel(operator: CrudOperators): string {
  return (
    CRUD_OPERATOR_LABELS[operator as Exclude<CrudOperators, "or" | "and">]
      ?.defaultLabel ?? String(operator)
  );
}

type DraftEntry = { operator: CrudOperators; value: string };
type Draft = Record<string, DraftEntry>;

export type DataTableAdvancedFilterProps<TData extends BaseRecord> = {
  table: UseTableReturnType<TData, HttpError>;
  fields: AdvancedFilterField[];
  className?: string;
};

export function DataTableAdvancedFilter<TData extends BaseRecord>({
  table,
  fields,
  className,
}: DataTableAdvancedFilterProps<TData>) {
  const { setColumnFilters, getState } = table.reactTable;
  const entries = readEntries(getState().columnFilters);

  const activeCount = fields.filter((field) =>
    entries.some((entry) => entry.id === field.field)
  ).length;

  const buildDraft = (): Draft => {
    const draft: Draft = {};
    for (const field of fields) {
      const active = entries.find((entry) => entry.id === field.field);
      draft[field.field] = {
        operator: active?.operator ?? defaultOperatorFor(field),
        value: active?.value != null ? String(active.value) : "",
      };
    }
    return draft;
  };

  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(buildDraft);

  // Re-read on open so edits made elsewhere (chips, column headers) show up.
  useEffect(() => {
    if (isOpen) setDraft(buildDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [isOpen]);

  const patch = (field: string, next: Partial<DraftEntry>) => {
    setDraft((prev) => ({ ...prev, [field]: { ...prev[field], ...next } }));
  };

  const handleApply = () => {
    const owned = fields.map((field) => field.field);

    setColumnFilters((prev) => {
      const others = readEntries(prev).filter(
        (entry) => !owned.includes(entry.id)
      );
      const next = fields.flatMap((field) => {
        const entry = draft[field.field];
        const value = entry?.value?.trim();
        if (!value) return [];
        return [{ id: field.field, operator: entry.operator, value }];
      });
      return [...others, ...next] as ColumnFiltersState;
    });

    setIsOpen(false);
  };

  const handleClear = () => {
    const owned = fields.map((field) => field.field);
    setColumnFilters(
      (prev) =>
        readEntries(prev).filter(
          (entry) => !owned.includes(entry.id)
        ) as ColumnFiltersState
    );
    setDraft(
      Object.fromEntries(
        fields.map((field) => [
          field.field,
          { operator: defaultOperatorFor(field), value: "" },
        ])
      )
    );
    setIsOpen(false);
  };

  const isDraftEmpty = fields.every(
    (field) => !draft[field.field]?.value?.trim()
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("gap-2", className)}>
          <SlidersHorizontal className={cn("h-4", "w-4")} />
          Advanced filter
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className={cn("h-5", "min-w-5", "px-1.5", "rounded-full")}
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className={cn("w-[34rem]", "p-0")}>
        <div
          className={cn("flex", "flex-col", "gap-4", "p-4")}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleApply();
          }}
        >
          {fields.map((field) => {
            const entry = draft[field.field] ?? {
              operator: defaultOperatorFor(field),
              value: "",
            };

            return (
              <div
                key={field.field}
                className={cn(
                  "grid",
                  "grid-cols-[6rem_1fr]",
                  "gap-x-2",
                  "gap-y-1",
                  "items-center"
                )}
              >
                <label
                  className={cn("text-sm", "font-medium", "truncate")}
                  htmlFor={`advanced-filter-${field.field}`}
                >
                  {field.label}
                </label>

                <div className={cn("flex", "gap-2", "items-center")}>
                  <DataTableFilterOperatorSelect
                    value={entry.operator}
                    operators={operatorsFor(field)}
                    onValueChange={(operator) =>
                      patch(field.field, { operator })
                    }
                    triggerClassName={cn("w-32", "shrink-0", "text-xs")}
                    contentClassName={cn("w-48")}
                  />

                  {field.type === "select" ? (
                    <Select
                      value={entry.value}
                      onValueChange={(value) => patch(field.field, { value })}
                    >
                      <SelectTrigger
                        id={`advanced-filter-${field.field}`}
                        className={cn("flex-1")}
                      >
                        <SelectValue placeholder={field.placeholder ?? "Any"} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`advanced-filter-${field.field}`}
                      type={field.type === "number" ? "number" : "text"}
                      className={cn("flex-1")}
                      placeholder={field.placeholder ?? "Any"}
                      value={entry.value}
                      onChange={(event) =>
                        patch(field.field, { value: event.target.value })
                      }
                    />
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Clear ${field.label}`}
                    disabled={!entry.value}
                    className={cn("h-8", "w-8", "shrink-0")}
                    onClick={() => patch(field.field, { value: "" })}
                  >
                    <X className={cn("h-3.5", "w-3.5")} />
                  </Button>
                </div>

                {field.hint && (
                  <p
                    className={cn(
                      "col-start-2",
                      "text-xs",
                      "text-muted-foreground"
                    )}
                  >
                    {field.hint}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        <div className={cn("flex", "items-center", "justify-between", "p-3")}>
          <Button
            variant="ghost"
            size="sm"
            disabled={isDraftEmpty && activeCount === 0}
            className={cn("text-muted-foreground")}
            onClick={handleClear}
          >
            <X className={cn("h-3.5", "w-3.5")} />
            Clear
          </Button>
          <Button size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type DataTableFilterChipsProps<TData extends BaseRecord> = {
  table: UseTableReturnType<TData, HttpError>;
  fields: AdvancedFilterField[];
  /**
   * Label used for the quick-filter entry, which has no field definition.
   */
  searchField?: string;
  searchLabel?: string;
  className?: string;
};

export function DataTableFilterChips<TData extends BaseRecord>({
  table,
  fields,
  searchField = "q",
  searchLabel = "Search",
  className,
}: DataTableFilterChipsProps<TData>) {
  const { setColumnFilters, getState } = table.reactTable;
  const entries = readEntries(getState().columnFilters);

  const chips = useMemo(() => {
    return entries
      .filter((entry) => entry.value != null && entry.value !== "")
      .map((entry) => {
        const field = fields.find((item) => item.field === entry.id);
        const rawValue = String(entry.value);

        if (!field) {
          return {
            id: entry.id,
            label: entry.id === searchField ? searchLabel : entry.id,
            text: rawValue,
          };
        }

        const valueLabel =
          field.type === "select"
            ? field.options?.find((option) => option.value === rawValue)
                ?.label ?? rawValue
            : rawValue;

        return {
          id: entry.id,
          label: field.label,
          text: `${operatorLabel(
            entry.operator ?? "eq"
          ).toLowerCase()} ${valueLabel}`,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries is derived per render
  }, [JSON.stringify(entries), fields, searchField, searchLabel]);

  if (chips.length === 0) return null;

  const removeChip = (id: string) => {
    setColumnFilters(
      (prev) =>
        readEntries(prev).filter(
          (entry) => entry.id !== id
        ) as ColumnFiltersState
    );
  };

  return (
    <div className={cn("flex", "flex-wrap", "items-center", "gap-2", className)}>
      {chips.map((chip) => (
        <Badge
          key={chip.id}
          variant="secondary"
          className={cn("gap-1", "pl-2", "pr-1", "py-1", "font-normal")}
        >
          <span className={cn("text-xs")}>
            <span className={cn("font-medium")}>{chip.label}</span> {chip.text}
          </span>
          <button
            type="button"
            aria-label={`Remove ${chip.label} filter`}
            onClick={() => removeChip(chip.id)}
            className={cn(
              "rounded-sm",
              "p-0.5",
              "text-muted-foreground",
              "hover:text-destructive",
              "transition-colors",
              "cursor-pointer"
            )}
          >
            <X className={cn("h-3", "w-3")} />
          </button>
        </Badge>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className={cn("h-7", "text-xs", "text-muted-foreground")}
        onClick={() => setColumnFilters([])}
      >
        Clear all
      </Button>
    </div>
  );
}

DataTableAdvancedFilter.displayName = "DataTableAdvancedFilter";
DataTableFilterChips.displayName = "DataTableFilterChips";
