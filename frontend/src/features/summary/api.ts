import { useCustom, type BaseRecord, type HttpError } from "@refinedev/core";

import { API_URL } from "@/shared/api/constants";
import { customResult } from "@/shared/hooks/use-custom-result";
import type { StatusTone } from "@/shared/components/asxh";
import type { PeriodKind } from "@/shared/components/asxh";
import { loadErrorText } from "@/shared/lib/user-message";

/**
 * Hình dạng dữ liệu của `/api/summary/*`, `/api/dept_reports/*`, `/api/dept_years/*` (xem
 * `SummaryReportService`, `DeptSheetService`, `DeptYearDataQuery` phía máy chủ).
 *
 * Tên trạng thái / mã ở đây là tên trên dây — chữ người dùng thấy lấy từ các bảng nhãn bên dưới.
 */

// ---------------------------------------------------------------- kiểu chung

/** Trạng thái kỳ — trên dây viết thường. */
export type ApiPeriodStatus =
  | "draft"
  | "ready"
  | "published"
  | "open"
  | "overdue"
  | "closed"
  | "locked"
  | "cancelled";

export type ApiPeriodKind = "thang" | "quy" | "sau_thang" | "nam";

/** Một dòng số liệu tổng hợp (cũng là dạng `ctx.shared.rows` của script). */
export type SummaryRow = {
  organizationCode: string;
  organizationName: string;
  indicatorCode: string;
  indicatorName: string;
  quantity: number | null;
  amount: number | null;
  quantitySum: number | null;
  quantityMax: number | null;
  measureKind: string;
  periodCount: number;
  orderNo: number | null;
  unitId: number | null;
};

/** Dòng số liệu Sở đã lưu — dạng `SummaryRow` cộng phần riêng của số liệu Sở. */
export type DeptDataRow = SummaryRow & {
  allocatedAmount: number | null;
  sourceQuantity: number | null;
  sourceAmount: number | null;
  adjusted: boolean;
  adjustReason: string | null;
};

export type UnitOption = {
  id: number;
  code: string;
  name: string;
  /** Mã loại kiểu bản Jmix (SO, XA, HUYEN…) — chỉ để script đọc. */
  orgType: string;
  unitType: string | null;
  block: "tinh" | "huyen" | "xa" | null;
};

export type SheetOption = {
  templateId: number;
  templateCode: string;
  shortName: string;
  name: string;
  versionId: number | null;
  versionNo: number | null;
  effectiveFrom: string | null;
  /** Kỳ đứng trước ngày áp dụng của mọi phiên bản → mượn bản ban hành sớm nhất. */
  borrowedEarliest: boolean;
};

// ---------------------------------------------------------------- theo kỳ

export type SummaryPeriodItem = {
  id: number;
  name: string;
  code: string;
  kind: ApiPeriodKind;
  fromDate: string;
  toDate: string;
  status: ApiPeriodStatus;
  statusLabel: string;
  assignedUnits: number;
  reportedUnits: number;
  submittedUnits: number;
  approvedUnits: number;
  lastApprovedAt: string | null;
  deptReportId: number | null;
  ledgerVersion: number | null;
  pendingDraft: boolean;
};

export type PeriodOverview = {
  period: SummaryPeriodItem;
  sheets: SheetOption[];
  units: UnitOption[];
  deptReportId: number | null;
  /** Kỳ chưa lưu số liệu: vì sao chưa lưu được (null = lưu được). */
  saveBlockReason: string | null;
  /** Năm đã nộp / đã duyệt: lý do không sửa được (null = sửa được). */
  yearLock: string | null;
  canWrite: boolean;
  yearVersion: number;
};

export type PeriodSheet = {
  periodId: number;
  periodName: string;
  templateId: number;
  sheetCode: string;
  shortName: string;
  sheetName: string;
  reportType: string;
  versionId: number;
  versionNo: number;
  borrowedEarliest: boolean;
  workbookJson: string;
  scriptText: string | null;
  groupByOrg: boolean;
  periodCount: number;
  summaryDataUrl: string;
  rows: SummaryRow[];
};

// ---------------------------------------------------------------- số liệu Sở theo kỳ

export type DeptSheetCompletion = "IN_PROGRESS" | "COMPLETED";

export type DeptSheetInfo = {
  templateId: number;
  templateCode: string;
  shortName: string;
  name: string;
  templateVersionId: number;
  displayOrder: number;
  completion: DeptSheetCompletion;
  /** Biểu có phần đọc số Sở sửa (Sở sửa được). */
  summaryHook: boolean;
  pendingDraft: boolean;
  draftUpdatedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
};

