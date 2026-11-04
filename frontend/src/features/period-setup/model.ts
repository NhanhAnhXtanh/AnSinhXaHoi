import { formatDate, type StatusTone } from "@/shared/components/asxh";

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu trên dây (đọc từ controller/DTO của backend)           */
/* ------------------------------------------------------------------ */

/** `ReportPeriodResponse` — `/api/report_periods`. Enum đi ra chữ thường. */
export type ApiPeriod = {
  id: number;
  calendar: { id: number; year: number } | null;
  year: number | null;
  kind: "thang" | "quy" | "sau_thang" | "nam";
  seq: number;
  name: string;
  fromDate: string;
  toDate: string;
  openFrom: string | null;
  deadline: string | null;
  status: ApiPeriodStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ApiPeriodStatus =
  | "draft"
  | "ready"
  | "published"
  | "open"
  | "overdue"
  | "closed"
  | "locked"
  | "cancelled";

/** `ReportUnitResponse` — `/api/report_units`. */
export type ApiUnit = {
  id: number;
  name: string;
  block: "tinh" | "huyen" | "xa" | null;
  active: boolean;
  receivesReports: boolean;
};

/** `TemplateResponse` — `/api/templates`. `code` là mã nội bộ, KHÔNG hiển thị. */
export type ApiTemplate = {
  id: number;
  shortName: string;
  name: string;
  kind: "CHI_TIET" | "TONG_HOP";
  sortOrder: number;
};

/** `PeriodAssignmentResponse` — `/api/period_assignments`. */
export type ApiAssignment = {
  id: number;
  period: { id: number; name: string };
  unit: { id: number; budgetCode: string; name: string };
  /** `locked` = biểu đang khoá để sửa: màn ma trận bỏ qua ô của biểu đó. */
  template: { id: number; shortName: string; name: string; locked: boolean };
};

/** `PeriodSetupResponse` — `GET /api/report_periods/{id}/setup`. */
export type ApiSetupState = {
  periodId: number;
  periodName: string;
  periodStatus: ApiPeriodStatus;
  locked: boolean;
  lockReason: string | null;
  lockSourceId: number | null;
  lockSourceName: string | null;
  assignmentCount: number;
  issuedCells: { unitId: number; templateId: number }[];
  initialPublished: boolean;
  canAssign: boolean;
  canRemove: boolean;
  canPublish: boolean;
  canPublishSupplemental: boolean;
  canClose: boolean;
  canExtend: boolean;
  canWithdraw: boolean;
  readOnlyReason: string | null;
};

/** Một dòng của `GET /api/report_periods/setup_locks`. */
export type ApiPeriodLock = {
  periodId: number;
  kind: string;
  reason: string;
  sourcePeriodId: number | null;
  sourcePeriodName: string | null;
};

/** `InputReportResponse` — `/api/input_reports` (chỉ các trường màn này đọc). */
export type ApiInputReport = {
  id: number;
  unit: { id: number; name: string };
  status:
    | "DRAFT"
    | "SUBMITTED"
    | "APPROVED"
    | "RETURNED"
    | "LOCKED"
    | "CANCELLED"
    | "SUPERSEDED";
  /** Có ngày duyệt mà trạng thái LOCKED = phiếu khoá sau khi duyệt, vẫn tính là đã duyệt. */
  approvedAt?: string | null;
  /** Không có ngày nộp mà trạng thái LOCKED = khoá khi chốt đợt lúc đơn vị chưa nộp. */
  submittedAt?: string | null;
};

/** Thân trả về của các thao tác điều hành / lưu ma trận / áp dụng cho kỳ khác. */
export type ActionResult = {
  message?: string | null;
};

/* ------------------------------------------------------------------ */
/* Mô hình màn hình                                                    */
/* ------------------------------------------------------------------ */

export type PeriodKind = "thang" | "quy" | "6thang" | "nam";

/** Trạng thái riêng của kỳ (tên nội bộ, không đưa lên giao diện). */
export type PeriodStatus = ApiPeriodStatus;

export type PeriodProgress = {
  /** Phiếu đã duyệt. */
  approved: number;
  /** Phiếu chờ duyệt. */
  pendingReview: number;
  /** Phiếu đang nhập / bị trả lại (chưa nộp). */
  notSubmitted: number;
  /** Tổng phiếu đang có của kỳ (không tính bản cũ đã bị thay). */
  total: number;
  /** Đơn vị có phiếu và đã nộp hết (không còn phiếu đang nhập / bị trả lại). */
  unitsSubmitted: number;
  /** Đơn vị có phiếu. */
  unitsWithReports: number;
};

export type Period = {
  id: string;
  name: string;
  kind: PeriodKind;
  /** Khoảng số liệu (yyyy-MM-dd). */
  from: string;
  to: string;
  /** Cửa sổ nhận nhập liệu: mở từ ngày … tới hạn nộp. */
  openFrom: string | null;
  deadline: string | null;
  status: PeriodStatus;
  /** Lần đổi gần nhất — với kỳ đã chốt là ngày chốt. */
  updatedAt: string | null;
};

export type UnitGroup = "tinh" | "huyen" | "xa";

export const UNIT_GROUP_LABEL: Record<UnitGroup, string> = {
  tinh: "Khối tỉnh",
  huyen: "Khối huyện, thành phố",
  xa: "Khối xã, phường",
};

export type Unit = { id: string; name: string; group: UnitGroup | null };

/** Biểu ở cột ma trận: `code` là tên ngắn hiển thị (1a, 1b…). */
export type Template = { id: string; code: string; name: string };

/** Khoá lý do khoá cả kỳ theo id kỳ. */
export type PeriodLock = { reason: string; sourceName: string | null };

export const cellKey = (unitId: string, templateId: string) => `${unitId}:${templateId}`;
export const unitOfKey = (key: string) => key.slice(0, key.indexOf(":"));
export const templateOfKey = (key: string) => key.slice(key.indexOf(":") + 1);

const KIND_FROM_API: Record<ApiPeriod["kind"], PeriodKind> = {
  thang: "thang",
  quy: "quy",
  sau_thang: "6thang",
  nam: "nam",
};

export function toPeriod(p: ApiPeriod): Period {
  return {
    id: String(p.id),
    name: p.name,
    kind: KIND_FROM_API[p.kind] ?? "thang",
    from: p.fromDate,
    to: p.toDate,
    openFrom: p.openFrom,
    deadline: p.deadline,
    status: p.status,
    updatedAt: p.updatedAt,
  };
}

/** Kỳ dài đứng trước khi cùng ngày bắt đầu (Năm → 6 tháng → Quý → Tháng). */
export function sortPeriods(periods: Period[]): Period[] {
  return [...periods].sort(
    (a, b) => a.from.localeCompare(b.from) || b.to.localeCompare(a.to) || a.name.localeCompare(b.name)
  );
}

export function toUnit(u: ApiUnit): Unit {
  return { id: String(u.id), name: u.name, group: u.block };
}

export function toTemplate(t: { id: number; shortName: string; name: string }): Template {
  return { id: String(t.id), code: t.shortName, name: t.name };
}

/** Tình hình phiếu của kỳ, tính từ danh sách phiếu (bỏ bản cũ đã bị thay và phiếu đã huỷ). */
export function toProgress(reports: ApiInputReport[]): PeriodProgress {
  const live = reports.filter((r) => r.status !== "SUPERSEDED" && r.status !== "CANCELLED");
  const editableUnits = new Set<number>();
  const units = new Set<number>();
  let approved = 0;
  let pendingReview = 0;
  let notSubmitted = 0;
  for (const r of live) {
    units.add(r.unit.id);
    if (r.status === "APPROVED" || (r.status === "LOCKED" && r.approvedAt)) approved += 1;
    else if (r.status === "SUBMITTED") pendingReview += 1;
    else if (
      r.status === "DRAFT" ||
      r.status === "RETURNED" ||
      // Khoá khi chốt đợt mà chưa từng nộp: đơn vị vẫn là CHƯA nộp, không phải "đã nộp".
      (r.status === "LOCKED" && !r.submittedAt)
    ) {
      notSubmitted += 1;
      editableUnits.add(r.unit.id);
    }
  }
  return {
    approved,
    pendingReview,
    notSubmitted,
    total: live.length,
    unitsSubmitted: [...units].filter((u) => !editableUnits.has(u)).length,
    unitsWithReports: units.size,
  };
}

/** Cách phát biểu bổ sung cho một đơn vị (UC-26, BR-26.2). */
export type SupplementRoute = "append" | "separate" | "fresh";

export function supplementRouteOf(
  unitId: string,
  reports: ApiInputReport[]
): SupplementRoute {
  const own = reports.filter(
    (r) => String(r.unit.id) === unitId && r.status !== "SUPERSEDED" && r.status !== "CANCELLED"
  );
  if (own.length === 0) return "fresh";
  return own.some((r) => r.status === "DRAFT" || r.status === "RETURNED") ? "append" : "separate";
}

/* ---------- Ngày tháng (chuỗi yyyy-MM-dd, tính theo giờ máy) ---------- */

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function toIso(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/** Số ngày từ `from` tới `to` (to − from). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

/** dd/MM/yyyy ; trống → "—". */
export function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDate(parseDate(iso));
}

/** "01/10 – 31/12/2026" */
export function fmtRange(from: string, to: string): string {
  const head = fmt(from).slice(0, 5);
  return `${head} – ${fmt(to)}`;
}

/** Đọc "dd/MM/yyyy" do người dùng gõ; sai dạng → null. */
export function parseVnDate(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return toIso(date);
}

/* ---------- Luật kỳ ---------- */

/**
 * Dòng ở đầu ma trận khi kỳ bị khoá cả kỳ (UC-31, khung Figma 310:60180). Máy chủ cho biết kỳ
 * gây khoá; không có thì dùng nguyên câu lý do của máy chủ.
 */
export function lockLine(lock: PeriodLock): string {
  return lock.sourceName
    ? `Kỳ này trùng thời gian với ${lock.sourceName} đã mở đợt nên không thiết lập được. Hãy thiết lập ở ${lock.sourceName}.`
    : lock.reason;
}

/** Chú thích khi rê chuột lên ô của kỳ bị khoá, và lý do ở hộp "Áp dụng cho kỳ khác". */
export function lockShortReason(lock: PeriodLock): string {
  return lock.sourceName
    ? `Kỳ này đã khoá vì trùng thời gian với ${lock.sourceName} đã mở đợt.`
    : lock.reason;
}

export const STATUS_VIEW: Record<PeriodStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Chưa thiết lập", tone: "neutral" },
  ready: { label: "Đã thiết lập", tone: "success" },
  published: { label: "Chưa mở", tone: "neutral" },
  open: { label: "Đang mở", tone: "info" },
  overdue: { label: "Quá hạn", tone: "overdue" },
  closed: { label: "Đã chốt", tone: "locked" },
  locked: { label: "Đã khoá", tone: "locked" },
  cancelled: { label: "Đã huỷ", tone: "outline" },
};

