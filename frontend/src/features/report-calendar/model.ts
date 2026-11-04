import type { StatusTone } from "@/shared/components/asxh";

/**
 * Lịch và kỳ báo cáo — hình dạng dữ liệu của `/api/report_calendars` và
 * `/api/report_periods`, khớp `ReportCalendarResponse`, `ReportPeriodResponse`,
 * `PeriodPreviewResponse`, `CalendarUpdatePlanResponse` ở backend
 * (`module/asxh/period/api/dto`), cùng các hàm thuần dựng bảng kỳ.
 */

export const CALENDAR_RESOURCE = "report_calendars";
export const PERIOD_RESOURCE = "report_periods";

/** Loại kỳ — giá trị dây chữ thường của `PeriodKind`. Nhãn ở KIND_LABELS. */
export type PeriodKind = "thang" | "quy" | "sau_thang" | "nam";

export const KIND_ORDER: PeriodKind[] = ["thang", "quy", "sau_thang", "nam"];

export const KIND_LABELS: Record<PeriodKind, string> = {
  thang: "Tháng",
  quy: "Quý",
  sau_thang: "6 tháng",
  nam: "Năm",
};

/** Dòng mô tả trên thẻ Loại kỳ cần sinh. */
export const KIND_DESCRIPTIONS: Record<PeriodKind, string> = {
  thang: "12 kỳ · mỗi tháng 1 kỳ",
  quy: "4 kỳ · quý I đến quý IV",
  sau_thang: "2 kỳ · nửa đầu, nửa cuối năm",
  nam: "1 kỳ · cả năm",
};

/** Trạng thái kỳ — giá trị dây chữ thường của `PeriodStatus`. */
export type PeriodStatus =
  | "draft"
  | "ready"
  | "published"
  | "open"
  | "overdue"
  | "closed"
  | "locked"
  | "cancelled";

/** Nhãn và màu trạng thái kỳ — cùng bộ chữ với màn Thiết lập báo cáo. */
export const PERIOD_STATUS_VIEW: Record<PeriodStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Chưa thiết lập", tone: "neutral" },
  ready: { label: "Đã thiết lập", tone: "success" },
  published: { label: "Chưa mở", tone: "outline" },
  open: { label: "Đang mở", tone: "info" },
  overdue: { label: "Quá hạn", tone: "overdue" },
  closed: { label: "Đã chốt", tone: "locked" },
  locked: { label: "Đã khoá", tone: "locked" },
  cancelled: { label: "Đã huỷ", tone: "neutral" },
};

/** Mặc định khi tạo lịch mới (UC-06): Tháng + Quý + 6 tháng, hạn nộp 5 ngày. */
export const DEFAULT_KINDS: PeriodKind[] = ["thang", "quy", "sau_thang"];
export const DEFAULT_DEADLINE_DAYS = 5;

export type ReportCalendarRecord = {
  id: number;
  year: number;
  name: string;
  deadlineDays: number;
  kinds: PeriodKind[];
  /** Loại kỳ đã có kỳ được dùng (đã gán đơn vị trở đi) — không bỏ được (UC-21 2c). */
  lockedKinds: PeriodKind[];
  periodCount: number;
  /**
   * Chỉ có khi báo cáo năm đã nộp UBND (chờ duyệt) hoặc đã được UBND duyệt: lịch năm đó đã
   * chốt, không sửa / xoá được nữa (UC-60). Câu này để hiện thẳng cho người dùng.
   */
  yearLockReason?: string;
  /** Chỉ có trên kết quả tạo / cập nhật. */
  createdPeriods?: number;
  skippedPeriods?: number;
  removedPeriods?: number;
  rescheduledPeriods?: number;
  createdAt: string;
  updatedAt?: string | null;
};

/** Thân `POST /report_calendars` và `PATCH /report_calendars/{id}`. */
export type CalendarPayload = {
  year: number;
  deadlineDays: number;
  kinds: PeriodKind[];
};