export type DeptReportDetail = {
  id: number;
  periodId: number;
  periodName: string;
  periodKind: string;
  fromDate: string;
  toDate: string;
  periodStatus: string;
  reportYear: number;
  /** Phiên bản gần nhất làm đổi số của kỳ. */
  ledgerVersion: number;
  /** Phiên bản mới nhất của cả năm. */
  yearVersion: number;
  sourceCount: number;
  /** Tập phiếu đơn vị đã duyệt đã khác lúc lưu (số liệu không tự cập nhật). */
  sourceStale: boolean;
  yearLock: string | null;
  canEdit: boolean;
  /** Lần lưu ĐẦU của kỳ. */
  createdAt: string;
  createdBy: string | null;
  /** Giờ và người lưu phiên bản HIỆN HÀNH (null khi chưa có lịch sử). */
  savedAt?: string | null;
  savedBy?: string | null;
  sheets: DeptSheetInfo[];
};

export type DeptSheetRuntime = {
  reportId: number;
  periodId: number;
  periodName: string;
  reportYear: number;
  templateId: number;
  sheetCode: string;
  shortName: string;
  sheetName: string;
  reportType: string;
  templateVersionId: number;
  workbookJson: string;
  draftWorkbookJson: string | null;
  scriptText: string | null;
  revision: number;
  completion: DeptSheetCompletion;
  summaryHook: boolean;
  editable: boolean;
  readOnlyReason: string | null;
  groupByOrg: boolean;
  version: number | null;
  ledgerVersion: number;
  summaryDataUrl: string;
  rows: DeptDataRow[];
};

export type DraftResult = { reportId: number; templateId: number; revision: number; draftUpdatedAt: string };

export type PendingChange = {
  templateId: number;
  sheetLabel: string;
  indicatorCode: string;
  indicatorName: string;
  unitName: string;
  currentQuantity: number | null;
  currentAmount: number | null;
  quantity: number | null;
  amount: number | null;
};

export type SaveResult = {
  ledgerVersion: number;
  newVersion: boolean;
  changedSheets: string[];
  rowCount: number;
};

export type DeptChangeAction =
  | "PERIOD_SAVED"
  | "SHEET_SAVED"
  | "RESTORED"
  | "YEAR_SUBMITTED"
  | "YEAR_APPROVED"
  | "YEAR_RETURNED"
  | "YEAR_REOPENED";

export type VersionEntry = {
  versionNo: number;
  action: DeptChangeAction;
  actionLabel: string;
  sheets: string[];
  rowCount: number;
  note: string | null;
  actor: string;
  occurredAt: string;
  current: boolean;
};

export type CompareRow = {
  indicatorCode: string;
  indicatorName: string;
  orderNo: number | null;
  quantityA: number | null;
  amountA: number | null;
  quantityB: number | null;
  amountB: number | null;
  changed: boolean;
};

export type UnitChange = {
  indicatorCode: string;
  indicatorName: string;
  unitName: string;
  quantityA: number | null;
  amountA: number | null;
  quantityB: number | null;
  amountB: number | null;
};

export type CompareSheet = {
  templateId: number;
  shortName: string;
  name: string;
  rows: CompareRow[];
  unitChanges: UnitChange[];
};

export type CompareResult = { versionA: number; versionB: number; sheets: CompareSheet[] };

export type DeptHistoryEntry = {
  occurredAt: string;
  action: DeptChangeAction;
  actionLabel: string;
  scope: string;
  periodId: number | null;
  reportId: number | null;
  annualRef: number | null;
  templateId: number | null;
  sheetLabel: string;
  versionNo: number | null;
  rowCount: number | null;
  actor: string;
  note: string | null;
};

// ---------------------------------------------------------------- theo năm

export type YearItem = { year: number; ledgerVersion: number; lockReason: string | null };

export type DeptYearPeriod = {
  periodId: number;
  periodName: string;
  periodKind: string;
  fromDate: string;
  toDate: string;
  periodStatus: string;
  deptReportId: number | null;
  savedSheets: string[];
  unsavedSheets: string[];
  openSheets: string[];
  pendingSheets: string[];
  ledgerVersion: number | null;
  lastChangedAt: string | null;
};

export type YearOverview = {
  year: number;
  ledgerVersion: number;
  /** DEPT = đọc số liệu Sở đã lưu; LIVE = tổng hợp trực tiếp từ phiếu đã duyệt. */
  source: "DEPT" | "LIVE";
  savedPeriods: number;
  totalPeriods: number;
  lockReason: string | null;
  sheets: SheetOption[];
  periods: DeptYearPeriod[];
  unfinishedSheets: string[];
  /** Biểu nhập đã đổi phiên bản giữa các kỳ của năm, ví dụ "1e: bản 1 (Quý I), bản 3 (Quý III)". */
  versionNotes?: string[];
};

export type YearSheet = {
  year: number;
  templateId: number;
  sheetCode: string;
  shortName: string;
  sheetName: string;
  versionId: number;
  versionNo: number;
  borrowedEarliest: boolean;
  workbookJson: string;
  scriptText: string | null;
  source: "DEPT" | "LIVE";
  ledgerVersion: number;
  summaryDataUrl: string;
  a: number;
  b: number;
  rows: Record<string, unknown>[];
};