export const LOCKED_VIEW = { label: "Đã khoá", tone: "locked" as StatusTone };

export function periodView(
  p: Period,
  lock: PeriodLock | null
): { label: string; tone: StatusTone } {
  return lock ? LOCKED_VIEW : STATUS_VIEW[p.status];
}

/**
 * Cách ma trận cho thao tác:
 * - edit: gán và gỡ (Chưa thiết lập / Đã thiết lập)
 * - addOnly: chỉ gán thêm, đi đường đợt bổ sung (Đang mở)
 * - view: chỉ xem (Chưa mở / Quá hạn / Đã chốt / Đã khoá / Đã huỷ)
 * - locked: khoá cả kỳ vì trùng kỳ đã mở đợt
 */
export type MatrixMode = "edit" | "addOnly" | "view" | "locked";

export function matrixMode(p: Period, lock: PeriodLock | null): MatrixMode {
  if (lock) return "locked";
  if (p.status === "draft" || p.status === "ready") return "edit";
  if (p.status === "open") return "addOnly";
  return "view";
}

/** Câu ở chân ma trận khi kỳ không cho tích tự do. */
export function footerNote(p: Period, mode: MatrixMode): string | null {
  if (mode === "addOnly")
    return "Kỳ này đã mở đợt: bạn chỉ thêm được biểu mới, không bỏ được biểu đã phát cho đơn vị.";
  if (mode !== "view") return null;
  if (p.status === "published")
    return "Kỳ này đã mở đợt và đang chờ tới ngày nhận số liệu nên chỉ xem được, không tích thêm biểu mẫu.";
  if (p.status === "overdue") return "Kỳ này đã quá hạn nên chỉ xem được, không tích thêm biểu mẫu.";
  if (p.status === "cancelled") return "Kỳ này đã huỷ nên chỉ xem được.";
  return "Sở đã chốt kỳ này nên chỉ xem được, không tích thêm biểu mẫu.";
}

