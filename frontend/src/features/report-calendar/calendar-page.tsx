import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCan,
  useCreate,
  useCustom,
  useDataProvider,
  useDelete,
  useInvalidate,
  useList,
  useUpdate,
  useWarnAboutChange,
  type HttpError,
} from "@refinedev/core";
import { CalendarPlus, CalendarX, RefreshCw, Trash, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { API_URL } from "@/shared/api/constants";
import {
  AsxhPage,
  ConfirmDialog,
  EmptyState,
  HeaderActions,
  LoadingState,
  YearSelect,
  useReportYear,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";

import { CalendarInfoPanel, type CalendarFormValues } from "./calendar-info-panel";
import {
  CALENDAR_RESOURCE,
  DEFAULT_DEADLINE_DAYS,
  DEFAULT_KINDS,
  KIND_LABELS,
  PERIOD_RESOURCE,
  apiErrorMessage,
  asArray,
  orderKinds,
  rowsForCalendar,
  rowsForCreate,
  sameKinds,
  slotKey,
  type CalendarPayload,
  type CalendarUpdatePlan,
  type PeriodKind,
  type PeriodPreview,
  type ReportCalendarRecord,
  type ReportPeriodRecord,
} from "./model";
import { PeriodPreviewPanel } from "./period-preview-panel";

const LOAD_ERROR = "Không kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại.";

/** Lịch một năm có tối đa 19 kỳ; 100 là thừa đủ cho một trang. */
const PERIOD_PAGE_SIZE = 100;

const schema = z.object({
  deadlineDays: z
    .string()
    .trim()
    .min(1, "Hãy nhập số ngày, từ 1 đến 365.")
    .refine((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= 365;
    }, "Hạn nộp phải từ 1 đến 365 ngày."),
  kinds: z.array(z.enum(["thang", "quy", "sau_thang", "nam"])),
  overrides: z.record(z.string()),
});

function parseDays(text: string): number | null {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 365 ? n : null;
}

function defaultsFor(calendar: ReportCalendarRecord | undefined): CalendarFormValues {
  return {
    deadlineDays: String(calendar?.deadlineDays ?? DEFAULT_DEADLINE_DAYS),
    kinds: calendar ? orderKinds(calendar.kinds) : [...DEFAULT_KINDS],
    overrides: {},
  };
}

/** Giá trị trễ một nhịp gõ — xem trước gọi máy chủ khi người dùng ngừng gõ. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Lịch và kỳ báo cáo (UC-06, UC-07, UC-08, UC-20, UC-21). Không có bảng danh sách
 * lịch: năm dùng chung ở đầu trang quyết định lịch nào đang mở.
 *
 * Figma: 310:46295 (lịch đã có), 310:66835 (tạo lịch năm mới), 310:64822
 * (xoá lịch), 310:65333 (năm chưa có lịch).
 *
 * API: `GET /api/report_calendars` (mọi lịch — biết năm nào đã có lịch),
 * `GET /api/report_periods?calendar.year=`, `GET /api/report_calendars/preview`,
 * `GET /api/report_calendars/{id}/update_plan`, `POST`/`PATCH`/`DELETE
 * /api/report_calendars`, `PATCH /api/report_periods/{id}` (hạn nộp từng kỳ).
 */
export function ReportCalendar() {
  const { year, setYear } = useReportYear();
  const [creating, setCreating] = useState(false);
  // Người chỉ có quyền xem (vd. cán bộ duyệt): không tạo / sửa / xoá lịch — máy chủ vẫn kiểm lại.
  const { data: canWriteData } = useCan({ resource: CALENDAR_RESOURCE, action: "edit" });
  const { data: canDeleteData } = useCan({ resource: CALENDAR_RESOURCE, action: "delete" });
  const canWrite = canWriteData?.can === true;
  const canDelete = canDeleteData?.can === true;

  const { result, query } = useList<ReportCalendarRecord>({
    resource: CALENDAR_RESOURCE,
    pagination: { currentPage: 1, pageSize: 100 },
    sorters: [{ field: "year", order: "desc" }],
    errorNotification: false,
  });
  const calendars = useMemo(() => result.data ?? [], [result.data]);
  const calendar = calendars.find((c) => c.year === year);
  const takenYears = useMemo(() => new Set(calendars.map((c) => c.year)), [calendars]);

  if (query.isLoading || query.isError) {
    return (
      <AsxhPage
        title={`Lịch báo cáo năm ${year}`}
        description="Thiết lập các kỳ báo cáo cho cả năm — hệ thống tự sinh kỳ theo loại kỳ đã chọn."
        actions={<YearSelect />}
        fill
      >
        <div className="bg-card border-border flex min-h-0 flex-1 flex-col rounded-lg border shadow-e1">
          {query.isLoading ? (
            <LoadingState label="Đang tải lịch báo cáo…" />
          ) : (
            <EmptyState
              icon={TriangleAlert}
              title="Chưa tải được lịch báo cáo"
              description={apiErrorMessage(query.error, LOAD_ERROR)}
              action={
                <Button type="button" variant="outline" onClick={() => void query.refetch()}>
                  <RefreshCw aria-hidden />
                  Thử lại
                </Button>
              }
            />
          )}
        </div>
      </AsxhPage>
    );
  }

  if (calendar) {
    return (
      <CalendarWorkspace
        key={`view-${calendar.id}`}
        mode="view"
        year={year}
        calendar={calendar}
        takenYears={takenYears}
        canWrite={canWrite}
        canDelete={canDelete}
      />
    );
  }

  // UC-06 bước 1: chưa có lịch nào thì mở thẳng form tạo.
  if (canWrite && (creating || calendars.length === 0)) {
    return (
      <CalendarWorkspace
        key="create"
        mode="create"
        year={year}
        takenYears={takenYears}
        onYearChange={setYear}
        onCreated={() => setCreating(false)}
        canWrite={canWrite}
        canDelete={canDelete}
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
            description={
              canWrite
                ? "Tạo lịch để hệ thống tự sinh các kỳ tháng, quý, 6 tháng, năm."
                : "Sở Tài chính chưa lập lịch báo cáo cho năm này."
            }
            action={
              canWrite ? (
                <Button type="button" onClick={() => setCreating(true)}>
                  <CalendarPlus aria-hidden />
                  Tạo lịch báo cáo
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>
    </AsxhPage>
  );
}

/** Những gì một lần bấm Lưu sẽ gửi đi. */
type Prepared = {
  days: number;
  kinds: PeriodKind[];
  /** Hạn nộp sửa tay theo `slotKey`. */
  overrides: Record<string, string>;
};

function CalendarWorkspace({
  mode,
  year,
  calendar,
  takenYears,
  onYearChange,
  onCreated,
  canWrite,
  canDelete,
}: {
  mode: "create" | "view";
  year: number;
  calendar?: ReportCalendarRecord;
  /** Năm đã có lịch — ô Năm khi tạo mới bỏ các năm này. */
  takenYears: Set<number>;
  onYearChange?: (year: number) => void;
  onCreated?: () => void;
  /** Quyền tạo / sửa lịch (gồm hạn nộp từng kỳ). Không có thì cả khung chỉ xem. */
  canWrite: boolean;
  canDelete: boolean;
}) {
  const form = useForm<CalendarFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(calendar),
    mode: "onChange",
  });
  const { setWarnWhen } = useWarnAboutChange();
  const isDirty = form.formState.isDirty;
  useEffect(() => {
    setWarnWhen(isDirty);
    // Đổi năm ở đầu trang thay khung làm việc mà không đổi đường dẫn — khung cũ phải
    // tự gỡ cảnh báo, nếu không lần rời trang sau sẽ hỏi về thay đổi không còn nữa.
    return () => setWarnWhen(false);
  }, [isDirty, setWarnWhen]);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{
    plan: CalendarUpdatePlan;
    prepared: Prepared;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const dataProvider = useDataProvider();
  const invalidate = useInvalidate();
  const { mutateAsync: createCalendar } = useCreate<
    ReportCalendarRecord,
    HttpError,
    CalendarPayload
  >();
  const { mutateAsync: updateCalendar } = useUpdate<
    ReportCalendarRecord,
    HttpError,
    CalendarPayload
  >();
  const { mutateAsync: updatePeriod } = useUpdate<
    ReportPeriodRecord,
    HttpError,
    { deadline: string }
  >();
  const { mutateAsync: deleteCalendar } = useDelete<ReportCalendarRecord>();

  const deadlineDays = form.watch("deadlineDays");
  const kinds = form.watch("kinds");
  const overrides = form.watch("overrides");
  const days = parseDays(deadlineDays);
  const previewDays = useDebouncedValue(days, 300);

  /* Kỳ đã lưu của năm (chỉ khi lịch đã có). */
  const { result: periodsResult, query: periodsQuery } = useList<ReportPeriodRecord>({
    resource: PERIOD_RESOURCE,
    filters: [{ field: "calendar.year", operator: "eq", value: year }],
    pagination: { currentPage: 1, pageSize: PERIOD_PAGE_SIZE },
    errorNotification: false,
    queryOptions: { enabled: mode === "view" },
  });
  const periods = useMemo(
    () => (mode === "view" ? periodsResult.data ?? [] : []),
    [mode, periodsResult.data]
  );

  /* Khung xem trước của máy chủ: cả lịch khi tạo; chỉ loại kỳ mới thêm khi đã có lịch. */
  const existingKinds = useMemo(() => new Set(periods.map((p) => p.kind)), [periods]);
  const previewKinds =
    mode === "create"
      ? orderKinds(kinds)
      : orderKinds(kinds).filter((k) => !existingKinds.has(k));
  const previewEnabled =
    previewDays !== null &&
    previewKinds.length > 0 &&
    (mode === "create" || periodsQuery.isSuccess);

  const { result: previewResult, query: previewQuery } = useCustom({
    url: `${API_URL}/report_calendars/preview`,
    method: "get",
    config: {
      query: {
        year,
        deadlineDays: previewDays ?? DEFAULT_DEADLINE_DAYS,
        // Một tham số "thang,quy": Spring tách dấu phẩy; dạng kinds[0]= thì không đọc được.
        kinds: previewKinds.join(","),
      },
    },
    queryOptions: {
      enabled: previewEnabled,
      // Giữ khung cũ trong lúc chờ khung mới, để bảng không nháy trắng.
      placeholderData: (previous) => previous,
    },
    errorNotification: false,
  });
  const preview = useMemo(
    () => asArray<PeriodPreview>(previewResult.data).filter((p) => p.year === year),
    [previewResult.data, year]
  );

  /* Tóm tắt cập nhật (UC-21 bước 3) — chỉ gọi khi bấm Lưu lịch. */
  const { query: planQuery } = useCustom<CalendarUpdatePlan>({
    url: `${API_URL}/report_calendars/${calendar?.id ?? 0}/update_plan`,
    method: "get",
    config: {
      query: {
        deadlineDays: days ?? calendar?.deadlineDays ?? DEFAULT_DEADLINE_DAYS,
        kinds: orderKinds(kinds).join(","),
      },
    },
    queryOptions: { enabled: false },
    errorNotification: false,
  });

  const rows = useMemo(() => {
    if (days === null) return [];
    if (mode === "create" || !calendar) {
      return rowsForCreate(
        preview.filter((p) => kinds.includes(p.kind)),
        overrides
      );
    }
    return rowsForCalendar({
      calendar,
      periods,
      kinds,
      days,
      addedPreview: preview,
      overrides,
    });
  }, [mode, calendar, periods, kinds, days, preview, overrides]);

  const panelLoading =
    (mode === "view" && periodsQuery.isLoading) ||
    (days !== null && previewKinds.length > 0 && previewDays === null) ||
    (previewEnabled && previewQuery.isLoading);

  const panelError =
    mode === "view" && periodsQuery.isError
      ? {
          message: apiErrorMessage(periodsQuery.error, LOAD_ERROR),
          action: (
            <Button type="button" variant="outline" onClick={() => void periodsQuery.refetch()}>
              <RefreshCw aria-hidden />
              Thử lại
            </Button>
          ),
        }
      : previewEnabled && previewQuery.isError
        ? {
            message: apiErrorMessage(previewQuery.error, LOAD_ERROR),
            action: (
              <Button type="button" variant="outline" onClick={() => void previewQuery.refetch()}>
                <RefreshCw aria-hidden />
                Thử lại
              </Button>
            ),
          }
        : null;

  /** BR-06.2: năm nay − 10 đến năm nay + 20, bỏ các năm đã có lịch. */
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const out: number[] = [];
    for (let y = now - 10; y <= now + 20; y++) {
      if (y === year || !takenYears.has(y)) out.push(y);
    }
    return out;
  }, [takenYears, year]);

  const locked = useMemo(() => new Set(calendar?.lockedKinds ?? []), [calendar]);
  const hasAssigned = (calendar?.lockedKinds.length ?? 0) > 0;

  /** Tên kỳ theo mã — hộp xác nhận nói "Tháng 1/2026", không nói "T1". */
  function periodNames(codes: string[]): string {
    return codes.map((code) => periods.find((p) => p.code === code)?.name ?? code).join(", ");
  }

  /**
   * Ghi hạn nộp sửa tay lên các kỳ của lịch (`PATCH /report_periods/{id}`). Kỳ mới tạo
   * chưa có id trước khi lưu, nên đọc lại danh sách kỳ của lịch rồi khớp theo (loại, số thứ tự).
   */
  async function applyOverrides(
    calendarId: number,
    wanted: Record<string, string>
  ): Promise<{ saved: number; errors: string[] }> {
    const entries = Object.entries(wanted);
    if (entries.length === 0) return { saved: 0, errors: [] };

    const { data } = await dataProvider().getList<ReportPeriodRecord>({
      resource: PERIOD_RESOURCE,
      pagination: { currentPage: 1, pageSize: PERIOD_PAGE_SIZE },
      filters: [{ field: "calendar.id", operator: "eq", value: calendarId }],
    });
    const bySlot = new Map(data.map((p) => [slotKey(p.kind, p.seq), p]));

    let saved = 0;
    const errors: string[] = [];
    for (const [slot, iso] of entries) {
      const period = bySlot.get(slot);
      if (!period || period.deadline === iso) continue;
      try {
        await updatePeriod({
          resource: PERIOD_RESOURCE,
          id: period.id,
          values: { deadline: iso },
          successNotification: false,
          errorNotification: false,
          // Làm mới một lần ở cuối thay vì sau từng kỳ.
          invalidates: [],
        });
        saved++;
      } catch (error) {
        errors.push(
          apiErrorMessage(error, `Chưa lưu được hạn nộp của ${period.name}.`)
        );
      }
    }
    return { saved, errors };
  }

  /** Chỉ giữ hạn sửa tay của kỳ còn trên bảng và còn sửa được. */
  function pickOverrides(values: Record<string, string>): Record<string, string> {
    const editable = new Set(rows.filter((r) => r.editable).map((r) => r.slot));
    return Object.fromEntries(
      Object.entries(values).filter(([slot, iso]) => iso && editable.has(slot))
    );
  }

  async function refreshPeriods() {
    await Promise.all([
      invalidate({ resource: CALENDAR_RESOURCE, invalidates: ["list", "many", "detail"] }),
      invalidate({ resource: PERIOD_RESOURCE, invalidates: ["list", "many", "detail"] }),
    ]);
  }

  async function create(prepared: Prepared) {
    setBusy(true);
    setWarnWhen(false);
    try {
      const { data: created } = await createCalendar({
        resource: CALENDAR_RESOURCE,
        values: { year, deadlineDays: prepared.days, kinds: prepared.kinds },
        successNotification: false,
        errorNotification: false,
        invalidates: [],
      });
      const result = await applyOverrides(created.id, prepared.overrides);
      form.reset(defaultsFor(created));
      // Chờ danh sách lịch tải lại để trang chuyển thẳng sang lịch vừa tạo.
      await refreshPeriods();

      const count = created.createdPeriods ?? created.periodCount;
      if (count === 0) {
        toast.warning(
          `Đã lưu lịch báo cáo năm ${year} nhưng chưa sinh kỳ nào. Hãy chọn ít nhất một loại kỳ cần sinh rồi bấm Lưu lịch.`
        );
      } else {
        const skipped = created.skippedPeriods ?? 0;
        toast.success(
          skipped > 0
            ? `Đã tạo lịch báo cáo năm ${year}: tạo ${count} kỳ, bỏ qua ${skipped} kỳ đã có.`
            : `Đã tạo lịch báo cáo năm ${year} với ${count} kỳ.`
        );
      }
      if (result.errors.length > 0) toast.warning(result.errors[0]);
      onCreated?.();
    } catch (error) {
      setWarnWhen(form.formState.isDirty);
      toast.error(
        apiErrorMessage(error, "Chưa tạo được lịch báo cáo. Bạn thử lại sau ít phút.")
      );
    } finally {
      setBusy(false);
    }
  }

  async function update(prepared: Prepared, plan: CalendarUpdatePlan | null) {
    if (!calendar) return;
    setBusy(true);
    setWarnWhen(false);
    try {
      let updated: ReportCalendarRecord | null = null;
      if (plan) {
        const response = await updateCalendar({
          resource: CALENDAR_RESOURCE,
          id: calendar.id,
          values: { year, deadlineDays: prepared.days, kinds: prepared.kinds },
          successNotification: false,
          errorNotification: false,
          invalidates: [],
        });
        updated = response.data;
      }
      const result = await applyOverrides(calendar.id, prepared.overrides);
      form.reset({
        deadlineDays: String(prepared.days),
        kinds: prepared.kinds,
        overrides: {},
      });
      await refreshPeriods();

      const parts = [
        updated?.createdPeriods ? `thêm ${updated.createdPeriods} kỳ` : null,
        updated?.removedPeriods ? `bỏ ${updated.removedPeriods} kỳ chưa gán cho đơn vị` : null,
        updated?.rescheduledPeriods
          ? `tính lại hạn nộp ${updated.rescheduledPeriods} kỳ`
          : null,
        result.saved > 0 ? `lưu hạn nộp đã sửa của ${result.saved} kỳ` : null,
      ].filter(Boolean);
      toast.success(
        parts.length > 0
          ? `Đã cập nhật lịch báo cáo năm ${year}: ${parts.join(", ")}.`
          : `Đã cập nhật lịch báo cáo năm ${year}.`
      );
      if (result.errors.length > 0) toast.warning(result.errors[0]);
    } catch (error) {
      setWarnWhen(form.formState.isDirty);
      toast.error(
        apiErrorMessage(error, "Chưa lưu được lịch báo cáo. Bạn thử lại sau ít phút.")
      );
    } finally {
      setBusy(false);
    }
  }

  async function save(values: CalendarFormValues) {
    const n = parseDays(values.deadlineDays);
    if (n === null || busy) return;
    const prepared: Prepared = {
      days: n,
      kinds: orderKinds(values.kinds),
      overrides: pickOverrides(values.overrides),
    };

    if (mode === "create" || !calendar) {
      await create(prepared);
      return;
    }

    if (prepared.kinds.length === 0) {
      toast.warning("Lịch đã lưu cần ít nhất một loại kỳ. Hãy chọn loại kỳ cần sinh rồi bấm Lưu lịch.");
      return;
    }

    const calendarChanged =
      !sameKinds(prepared.kinds, calendar.kinds) || prepared.days !== calendar.deadlineDays;
    const hasOverrides = Object.keys(prepared.overrides).length > 0;

    if (!calendarChanged) {
      if (!hasOverrides) {
        toast.info("Không có thay đổi nào để cập nhật.");
        return;
      }
      await update(prepared, null);
      return;
    }

    setBusy(true);
    const checked = await planQuery.refetch();
    setBusy(false);
    const plan = checked.data?.data;
    if (checked.isError || !plan) {
      toast.error(
        apiErrorMessage(
          checked.error,
          "Chưa kiểm tra được thay đổi của lịch. Bạn thử lại sau ít phút."
        )
      );
      return;
    }
    if (plan.empty) {
      if (hasOverrides) await update(prepared, null);
      else toast.info("Không có thay đổi nào để cập nhật.");
      return;
    }
    setPendingPlan({ plan, prepared });
  }

  const submit = () => void form.handleSubmit(save)();

  const planLines: string[] = [];
  if (pendingPlan) {
    const { plan, prepared } = pendingPlan;
    if (plan.addedKinds.length > 0) {
      planLines.push(
        `Thêm loại kỳ ${plan.addedKinds.map((k) => KIND_LABELS[k]).join(", ")} (tạo mới ${plan.createdPeriods} kỳ).`
      );
    }
    if (plan.removedKinds.length > 0) {
      planLines.push(
        `Bỏ loại kỳ ${plan.removedKinds.map((k) => KIND_LABELS[k]).join(", ")} (xoá ${plan.removedPeriods} kỳ chưa gán cho đơn vị).`
      );
    }
    if (plan.oldDeadlineDays !== plan.newDeadlineDays) {
      planLines.push(
        `Hạn nộp ${plan.oldDeadlineDays} → ${plan.newDeadlineDays} ngày (tính lại cho ${plan.rescheduledPeriods} kỳ chưa gán cho đơn vị).`
      );
      if (plan.keptDeadlineCodes.length > 0) {
        planLines.push(
          `Các kỳ đã gán cho đơn vị giữ hạn cũ: ${periodNames(plan.keptDeadlineCodes)}.`
        );
      }
      if (plan.manualDeadlineCodes.length > 0) {
        planLines.push(
          `Các kỳ đã sửa hạn nộp từng kỳ giữ nguyên: ${periodNames(plan.manualDeadlineCodes)}.`
        );
      }
    }
    const overrideCount = Object.keys(prepared.overrides).length;
    if (overrideCount > 0) {
      planLines.push(`Lưu hạn nộp đã sửa của ${overrideCount} kỳ.`);
    }
  }

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
            primary={
              canWrite
                ? {
                    label: mode === "view" ? "Lưu lịch" : "Tạo lịch",
                    onClick: submit,
                    loading: busy,
                  }
                : undefined
            }
            items={
              mode === "view" && canDelete
                ? [
                    {
                      key: "delete",
                      label: "Xoá lịch năm",
                      icon: Trash,
                      destructive: true,
                      disabled: hasAssigned || busy,
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
          readOnly={!canWrite}
        />
        <PeriodPreviewPanel
          periods={rows}
          kinds={kinds}
          daysValid={days !== null}
          loading={panelLoading}
          error={panelError}
          readOnly={!canWrite}
          onDeadlineChange={(slot, iso) =>
            form.setValue(
              "overrides",
              { ...form.getValues("overrides"), [slot]: iso },
              { shouldDirty: true }
            )
          }
        />
      </div>

      <ConfirmDialog
        open={pendingPlan !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPlan(null);
        }}
        title={`Cập nhật lịch báo cáo năm ${year}?`}
        description={
          <ul className="flex list-disc flex-col gap-1 ps-5 text-start">
            {planLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        }
        confirmLabel="Cập nhật"
        cancelLabel="Quay lại"
        onConfirm={() => {
          const current = pendingPlan;
          setPendingPlan(null);
          if (current) void update(current.prepared, current.plan);
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Xoá lịch báo cáo năm ${year}?`}
        description={`Toàn bộ ${calendar?.periodCount ?? 0} kỳ của năm ${year} sẽ bị xoá cùng lịch và không khôi phục được. Nếu có kỳ đã được gán cho đơn vị thì hệ thống sẽ không xoá.`}
        confirmLabel="Xoá lịch năm"
        cancelLabel="Quay lại"
        destructive
        onConfirm={async () => {
          setConfirmDelete(false);
          if (!calendar) return;
          setBusy(true);
          setWarnWhen(false);
          try {
            await deleteCalendar({
              resource: CALENDAR_RESOURCE,
              id: calendar.id,
              successNotification: false,
              errorNotification: false,
            });
            await refreshPeriods();
            toast.success(`Đã xoá lịch báo cáo năm ${year}.`);
          } catch (error) {
            setWarnWhen(form.formState.isDirty);
            toast.error(
              apiErrorMessage(
                error,
                `Chưa xoá được lịch năm ${year}. Bạn thử lại sau ít phút.`
              )
            );
          } finally {
            setBusy(false);
          }
        }}
      />
    </AsxhPage>
  );
}