// ---------------------------------------------------------------- đường dẫn

export const SUMMARY_URL = `${API_URL}/summary`;
export const DEPT_REPORTS_URL = `${API_URL}/dept_reports`;

export function deptReportUrl(id: number, suffix = ""): string {
  return `${DEPT_REPORTS_URL}/${id}${suffix}`;
}

export function deptSheetUrl(id: number, templateId: number, suffix = ""): string {
  return `${DEPT_REPORTS_URL}/${id}/sheets/${templateId}${suffix}`;
}

/** Chốt đợt — endpoint của màn Thiết lập và điều hành (quyền `publications:write`). */
export function closePeriodUrl(periodId: number): string {
  return `${API_URL}/report_periods/${periodId}/close`;
}

/** `useCustomMutation` đi qua ky gốc — thiếu dòng này máy chủ trả 415 cho thân JSON. */
export const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };

// ---------------------------------------------------------------- đọc dữ liệu

type Query = Record<string, string | number | boolean | undefined>;

/** Khoá truy vấn giả cho hook đang tắt (`enabled: false` nên không bao giờ gọi). */
const DISABLED_URL = `${API_URL}/summary/__disabled__`;

function cleanQuery(query: Query | undefined): Record<string, string | number | boolean> | undefined {
  if (!query) return undefined;
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") result[key] = value;
  }
  return result;
}

export type ApiState<T> = {
  data: T | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: HttpError | null;
  refetch: () => Promise<unknown>;
};

/**
 * GET một đối tượng. `url = null` → không gọi. `probe` là khoá payload thật luôn có (xem
 * `customResult` — `useCustom` trả object rỗng khi chưa có dữ liệu).
 */
export function useApiObject<T extends object>(url: string | null, query: Query | undefined, probe: keyof T): ApiState<T> {
  const { result, query: q } = useCustom<BaseRecord, HttpError>({
    url: url ?? DISABLED_URL,
    method: "get",
    config: { query: cleanQuery(query) },
    errorNotification: false,
    queryOptions: { enabled: url !== null, refetchOnWindowFocus: false },
  });
  return {
    data: url === null ? undefined : customResult(result?.data as unknown as T | undefined, probe),
    isLoading: url !== null && q.isLoading,
    isFetching: q.isFetching,
    error: q.isError ? (q.error ?? null) : null,
    refetch: q.refetch,
  };
}

/** GET một mảng (máy chủ trả mảng trần). */
export function useApiArray<T>(url: string | null, query: Query | undefined): ApiState<T[]> {
  const { result, query: q } = useCustom<BaseRecord, HttpError>({
    url: url ?? DISABLED_URL,
    method: "get",
    config: { query: cleanQuery(query) },
    errorNotification: false,
    queryOptions: { enabled: url !== null, refetchOnWindowFocus: false },
  });
  const raw = result?.data as unknown;
  return {
    data: url !== null && Array.isArray(raw) ? (raw as T[]) : undefined,
    isLoading: url !== null && q.isLoading,
    isFetching: q.isFetching,
    error: q.isError ? (q.error ?? null) : null,
    refetch: q.refetch,
  };
}

// ---------------------------------------------------------------- lỗi

/** Câu lỗi tiếng Việt máy chủ trả (`ApiExceptionHandler`), hoặc câu dự phòng. */
export function errorMessage(error: unknown, fallback: string): string {
  // Câu tiếng Việt của máy chủ nếu có; mất mạng và thiếu quyền (403) có câu riêng thay cho
  // `fallback` (trước đây 403 cũng hiện thành "mạng có thể đang chập chờn").
  return loadErrorText(error, fallback);
}

// ---------------------------------------------------------------- nhãn

/** Kỳ ở panel trái: loại kỳ của danh sách dùng chung. */
export function periodKindOf(kind: ApiPeriodKind): PeriodKind {
  return kind === "sau_thang" ? "6thang" : kind;
}

/** Nhãn + màu trạng thái kỳ ở màn Tổng hợp. */
export function periodStatusMeta(status: ApiPeriodStatus): { label: string; tone: StatusTone } {
  switch (status) {
    case "open":
      return { label: "Đang mở", tone: "info" };
    case "overdue":
      return { label: "Quá hạn", tone: "overdue" };
    case "closed":
    case "locked":
      return { label: "Đã chốt", tone: "locked" };
    case "cancelled":
      return { label: "Đã huỷ", tone: "neutral" };
    default:
      return { label: "Chưa mở", tone: "outline" };
  }
}

/** Đọc chuỗi JSON workbook; hỏng / rỗng / không có sheet → null. */
export function parseWorkbook(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw || raw.trim() === "") return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const sheets = (value as { sheets?: unknown }).sheets;
    if (!sheets || typeof sheets !== "object" || Object.keys(sheets).length === 0) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}
