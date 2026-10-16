import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarPlus, CalendarX, Trash } from "lucide-react";
import { toast } from "sonner";

import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  HeaderActions,
  YearSelect,
  useReportYear,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";

import { CalendarInfoPanel, type CalendarFormValues } from "./calendar-info-panel";
import {
  KIND_ORDER,
  addDays,
  generatePeriods,
  type CalendarPeriod,
  type PeriodKind,
  type ReportCalendarData,
} from "./fixtures";
import { PeriodPreviewPanel } from "./period-preview-panel";
import {
  isAssigned,
  lockedKinds,
  removeCalendar,
  saveCalendar,
  useCalendars,
} from "./store";

/** Mặc định khi tạo lịch mới (UC-06): Tháng + Quý + 6 tháng, hạn nộp 5 ngày. */
const DEFAULT_KINDS: PeriodKind[] = ["thang", "quy", "6thang"];
const DEFAULT_DEADLINE_DAYS = 5;

const schema = z.object({
  deadlineDays: z
    .string()
    .trim()
    .min(1, "Hãy nhập số ngày, từ 1 đến 365.")
    .refine((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= 365;
    }, "Hạn nộp phải từ 1 đến 365 ngày."),
  kinds: z.array(z.enum(["thang", "quy", "6thang", "nam"])),
  overrides: z.record(z.string()),
});

function parseDays(text: string): number | null {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 365 ? n : null;
}

/**
 * Các kỳ sẽ có sau khi lưu: kỳ đã có của lịch được giữ nguyên (kể cả trạng
 * thái), loại kỳ mới chọn thì sinh thêm. Kỳ chưa gán cho đơn vị và chưa sửa
 * tay hạn nộp thì tính lại hạn nộp theo số ngày đang nhập.
 */
function buildPeriods(
  year: number,
  calendar: ReportCalendarData | undefined,
  kinds: PeriodKind[],
  days: number,
  overrides: Record<string, string>
): CalendarPeriod[] {
  return KIND_ORDER.filter((k) => kinds.includes(k)).flatMap((kind) => {
    const existing = calendar?.periods.filter((p) => p.kind === kind) ?? [];
    const base = existing.length > 0 ? existing : generatePeriods(year, kind, days);
    return base.map((p) => {
      const manual = overrides[p.id];
      if (manual) return { ...p, deadline: manual, customDeadline: true };
      if (isAssigned(p) || p.customDeadline) return p;
      return { ...p, deadline: addDays(p.to, days) };
    });
  });
}

function defaultsFor(calendar: ReportCalendarData | undefined): CalendarFormValues {
  return {
    deadlineDays: String(calendar?.deadlineDays ?? DEFAULT_DEADLINE_DAYS),
    kinds: calendar ? [...calendar.kinds] : [...DEFAULT_KINDS],
    overrides: {},
  };
}

/**
 * Lịch và kỳ báo cáo (UC-06, UC-07, UC-08). Không có bảng danh sách lịch:
 * năm dùng chung ở đầu trang quyết định lịch nào đang mở.
 *
 * Figma: 310:46295 (lịch đã có), 310:66835 (tạo lịch năm mới), 310:64822
 * (xoá lịch), 310:65333 (năm chưa có lịch).
 */
export function ReportCalendar() {
  const { year, setYear } = useReportYear();
  const calendars = useCalendars();
  const calendar = calendars[year];
  const [creating, setCreating] = useState(false);

  if (calendar) {
    return <CalendarWorkspace key={`view-${year}`} mode="view" year={year} calendar={calendar} />;
  }

  if (creating) {
    return (
      <CalendarWorkspace
        key="create"
        mode="create"
        year={year}
        calendars={calendars}
        onYearChange={setYear}
        onCreated={() => setCreating(false)}
      />
    );
  }

  return (
    <AsxhPage
      title={`Lịch báo cáo năm ${year}`}
      description="Năm này chưa có lịch. Tạo lịch để hệ thống sinh các kỳ báo cáo."
      actions={<YearSelect />}
      fill
    >
      <div className="bg-card border-border flex min-h-0 flex-1 items-center justify-center rounded-lg border p-6 shadow-e1">
        <div className="border-border w-full max-w-xl rounded-lg border border-dashed">
          <EmptyState
            icon={CalendarX}
            title={`Năm ${year} chưa có lịch báo cáo`}
            description="Tạo lịch để hệ thống tự sinh các kỳ tháng, quý, 6 tháng, năm."
            action={
              <Button type="button" onClick={() => setCreating(true)}>
                <CalendarPlus aria-hidden />
                Tạo lịch báo cáo
              </Button>
            }
          />
        </div>
      </div>
    </AsxhPage>
  );
}