export type ReportPeriodRecord = {
  id: number;
  calendar: { id: number; year: number };
  year: number;
  kind: PeriodKind;
  seq: number;
  code: string;
  name: string;
  /** yyyy-MM-dd */
  fromDate: string;
  /** yyyy-MM-dd */
  toDate: string;
  openFrom: string | null;
  /** Hạn nộp, yyyy-MM-dd. */
  deadline: string | null;
  /** Hạn nộp do người dùng sửa tay — không tự tính lại khi đổi số ngày của lịch. */
  deadlineManual: boolean;
  status: PeriodStatus;
  createdAt: string;
  updatedAt?: string | null;
};

/** Một dòng `GET /report_calendars/preview`. */
export type PeriodPreview = {
  year: number;
  kind: PeriodKind;
  seq: number;
  code: string;
  name: string;
  fromDate: string;
  toDate: string;
  openFrom: string;
  deadline: string;
  exists: boolean;
};

/** `GET /report_calendars/{id}/update_plan` — tóm tắt cho hộp "Cập nhật lịch báo cáo" (UC-21). */
export type CalendarUpdatePlan = {
  addedKinds: PeriodKind[];
  createdPeriods: number;
  removedKinds: PeriodKind[];
  removedPeriods: number;
  oldDeadlineDays: number;
  newDeadlineDays: number;
  rescheduledPeriods: number;
  /** Mã kỳ đã dùng, giữ hạn cũ. */
  keptDeadlineCodes: string[];
  /** Mã kỳ chưa dùng nhưng đã sửa tay hạn nộp, giữ nguyên. */
  manualDeadlineCodes: string[];
  empty: boolean;
};

/** Một dòng của bảng "Các kỳ sẽ tạo". */
export type PeriodRow = {
  /** Khoá (loại kỳ, số thứ tự) — ổn định cả trước khi kỳ có id. */
  slot: string;
  /** null = kỳ sẽ được tạo khi lưu. */
  id: number | null;
  kind: PeriodKind;
  seq: number;
  name: string;
  fromDate: string;
  toDate: string;
  /** Hạn nộp sẽ có sau khi lưu. */
  deadline: string;
  status: PeriodStatus;
  /** Sửa được hạn nộp ở màn này (kỳ chưa mở đợt). */
  editable: boolean;
};

/* ------------------------------------------------------------------ */
/* Ngày                                                                */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** yyyy-MM-dd → Date theo giờ máy (không lệch ngày như new Date("yyyy-MM-dd")). */
export function fromIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/* ------------------------------------------------------------------ */
/* Kỳ                                                                  */
/* ------------------------------------------------------------------ */

export function slotKey(kind: PeriodKind, seq: number): string {
  return `${kind}#${seq}`;
}

/** Kỳ đã đem ra dùng (đã rời "Chưa thiết lập") — cùng quy tắc `ReportPeriodService.isUsed`. */
export function isUsed(period: Pick<ReportPeriodRecord, "status">): boolean {
  return period.status !== "draft";
}

/** Sửa được hạn nộp ở màn lịch: kỳ chưa mở đợt (`PATCH /report_periods/{id}` chỉ nhận hai trạng thái này). */
export function canEditDeadline(period: Pick<ReportPeriodRecord, "status">): boolean {
  return period.status === "draft" || period.status === "ready";
}

/** Loại kỳ theo thứ tự hiển thị, bỏ trùng. */
export function orderKinds(kinds: readonly PeriodKind[]): PeriodKind[] {
  return KIND_ORDER.filter((k) => kinds.includes(k));
}

export function sameKinds(a: readonly PeriodKind[], b: readonly PeriodKind[]): boolean {
  const x = orderKinds(a);
  const y = orderKinds(b);
  return x.length === y.length && x.every((k, i) => k === y[i]);
}

const bySlot = (a: PeriodRow, b: PeriodRow) =>
  KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.seq - b.seq;

/**
 * Bảng kỳ của lịch đang tạo: toàn bộ từ khung xem trước của máy chủ, hạn nộp sửa
 * tay (nếu có) đè lên hạn tự tính.
 */
