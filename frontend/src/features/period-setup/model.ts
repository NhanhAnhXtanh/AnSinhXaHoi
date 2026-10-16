import { formatDate, type StatusTone } from "@/shared/components/asxh";

export type PeriodKind = "thang" | "quy" | "6thang" | "nam";

/** Trạng thái riêng của kỳ (tên nội bộ, không đưa lên giao diện). */
export type PeriodStatus =
  | "draft" // Chưa thiết lập
  | "ready" // Đã thiết lập
  | "published" // Chưa mở — đã mở đợt, chờ tới ngày nhận số liệu
  | "open" // Đang mở
  | "overdue" // Quá hạn
  | "closed"; // Đã chốt

export type PeriodProgress = {
  approved: number;
  pendingReview: number;
  notSubmitted: number;
};

export type Period = {
  id: string;
  name: string;
  kind: PeriodKind;
  /** Khoảng số liệu (yyyy-MM-dd). */
  from: string;
  to: string;
  /** Cửa sổ nhận nhập liệu: mở từ ngày … tới hạn nộp. */
  openFrom: string;
  deadline: string;
  status: PeriodStatus;
  closedAt?: string;
  /** Tình hình phiếu khi kỳ đã mở đợt. */
  progress?: PeriodProgress;
};

export type UnitGroup = "huyen" | "xa";

export const UNIT_GROUP_LABEL: Record<UnitGroup, string> = {
  huyen: "Khối huyện, thành phố",
  xa: "Khối xã, phường",
};

export type Unit = { id: string; name: string; group: UnitGroup };

export type Template = { code: string; name: string };

export const cellKey = (unitId: string, code: string) => `${unitId}:${code}`;
export const unitOfKey = (key: string) => key.slice(0, key.indexOf(":"));
export const codeOfKey = (key: string) => key.slice(key.indexOf(":") + 1);

/* ---------- Ngày tháng (chuỗi yyyy-MM-dd, tính theo giờ máy) ---------- */

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function toIso(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/** Số ngày từ `from` tới `to` (to − from). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000
  );
}

/** dd/MM/yyyy */
export function fmt(iso: string): string {
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
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  )
    return null;
  return toIso(date);
}

/* ---------- Luật kỳ ---------- */

/** Kỳ đã mở đợt (có phiếu phát cho đơn vị). */
export const OPENED_STATUSES: PeriodStatus[] = [
  "published",
  "open",
  "overdue",
  "closed",
];

export function isOpened(p: Period): boolean {
  return OPENED_STATUSES.includes(p.status);
}

export function overlaps(a: Period, b: Period): boolean {
  return a.from <= b.to && b.from <= a.to;
}

/**
 * Khoá cả kỳ (UC-31): kỳ chưa mở đợt mà trùng thời gian với một kỳ KHÁC đã mở
 * đợt thì không thiết lập, không mở đợt được cho bất kỳ đơn vị nào.
 * Trả về kỳ gây khoá (ưu tiên kỳ còn đang chạy), hoặc null nếu không khoá.
 */
export function lockSource(p: Period, all: Period[]): Period | null {
  if (isOpened(p)) return null;
  const hits = all
    .filter((o) => o.id !== p.id && isOpened(o) && overlaps(o, p))
    .sort((a, b) => a.from.localeCompare(b.from));
  if (hits.length === 0) return null;
  return hits.find((h) => h.status !== "closed") ?? hits[0] ?? null;
}

export function lockLine(source: Period): string {
  return `Kỳ này trùng thời gian với ${source.name} đã mở đợt nên không thiết lập được. Hãy thiết lập ở ${source.name}.`;
}

export function lockCellTooltip(source: Period): string {
  return `Kỳ này đã khoá vì trùng thời gian với ${source.name} đã mở đợt.`;
}

export const STATUS_VIEW: Record<
  PeriodStatus,
  { label: string; tone: StatusTone }
> = {
  draft: { label: "Chưa thiết lập", tone: "neutral" },
  ready: { label: "Đã thiết lập", tone: "success" },
  published: { label: "Chưa mở", tone: "neutral" },
  open: { label: "Đang mở", tone: "info" },
  overdue: { label: "Quá hạn", tone: "overdue" },
  closed: { label: "Đã chốt", tone: "locked" },
};

export const LOCKED_VIEW = { label: "Đã khoá", tone: "locked" as StatusTone };

export function periodView(
  p: Period,
  all: Period[]
): { label: string; tone: StatusTone } {
  return lockSource(p, all) ? LOCKED_VIEW : STATUS_VIEW[p.status];
}

/**
 * Cách ma trận cho thao tác:
 * - edit: gán và gỡ (Chưa thiết lập / Đã thiết lập)
 * - addOnly: chỉ gán thêm, đi đường đợt bổ sung (Đang mở)
 * - view: chỉ xem (Chưa mở / Quá hạn / Đã chốt)
 * - locked: khoá cả kỳ vì trùng kỳ đã mở đợt
 */
export type MatrixMode = "edit" | "addOnly" | "view" | "locked";

export function matrixMode(p: Period, lock: Period | null): MatrixMode {
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
  if (p.status === "overdue")
    return "Kỳ này đã quá hạn nên chỉ xem được, không tích thêm biểu mẫu.";
  return "Sở đã chốt kỳ này nên chỉ xem được, không tích thêm biểu mẫu.";
}

/** Số đơn vị có ít nhất một ô đã lưu. */
export function assignedUnitIds(saved: Set<string>): Set<string> {
  const ids = new Set<string>();
  saved.forEach((k) => ids.add(unitOfKey(k)));
  return ids;
}
