import type { StatusTone } from "@/shared/components/asxh";

/**
 * Kiểu dữ liệu và quy tắc hiển thị của phiếu nhập phía đơn vị.
 *
 * Tên trạng thái ở đây là tên nội bộ, KHÔNG đưa lên giao diện — chữ người dùng
 * thấy lấy từ `STATUS_META`.
 */

/** Trạng thái phiếu (UC-33..38). "Quá hạn" không phải trạng thái riêng — xem `displayStatus`. */
export type ReportStatus = "draft" | "returned" | "submitted" | "approved" | "locked";

/** Trạng thái kỳ báo cáo — quyết định phiếu còn nhập được hay không. */
export type PeriodState = "open" | "overdue" | "closed";

/** Trạng thái một tờ biểu trong phiếu. */
export type SheetState = "in_progress" | "completed" | "no_data";

/** Trạng thái để hiển thị: thêm "overdue" = phiếu đang nhập của kỳ đã quá hạn. */
export type DisplayStatus = ReportStatus | "overdue";

export type SheetLine = {
  label: string;
  /** Cột C */
  previous: number | null;
  /** Cột D — cột đơn vị nhập */
  current: number | null;
  note?: string;
};

export type ReportSheet = {
  /** Tên ngắn trên tab: "1a", "1b"… */
  code: string;
  title: string;
  unit: string;
  /** Tiêu đề ba cột số C, D, E (E = C + D). */
  headers: [string, string, string];
  lines: SheetLine[];
  state: SheetState;
};

export type TreasuryFile = {
  id: string;
  name: string;
  size: number;
  /** Tệp thật người dùng vừa chọn (tệp mẫu thì không có). */
  file?: File;
};

export type RevisionEntry = {
  no: number;
  tone: StatusTone;
  statusLabel: string;
  meta: string;
  reason?: string;
};

export type InputReport = {
  id: string;
  periodName: string;
  /** yyyy-MM-dd */
  periodFrom: string;
  periodTo: string;
  dueDate: string;
  periodState: PeriodState;
  orgName: string;
  templateSet: string;
  templateVersion: string;
  revision: number;
  status: ReportStatus;
  /** yyyy-MM-ddTHH:mm:ss */
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  lockedAt?: string;
  returnedAt?: string;
  returnReason?: string;
  sheets: ReportSheet[];
  attachments: TreasuryFile[];
  treasuryConfirmed: boolean;
  /** Mới → cũ. Phần tử đầu là phiên bản hiện tại. */
  history: RevisionEntry[];
};

export const STATUS_META: Record<DisplayStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Đang nhập liệu", tone: "info" },
  returned: { label: "Bị trả lại", tone: "destructive" },
  submitted: { label: "Chờ duyệt", tone: "warning" },
  overdue: { label: "Quá hạn", tone: "overdue" },
  locked: { label: "Đã chốt", tone: "locked" },
  approved: { label: "Đã phê duyệt", tone: "success" },
};

/** Thứ tự các lựa chọn trong ô lọc Trạng thái. */
export const STATUS_OPTIONS: DisplayStatus[] = [
  "draft",
  "returned",
  "submitted",
  "overdue",
  "locked",
  "approved",
];

export function displayStatus(r: InputReport): DisplayStatus {
  if (r.status === "draft" && r.periodState === "overdue") return "overdue";
  return r.status;
}

/** BR-34.2: nhập được khi phiếu Đang nhập liệu / Bị trả lại VÀ kỳ đang mở. */
export function isEditable(r: InputReport): boolean {
  return (r.status === "draft" || r.status === "returned") && r.periodState === "open";
}

export function isSheetDone(s: ReportSheet): boolean {
  return s.state !== "in_progress";
}

export function doneCount(r: InputReport): number {
  return r.sheets.filter(isSheetDone).length;
}

/** Phiếu đã có gì để xem chưa (UC-33 5a). */
export function hasAnyData(r: InputReport): boolean {
  return r.sheets.some((s) => isSheetDone(s) || s.lines.some((l) => l.current !== null));
}

// ---------------------------------------------------------------- ngày giờ

/** "Hôm nay" của dữ liệu mẫu — để chữ "còn 3 ngày" khớp thiết kế. */
export const TODAY = "2027-01-12";

/** Thời điểm hiện tại trong dữ liệu mẫu: ngày TODAY + giờ thật của máy. */
export function nowIso(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${TODAY}T${hh}:${mm}:00`;
}

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** b − a theo ngày lịch. */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

function ddmm(isoDate: string): string {
  const [, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}`;
}

function ddmmyyyy(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "01/10–31/12/2026" (cùng năm) hoặc "01/12/2026–31/01/2027". */
export function formatRange(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${sameYear ? ddmm(from) : ddmmyyyy(from)}–${ddmmyyyy(to)}`;
}

// ------------------------------------------------------- dòng phụ trong bảng

export type DueLine = { text: string; tone?: "destructive" };

/** Dòng phụ dưới Hạn nộp (UC-33 bước 4). */
export function dueLine(r: InputReport): DueLine {
  if (r.status === "locked") return { text: "Kỳ đã chốt" };
  if (r.submittedAt && (r.status === "submitted" || r.status === "approved")) {
    const late = daysBetween(r.dueDate, r.submittedAt);
    return late > 0 ? { text: `Nộp muộn ${late} ngày` } : { text: "Đã nộp đúng hạn" };
  }
  if (r.status === "approved") return { text: "Đã nộp đúng hạn" };
  if (r.periodState === "overdue") return { text: "Hết hạn nộp", tone: "destructive" };
  const left = daysBetween(TODAY, r.dueDate);
  if (left > 0) return { text: `còn ${left} ngày` };
  if (left === 0) return { text: "Hạn chót hôm nay" };
  return { text: "Hết hạn nộp", tone: "destructive" };
}