/** Số đơn vị có ít nhất một ô đã lưu. */
export function assignedUnitIds(saved: ReadonlySet<string>): Set<string> {
  const ids = new Set<string>();
  saved.forEach((k) => ids.add(unitOfKey(k)));
  return ids;
}

/** Bỏ dấu để tìm "bien hoa" ra "Biên Hoà". */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/* ---------- Lỗi từ máy chủ → câu cho người dùng ---------- */

const HAS_VIETNAMESE = /[À-ỹđĐ]/;

/**
 * Câu báo lỗi cho cán bộ: ưu tiên câu tiếng Việt máy chủ gửi (lỗi nghiệp vụ 409 đều là câu
 * tiếng Việt), lỗi kiểm dữ liệu lấy câu của trường đầu tiên; câu tiếng Anh mặc định của khung
 * (không có quyền, lỗi máy chủ) đổi sang câu tiếng Việt.
 */
export function errorText(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const e = error as { message?: unknown; statusCode?: unknown; errors?: unknown };
  if (e.errors && typeof e.errors === "object") {
    const first = Object.values(e.errors as Record<string, unknown>).find(
      (v) => typeof v === "string" && HAS_VIETNAMESE.test(v)
    );
    if (typeof first === "string") return first;
  }
  if (typeof e.message === "string" && HAS_VIETNAMESE.test(e.message)) return e.message;
  if (e.statusCode === 403) return "Bạn không có quyền làm việc này.";
  if (e.statusCode === 404) return "Không tìm thấy dữ liệu, có thể đã bị xoá. Bạn tải lại trang rồi thử lại.";
  return fallback;
}
