import type { StatusTone } from "@/shared/components/asxh";

import type { ApiSheetCompletion, DisplayKey, InputReportRecord, InputReportSheetRecord } from "./api";

/**
 * Quy tắc hiển thị của phiếu nhập phía đơn vị (UC-33..45).
 *
 * Mở nhập theo TRẠNG THÁI KỲ: phiếu Đang nhập liệu / Bị trả lại chỉ nhập được khi
 * kỳ Đang mở. "Quá hạn" không phải trạng thái phiếu mà là phiếu chưa nộp của kỳ
 * Quá hạn — bị khoá nhập hẳn (chờ Sở gia hạn).
 */

/** Trạng thái để hiển thị. */
export type DisplayStatus = DisplayKey | "cancelled" | "superseded";

export const STATUS_META: Record<DisplayStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Đang nhập liệu", tone: "info" },
  returned: { label: "Bị trả lại", tone: "destructive" },
  submitted: { label: "Chờ duyệt", tone: "warning" },
  overdue: { label: "Quá hạn", tone: "overdue" },
  locked: { label: "Đã chốt", tone: "locked" },
  approved: { label: "Đã phê duyệt", tone: "success" },
  cancelled: { label: "Đã huỷ", tone: "neutral" },
  superseded: { label: "Bản cũ", tone: "neutral" },
};

/** Thứ tự các lựa chọn trong ô lọc Trạng thái. */
export const STATUS_OPTIONS: DisplayKey[] = ["draft", "returned", "submitted", "overdue", "locked", "approved"];

export function displayStatus(r: InputReportRecord): DisplayStatus {
  switch (r.status) {
    case "DRAFT":
      return r.period.status === "overdue" ? "overdue" : "draft";
    case "RETURNED":
      return "returned";
    case "SUBMITTED":
      return "submitted";
    case "APPROVED":
      return "approved";
    case "LOCKED":
      // Khoá sau khi duyệt (còn ngày duyệt) vẫn là phiếu đã duyệt; không có = chốt khi chưa nộp.
      return r.approvedAt ? "approved" : "locked";
    case "CANCELLED":
      return "cancelled";
    case "SUPERSEDED":
      return "superseded";
  }
}

/** BR-34.2: nhập được khi phiếu Đang nhập liệu / Bị trả lại VÀ kỳ Đang mở. */
export function isEditable(r: InputReportRecord): boolean {
  return (r.status === "DRAFT" || r.status === "RETURNED") && r.period.status === "open";
}

export function isSheetDone(completion: ApiSheetCompletion): boolean {
  return completion === "COMPLETED" || completion === "NO_DATA";
}

/**
 * Phiếu đã có gì để xem chưa (UC-33 5a). Danh sách chỉ biết số biểu đã xong, nên
 * "đã nhập" ở đây là đã xong ít nhất một biểu hoặc đã từng nộp.
 */
export function hasAnyData(r: InputReportRecord): boolean {
  return r.progress.done > 0 || r.submittedAt !== null;
}

/** Biểu nên mở đầu tiên: biểu đầu chưa xong nếu còn nhập được, không thì biểu đầu. */
export function firstSheetToOpen(r: InputReportRecord, sheets: InputReportSheetRecord[]): number | undefined {
  const open = isEditable(r) ? sheets.find((s) => !isSheetDone(s.completion)) : undefined;
  return (open ?? sheets[0])?.id;
}

// ---------------------------------------------------------------- ngày giờ

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** "Hôm nay" theo giờ máy, dạng yyyy-MM-dd. */
export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Ngày lịch (yyyy-MM-dd, giờ máy) của một thời điểm ISO có múi giờ. */
function localDateOf(instant: string): string {
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return instant.slice(0, 10);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
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
export function dueLine(r: InputReportRecord): DueLine {
  const due = r.period.deadline;
  const approved = r.status === "APPROVED" || (r.status === "LOCKED" && r.approvedAt !== null);
  if (r.status === "LOCKED" && !approved) return { text: "Kỳ đã chốt" };
  if (r.submittedAt && (r.status === "SUBMITTED" || approved)) {
    if (!due) return { text: "Đã nộp" };
    const late = daysBetween(due, localDateOf(r.submittedAt));
    return late > 0 ? { text: `Nộp muộn ${late} ngày` } : { text: "Đã nộp đúng hạn" };
  }
  if (approved) return { text: "Đã nộp đúng hạn" };
  if (r.period.status === "overdue") return { text: "Hết hạn nộp", tone: "destructive" };
  if (r.period.status === "published") return { text: "Kỳ chưa mở nhập" };
  if (!due) return { text: "" };
  const left = daysBetween(todayIso(), due);
  if (left > 0) return { text: `còn ${left} ngày` };
  if (left === 0) return { text: "Hạn chót hôm nay" };
  return { text: "Hết hạn nộp", tone: "destructive" };
}
