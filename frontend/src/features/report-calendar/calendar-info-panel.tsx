import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Lock } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";

import {
  KIND_DESCRIPTIONS,
  KIND_LABELS,
  KIND_ORDER,
  type PeriodKind,
} from "./model";

export type CalendarFormValues = {
  deadlineDays: string;
  kinds: PeriodKind[];
  /** Hạn nộp sửa tay theo khoá (loại kỳ, số thứ tự) — `slotKey` — giá trị yyyy-MM-dd. */
  overrides: Record<string, string>;
};

function FieldHint({ children }: { children: ReactNode }) {
  const { error } = useFormField();
  if (error) return null;
  return <p className="text-muted-foreground text-xs leading-4">{children}</p>;
}

const LABEL_CLASS = "data-[error=true]:text-foreground";
const MESSAGE_CLASS = "text-destructive-text text-xs leading-4";

/**
 * Panel trái "Thông tin lịch" (Figma 310:46295 / 310:66835): Năm, Hạn nộp
 * (ngày), bốn thẻ Loại kỳ cần sinh cùng chiều cao.
 */
export function CalendarInfoPanel({
  form,
  mode,
  year,
  yearOptions,
  onYearChange,
  locked,
  readOnly = false,
}: {
  form: UseFormReturn<CalendarFormValues>;
  mode: "create" | "view";
  year: number;
  /** Năm chưa có lịch, cho ô Năm khi tạo mới. */
  yearOptions: number[];
  onYearChange: (year: number) => void;
  /** Loại kỳ đã gán cho đơn vị — không bỏ chọn được. */
  locked: Set<PeriodKind>;
  /** Người chỉ có quyền xem: mọi ô chỉ đọc. */
  readOnly?: boolean;
}) {
  const kinds = form.watch("kinds");

  function selectAll() {
    form.setValue("kinds", [...KIND_ORDER], { shouldDirty: true });
  }

  return (
    <section className="bg-card text-card-foreground border-border flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-e1 lg:self-start">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base leading-6 font-semibold">Thông tin lịch</h2>
      </header>

      <Form {...form}>
        <div className="flex flex-col gap-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "view" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="calendar-year">Năm</Label>
                <Input
                  id="calendar-year"
                  value={year}
                  readOnly
                  disabled
                  className="bg-muted text-muted-foreground disabled:opacity-100"
                />
                <p className="text-muted-foreground text-xs leading-4">
                  Đã lưu nên không đổi được.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="calendar-year">
                  Năm{" "}
                  <span aria-hidden className="text-destructive">
                    *
                  </span>
                </Label>
                <Select
                  value={String(year)}
                  onValueChange={(v) => onYearChange(Number(v))}
                >
                  <SelectTrigger id="calendar-year" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs leading-4">
                  Năm cần lập lịch. Mỗi năm chỉ có một lịch.
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="deadlineDays"
              render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel className={LABEL_CLASS}>
                    Hạn nộp báo cáo (ngày){" "}
                    <span aria-hidden className="text-destructive">
                      *
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={readOnly}
                      inputMode="numeric"
                      autoComplete="off"
                      className="tabular-nums"
                      onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                    />
                  </FormControl>
                  <FieldHint>Số ngày sau khi hết kỳ, từ 1 đến 365.</FieldHint>
                  <FormMessage className={MESSAGE_CLASS} />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="kinds"
            render={({ field }) => (
              <FormItem className="gap-3">
                <div className="flex items-center justify-between gap-2">
                  <FormLabel className={cn(LABEL_CLASS, "text-sm font-medium")}>
                    Loại kỳ cần sinh
                  </FormLabel>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0"
                      onClick={selectAll}
                      disabled={kinds.length === KIND_ORDER.length}
                    >
                      Chọn tất cả
                    </Button>
                  )}
                </div>
                <div role="group" aria-label="Loại kỳ cần sinh" className="grid auto-rows-fr gap-4 sm:grid-cols-2">
                  {KIND_ORDER.map((k) => {
                    const checked = field.value.includes(k);
                    const isLocked = locked.has(k) && checked;
                    const id = `kind-${k}`;
                    return (
                      <label
                        key={k}
                        htmlFor={id}
                        title={isLocked ? "Đã gán cho đơn vị, không bỏ chọn được" : undefined}
                        className={cn(
                          "flex h-full flex-col gap-1 rounded-lg border px-4 py-3 transition-colors",
                          isLocked
                            ? "border-border bg-surface-subtle"
                            : checked
                              ? "border-primary bg-surface-subtle cursor-pointer"
                              : "border-border bg-card hover:bg-accent/40 cursor-pointer"
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <Checkbox
                            id={id}
                            checked={checked}
                            disabled={isLocked || readOnly}
                            className="disabled:opacity-100"
                            onCheckedChange={(next) =>
                              field.onChange(
                                next === true
                                  ? KIND_ORDER.filter((x) => x === k || field.value.includes(x))
                                  : field.value.filter((x) => x !== k)
                              )
                            }
                          />
                          {KIND_LABELS[k]}
                        </span>
                        <span className="text-muted-foreground ps-6 text-xs leading-4">
                          {KIND_DESCRIPTIONS[k]}
                        </span>
                        {isLocked && (
                          <span className="text-muted-foreground flex items-center gap-1 ps-6 text-xs leading-4">
                            <Lock aria-hidden className="size-3" />
                            Đã gán cho đơn vị
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {field.value.length === 0 && (
                  <p className="text-warning-text text-xs leading-4">
                    Hãy chọn ít nhất một loại kỳ cần sinh.
                  </p>
                )}
                <FormMessage className={MESSAGE_CLASS} />
              </FormItem>
            )}
          />
        </div>
      </Form>
    </section>
  );
}