export function rowsForCreate(
  preview: PeriodPreview[],
  overrides: Record<string, string>
): PeriodRow[] {
  return preview
    .map<PeriodRow>((p) => {
      const slot = slotKey(p.kind, p.seq);
      return {
        slot,
        id: null,
        kind: p.kind,
        seq: p.seq,
        name: p.name,
        fromDate: p.fromDate,
        toDate: p.toDate,
        deadline: overrides[slot] ?? p.deadline,
        status: "draft",
        editable: true,
      };
    })
    .sort(bySlot);
}

/**
 * Bảng kỳ của lịch đã lưu sau khi bấm Lưu lịch: kỳ đã có của các loại còn chọn (giữ
 * trạng thái), cộng kỳ của loại mới thêm (từ khung xem trước). Hạn nộp hiển thị đúng
 * như sẽ lưu (UC-21): kỳ chưa dùng và chưa sửa tay tính lại theo số ngày mới; kỳ đã
 * dùng / sửa tay giữ hạn; hạn vừa chọn tay đè lên tất cả.
 */
export function rowsForCalendar(args: {
  calendar: ReportCalendarRecord;
  periods: ReportPeriodRecord[];
  kinds: PeriodKind[];
  days: number;
  addedPreview: PeriodPreview[];
  overrides: Record<string, string>;
}): PeriodRow[] {
  const { calendar, periods, kinds, days, addedPreview, overrides } = args;
  const deadlineChanged = days !== calendar.deadlineDays;

  const existing = periods
    .filter((p) => kinds.includes(p.kind))
    .map<PeriodRow>((p) => {
      const slot = slotKey(p.kind, p.seq);
      const recalculated = addDays(p.toDate, days);
      const current = p.deadline ?? recalculated;
      const follows = !isUsed(p) && !p.deadlineManual;
      return {
        slot,
        id: p.id,
        kind: p.kind,
        seq: p.seq,
        name: p.name,
        fromDate: p.fromDate,
        toDate: p.toDate,
        deadline: overrides[slot] ?? (deadlineChanged && follows ? recalculated : current),
        status: p.status,
        editable: canEditDeadline(p),
      };
    });

  const existingSlots = new Set(existing.map((r) => r.slot));
  const added = rowsForCreate(
    addedPreview.filter((p) => kinds.includes(p.kind)),
    overrides
  ).filter((r) => !existingSlots.has(r.slot));

  return [...existing, ...added].sort(bySlot);
}

/** Lý do không sửa được hạn nộp của một kỳ. */
export function deadlineLockReason(status: PeriodStatus): string {
  if (status === "closed" || status === "locked") {
    return "Kỳ đã chốt nên không sửa được hạn nộp.";
  }
  if (status === "cancelled") return "Kỳ đã huỷ nên không sửa được hạn nộp.";
  return "Kỳ đã mở đợt báo cáo nên không sửa hạn nộp ở đây. Muốn dời hạn, hãy dùng Gia hạn ở màn Thiết lập báo cáo.";
}

/* ------------------------------------------------------------------ */
/* Lỗi từ máy chủ                                                      */
/* ------------------------------------------------------------------ */

/** Lỗi data provider ném ra (`shared/api/data.ts`): `{ message, statusCode, errors }`. */
export type ApiError = {
  message?: string;
  statusCode?: number;
  errors?: Record<string, string>;
};

const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/**
 * Câu báo lỗi cho người dùng. Chỉ dùng câu máy chủ trả về khi đó là câu tiếng Việt
 * (lỗi nghiệp vụ); câu tiếng Anh chung của nền tảng thì thay bằng `fallback`.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const e = error as ApiError;
    if (e.statusCode === 403) {
      return "Bạn chưa được cấp quyền làm việc này. Hãy liên hệ quản trị hệ thống.";
    }
    const fieldMessage = e.errors
      ? Object.values(e.errors).find((v) => typeof v === "string" && VIETNAMESE.test(v))
      : undefined;
    if (fieldMessage) return fieldMessage;
    if (typeof e.message === "string" && VIETNAMESE.test(e.message)) return e.message;
  }
  return fallback;
}

/** Dữ liệu `useCustom` dạng mảng — `useCustom` trả đối tượng rỗng khi chưa có dữ liệu. */
export function asArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}
