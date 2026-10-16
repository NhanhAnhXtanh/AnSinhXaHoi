import { useMemo } from "react";
import {
  useCustom,
  useCustomMutation,
  useList,
  type HttpError,
} from "@refinedev/core";

import { API_URL } from "@/shared/api/constants";
import { customResult } from "@/shared/hooks/use-custom-result";

import {
  cellKey,
  sortPeriods,
  todayIso,
  toPeriod,
  toProgress,
  toTemplate,
  toUnit,
  type ActionResult,
  type ApiAssignment,
  type ApiInputReport,
  type ApiPeriod,
  type ApiPeriodLock,
  type ApiSetupState,
  type ApiTemplate,
  type ApiUnit,
  type Period,
  type PeriodLock,
  type Template,
} from "./model";

/** Đủ lớn để một kỳ / một năm về trong một trang (máy chủ chặn trần 1.000 dòng). */
const ALL = 1000;

const JSON_HEADERS = { "Content-Type": "application/json" };

/* ------------------------------------------------------------------ */
/* Danh sách kỳ của năm + khoá cả kỳ                                   */
/* ------------------------------------------------------------------ */

export function useYearPeriods(year: number) {
  const { result, query } = useList<ApiPeriod>({
    resource: "report_periods",
    pagination: { currentPage: 1, pageSize: ALL },
    filters: [{ field: "calendar.year", operator: "eq", value: year }],
    sorters: [
      { field: "fromDate", order: "asc" },
      { field: "toDate", order: "desc" },
    ],
  });

  const periods: Period[] = useMemo(
    () => sortPeriods((result?.data ?? []).map(toPeriod)),
    [result?.data]
  );

  const ids = useMemo(() => periods.map((p) => Number(p.id)), [periods]);

  // Khoá cả kỳ (UC-31) do máy chủ tính — trùng thời gian với kỳ đã mở đợt, kể cả kỳ của năm khác.
  const locksQuery = useCustom<Record<string, unknown>>({
    url: `${API_URL}/report_periods/setup_locks`,
    method: "get",
    config: { query: { ids } },
    queryOptions: { enabled: ids.length > 0 },
  });
  const rawLocks: unknown = locksQuery.result?.data;
  const locks = useMemo(() => {
    const map = new Map<string, PeriodLock>();
    if (Array.isArray(rawLocks)) {
      for (const l of rawLocks as ApiPeriodLock[]) {
        map.set(String(l.periodId), { reason: l.reason, sourceName: l.sourcePeriodName });
      }
    }
    return map;
  }, [rawLocks]);

  return {
    periods,
    locks,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
      void locksQuery.query.refetch();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Hàng (đơn vị) và cột (biểu) của ma trận                             */
/* ------------------------------------------------------------------ */

export function useMatrixAxes() {
  const unitsList = useList<ApiUnit>({
    resource: "report_units",
    pagination: { currentPage: 1, pageSize: ALL },
    filters: [
      { field: "active", operator: "eq", value: true },
      { field: "receivesReports", operator: "eq", value: true },
    ],
    sorters: [{ field: "budgetCode", order: "asc" }],
  });

  // Cột ma trận: biểu chi tiết có phiên bản đã ban hành áp dụng tới hôm nay (BR-22.1).
  const today = useMemo(() => todayIso(), []);
  const templatesList = useList<ApiTemplate>({
    resource: "templates",
    pagination: { currentPage: 1, pageSize: ALL },
    filters: [
      { field: "kind", operator: "eq", value: "CHI_TIET" },
      { field: "applicableOn", operator: "eq", value: today },
    ],
    sorters: [{ field: "sortOrder", order: "asc" }],
  });

  const units = useMemo(
    () => (unitsList.result?.data ?? []).map(toUnit),
    [unitsList.result?.data]
  );
  const templates = useMemo(
    () => (templatesList.result?.data ?? []).map(toTemplate),
    [templatesList.result?.data]
  );

  return {
    units,
    templates,
    isLoading: unitsList.query.isLoading || templatesList.query.isLoading,
    isError: unitsList.query.isError || templatesList.query.isError,
    refetch: () => {
      void unitsList.query.refetch();
      void templatesList.query.refetch();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Dữ liệu của kỳ đang chọn                                            */
/* ------------------------------------------------------------------ */

const OPENED: ReadonlySet<string> = new Set(["published", "open", "overdue", "closed", "locked"]);

export function useSelectedPeriod(period: Period | null) {
  const periodId = period?.id ?? null;

  const assignmentsList = useList<ApiAssignment>({
    resource: "period_assignments",
    pagination: { currentPage: 1, pageSize: ALL },
    filters: periodId ? [{ field: "period.id", operator: "eq", value: periodId }] : [],
    queryOptions: { enabled: periodId !== null },
  });

  const setupQuery = useCustom<ApiSetupState>({
    url: `${API_URL}/report_periods/${periodId ?? 0}/setup`,
    method: "get",
    queryOptions: { enabled: periodId !== null },
  });

  // Phiếu chỉ có từ khi kỳ đã mở đợt; kỳ đang thiết lập không cần gọi.
  const hasReports = period !== null && OPENED.has(period.status);
  const reportsList = useList<ApiInputReport>({
    resource: "input_reports",
    pagination: { currentPage: 1, pageSize: ALL },
    filters: periodId ? [{ field: "period.id", operator: "eq", value: periodId }] : [],
    queryOptions: { enabled: hasReports },
  });

  const assignments = useMemo(
    () => (periodId ? (assignmentsList.result?.data ?? []) : []),
    [periodId, assignmentsList.result?.data]
  );

  const saved: ReadonlySet<string> = useMemo(
    () => new Set(assignments.map((a) => cellKey(String(a.unit.id), String(a.template.id)))),
    [assignments]
  );

  /** Biểu đã gán cho kỳ — để còn hiện cột của biểu nay đã ngừng ban hành. */
  const assignedTemplates: Template[] = useMemo(() => {
    const seen = new Map<string, Template>();
    for (const a of assignments) {
      const t = toTemplate(a.template);
      if (!seen.has(t.id)) seen.set(t.id, t);
    }
    return [...seen.values()];
  }, [assignments]);

  const setup = customResult(setupQuery.result?.data, "periodId");
  const setupForThis = setup && String(setup.periodId) === periodId ? setup : undefined;

  const issued: ReadonlySet<string> = useMemo(
    () =>
      new Set(
        (setupForThis?.issuedCells ?? []).map((c) => cellKey(String(c.unitId), String(c.templateId)))
      ),
    [setupForThis]
  );

  const reports = useMemo(
    () => (hasReports ? (reportsList.result?.data ?? []) : []),
    [hasReports, reportsList.result?.data]
  );
  const progress = useMemo(() => toProgress(reports), [reports]);

  return {
    saved,
    issued,
    assignedTemplates,
    setup: setupForThis,
    reports,
    progress,
    isLoading: periodId !== null && (assignmentsList.query.isLoading || setupQuery.query.isLoading),
    isError: assignmentsList.query.isError || setupQuery.query.isError,
    refetch: () => {
      if (periodId === null) return;
      void assignmentsList.query.refetch();
      void setupQuery.query.refetch();
      if (hasReports) void reportsList.query.refetch();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Thao tác ghi                                                        */
/* ------------------------------------------------------------------ */

type Body = Record<string, unknown>;

export type CellRef = { unitId: number; templateId: number };

/**
 * Mọi thao tác ghi của màn: lưu ma trận (`PUT /period_assignments/matrix`), áp dụng cho kỳ khác
 * (`POST /period_assignments/copy`) và điều hành kỳ (`POST /report_periods/{id}/publish|close|
 * extend|withdraw`). Trả câu báo của máy chủ; lỗi ném nguyên lỗi để nơi gọi hiện câu tiếng Việt.
 */
export function useSetupActions() {
  const { mutateAsync, mutation } = useCustomMutation<ActionResult, HttpError, Body>();

  const call = async (url: string, method: "post" | "put", values: Body): Promise<string | null> => {
    const response = await mutateAsync({
      url: `${API_URL}${url}`,
      method,
      values,
      config: { headers: JSON_HEADERS },
      successNotification: false,
      errorNotification: false,
    });
    return response.data?.message ?? null;
  };

  return {
    pending: mutation.isPending,
    saveMatrix: (periodId: string, add: CellRef[], remove: CellRef[]) =>
      call("/period_assignments/matrix", "put", { periodId: Number(periodId), add, remove }),
    copy: (fromPeriodId: string, toPeriodIds: string[]) =>
      call("/period_assignments/copy", "post", {
        fromPeriodId: Number(fromPeriodId),
        toPeriodIds: toPeriodIds.map(Number),
      }),
    publish: (periodId: string) => call(`/report_periods/${periodId}/publish`, "post", {}),
    close: (periodId: string) => call(`/report_periods/${periodId}/close`, "post", {}),
    extend: (periodId: string, deadline: string, reason: string) =>
      // TODO: máy chủ chưa lưu lý do gia hạn (kỳ chưa có cột) — gửi kèm để không mất khi có.
      call(`/report_periods/${periodId}/extend`, "post", { deadline, reason }),
    withdraw: (periodId: string, confirmName: string) =>
      call(`/report_periods/${periodId}/withdraw`, "post", { confirmName }),
  };
}