function CalendarWorkspace({
  mode,
  year,
  calendar,
  calendars,
  onYearChange,
  onCreated,
}: {
  mode: "create" | "view";
  year: number;
  calendar?: ReportCalendarData;
  /** Chỉ dùng khi tạo mới: để biết năm nào đã có lịch. */
  calendars?: Record<number, ReportCalendarData>;
  onYearChange?: (year: number) => void;
  onCreated?: () => void;
}) {
  const form = useForm<CalendarFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(calendar),
    mode: "onChange",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deadlineDays = form.watch("deadlineDays");
  const kinds = form.watch("kinds");
  const overrides = form.watch("overrides");

  const days = parseDays(deadlineDays);
  const locked = useMemo(() => lockedKinds(calendar), [calendar]);
  const periods = useMemo(
    () => (days === null ? [] : buildPeriods(year, calendar, kinds, days, overrides)),
    [year, calendar, kinds, days, overrides]
  );

  /** BR-06.2: năm nay − 10 đến năm nay + 20, bỏ các năm đã có lịch. */
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const out: number[] = [];
    for (let y = now - 10; y <= now + 20; y++) {
      if (y === year || !calendars?.[y]) out.push(y);
    }
    return out;
  }, [calendars, year]);

  const hasAssigned = (calendar?.periods ?? []).some(isAssigned);

  function save(values: CalendarFormValues) {
    const n = parseDays(values.deadlineDays);
    if (n === null) return;
    const next: ReportCalendarData = {
      year,
      deadlineDays: n,
      kinds: KIND_ORDER.filter((k) => values.kinds.includes(k)),
      periods: buildPeriods(year, calendar, values.kinds, n, values.overrides),
    };
    saveCalendar(next);
    form.reset(defaultsFor(next));

    if (mode === "create") {
      if (next.periods.length === 0) {
        toast.warning(
          `Đã lưu lịch báo cáo năm ${year} nhưng chưa sinh kỳ nào. Hãy chọn ít nhất một loại kỳ cần sinh rồi bấm Lưu lịch.`
        );
      } else {
        toast.success(`Đã tạo lịch báo cáo năm ${year} với ${next.periods.length} kỳ.`);
      }
      onCreated?.();
      return;
    }

    const before = calendar?.periods.length ?? 0;
    const added = next.periods.filter((p) => !calendar?.periods.some((q) => q.id === p.id)).length;
    const removed = before - (next.periods.length - added);
    const parts = [
      added > 0 ? `thêm ${added} kỳ` : null,
      removed > 0 ? `bỏ ${removed} kỳ chưa gán cho đơn vị` : null,
    ].filter(Boolean);
    if (next.periods.length === 0) {
      toast.warning(
        `Đã lưu lịch báo cáo năm ${year} nhưng lịch chưa có kỳ nào. Hãy chọn ít nhất một loại kỳ cần sinh.`
      );
    } else {
      toast.success(
        parts.length > 0
          ? `Đã lưu lịch báo cáo năm ${year}: ${parts.join(", ")}.`
          : `Đã lưu lịch báo cáo năm ${year}.`
      );
    }
  }

  const submit = () => void form.handleSubmit(save)();

  return (
    <AsxhPage
      title={`Lịch báo cáo năm ${year}`}
      description={
        mode === "view"
          ? "Thiết lập các kỳ báo cáo cho cả năm — hệ thống tự sinh kỳ theo loại kỳ đã chọn."
          : "Chọn loại kỳ và hạn nộp, rồi bấm Tạo lịch để hệ thống sinh các kỳ."
      }
      actions={
        <>
          <YearSelect />
          <HeaderActions
            primary={{ label: mode === "view" ? "Lưu lịch" : "Tạo lịch", onClick: submit }}
            items={
              mode === "view"
                ? [
                    {
                      key: "delete",
                      label: "Xoá lịch năm",
                      icon: Trash,
                      destructive: true,
                      disabled: hasAssigned,
                      reason: hasAssigned
                        ? "Đã có kỳ được gán cho đơn vị nên không xoá được."
                        : undefined,
                      onSelect: () => setConfirmDelete(true),
                    },
                  ]
                : undefined
            }
          />
        </>
      }
      fill
    >
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:overflow-visible xl:grid-cols-[35rem_minmax(0,1fr)]">
        <CalendarInfoPanel
          form={form}
          mode={mode}
          year={year}
          yearOptions={yearOptions}
          onYearChange={(y) => onYearChange?.(y)}
          locked={locked}
        />
        <PeriodPreviewPanel
          periods={periods}
          kinds={kinds}
          daysValid={days !== null}
          onDeadlineChange={(id, iso) =>
            form.setValue("overrides", { ...form.getValues("overrides"), [id]: iso }, {
              shouldDirty: true,
            })
          }
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Xoá lịch báo cáo năm ${year}?`}
        description={`Toàn bộ ${calendar?.periods.length ?? 0} kỳ của năm ${year} sẽ bị xoá cùng lịch và không khôi phục được. Nếu có kỳ đã được gán cho đơn vị thì hệ thống sẽ không xoá.`}
        confirmLabel="Xoá lịch năm"
        cancelLabel="Quay lại"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          if (hasAssigned) {
            toast.error(
              `Chưa xoá được lịch năm ${year} vì đã có kỳ được gán cho đơn vị.`
            );
            return;
          }
          removeCalendar(year);
          toast.success(`Đã xoá lịch báo cáo năm ${year}.`);
        }}
      />
    </AsxhPage>
  );
}
