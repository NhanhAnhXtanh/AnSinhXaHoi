import { formatDate, formatDateTime, type StatusTone } from "@/shared/components/asxh";

import type {
  CellState,
  Counts,
  ReportStatus,
  ReportUnitType,
  TodoItem,
  UnitRow,
  UnitState,
} from "./types";

/**
 * Cách gọi và tô màu từng tình trạng phiếu trên Trang chủ.
 *
 * Màu đi theo token trạng thái của theme: đã duyệt = success, chờ duyệt =
 * warning, bị trả lại = destructive, đang nhập = info, đã chốt = neutral. Tên
 * lớp viết nguyên chuỗi để Tailwind quét được.
 */
export type SheetStatus = "approved" | "pending" | "returned" | "entering" | "locked";

export const SHEET_STATUS: Record<
  SheetStatus,
  { label: string; tone: StatusTone; fill: string; stroke: string; text: string }
> = {
  approved: {
    label: "Đã duyệt",
    tone: "success",
    fill: "bg-success",
    stroke: "stroke-success",
    text: "text-success-text",
  },
  pending: {
    label: "Chờ duyệt",
    tone: "warning",
    fill: "bg-warning",
    stroke: "stroke-warning",
    text: "text-warning-text",
  },
  returned: {
    label: "Bị trả lại",
    tone: "destructive",
    fill: "bg-destructive",
    stroke: "stroke-destructive",
    text: "text-destructive-text",
  },
  entering: {
    label: "Đang nhập liệu",
    tone: "info",
    fill: "bg-info",
    stroke: "stroke-info",
    text: "text-info-text",
  },
  locked: {
    label: "Đã chốt, chưa nộp",
    tone: "neutral",
    fill: "bg-neutral",
    stroke: "stroke-neutral",
    text: "text-neutral-text",
  },
};

/** Bốn tình trạng luôn hiện; "đã chốt" chỉ hiện khi có. */
export const SHEET_STATUS_ORDER: SheetStatus[] = ["approved", "pending", "returned", "entering"];

/** Các tình trạng cần vẽ cho một bộ đếm: thêm "đã chốt" khi có phiếu như vậy. */
export const statusesOf = (counts: Counts): SheetStatus[] =>
  counts.locked > 0 ? [...SHEET_STATUS_ORDER, "locked"] : SHEET_STATUS_ORDER;

/** Ô tình trạng của một đơn vị trong một kỳ (bảng "Theo đơn vị"). */
export const CELL_STATUS: Record<CellState, { label: string; tone: StatusTone }> = {
  APPROVED: { label: "Đã duyệt", tone: "success" },
  PENDING: { label: "Chờ duyệt", tone: "warning" },
  RETURNED: { label: "Bị trả lại", tone: "destructive" },
  PARTIAL: { label: "Nộp thiếu", tone: "warning" },
  ENTERING: { label: "Đang nhập", tone: "info" },
  NOT_STARTED: { label: "Chưa nộp", tone: "neutral" },
};

/** Tình trạng một phiếu ở khối "Chi tiết đơn vị". */
export function reportBadge(
  status: ReportStatus,
  sheetsDone: number
): { label: string; tone: StatusTone } {
  switch (status) {
    case "APPROVED":
      return { label: "Đã duyệt", tone: "success" };
    case "SUBMITTED":
      return { label: "Chờ duyệt", tone: "warning" };
    case "RETURNED":
      return { label: "Bị trả lại", tone: "destructive" };
    case "LOCKED":
      return { label: "Đã chốt", tone: "locked" };
    case "DRAFT":
      return sheetsDone > 0
        ? { label: "Đang nhập", tone: "info" }
        : { label: "Chưa nộp", tone: "neutral" };
    default:
      return { label: "Đã huỷ", tone: "neutral" };
  }
}

/** Tình trạng chung của một đơn vị qua các kỳ đang xem. */
export const UNIT_PROGRESS: Record<UnitState, { label: string; tone: StatusTone; dot: string }> = {
  NOT_SUBMITTED: { label: "Chưa nộp", tone: "neutral", dot: "bg-neutral" },
  RETURNED: { label: "Có trả lại", tone: "destructive", dot: "bg-destructive" },
  PARTIAL: { label: "Nộp thiếu", tone: "warning", dot: "bg-warning" },
  COMPLETE: { label: "Đã nộp đủ", tone: "success", dot: "bg-success" },
};

export const UNIT_PROGRESS_ORDER: UnitState[] = ["NOT_SUBMITTED", "RETURNED", "PARTIAL", "COMPLETE"];

/** Tình trạng ô của một kỳ quy về tình trạng chung khi chỉ xem đúng kỳ đó. */
const CELL_TO_PROGRESS: Record<CellState, UnitState> = {
  NOT_STARTED: "NOT_SUBMITTED",
  ENTERING: "NOT_SUBMITTED",
  RETURNED: "RETURNED",
  PARTIAL: "PARTIAL",
  PENDING: "COMPLETE",
  APPROVED: "COMPLETE",
};

/**
 * Tình trạng chung của đơn vị theo bộ lọc kỳ: xem mọi kỳ thì lấy đúng số máy
 * chủ đã tính; xem một kỳ thì quy từ ô của kỳ đó (cùng quy tắc, thu về một kỳ).
 * `null` = đơn vị không có phiếu nào trong kỳ đang lọc.
 */
export function unitProgress(unit: UnitRow, periodId: number | null): UnitState | null {
  if (periodId === null) return unit.state;
  const cell = unit.periodStates[String(periodId)];
  return cell ? CELL_TO_PROGRESS[cell] : null;
}

export const UNIT_TYPE_LABEL: Record<ReportUnitType, string> = {
  ubnd_xa: "Xã, phường",
  ubnd_huyen: "Huyện, thành phố",
  truong: "Trường học",
  so: "Sở, ban, ngành",
  tinh: "Cấp tỉnh",
  khac: "Đơn vị khác",
};

/** Làm tròn phần trăm, chia cho 0 thì ra 0. */
export const percent = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

/** "Quá hạn 10 ngày" / "Còn 21 ngày" / "Hạn hôm nay" / "Chưa đặt hạn". */
export function deadlineLabel(daysLeft: number | null, overdue: boolean): string {
  if (daysLeft === null) return overdue ? "Quá hạn" : "Chưa đặt hạn";
  if (daysLeft < 0) return `Quá hạn ${-daysLeft} ngày`;
  if (overdue) return "Quá hạn";
  if (daysLeft === 0) return "Hạn hôm nay";
  return `Còn ${daysLeft} ngày`;
}

/** "01/09 – 05/10/2026": cửa sổ nhận số liệu, bỏ năm ở đầu mút trước. */
export function receivingRange(from: string | null, to: string | null): string {
  if (!from && !to) return "";
  if (!from) return `đến ${formatDate(to as string)}`;
  if (!to) return `từ ${formatDate(from)}`;
  return `${formatDate(from).slice(0, 5)} – ${formatDate(to)}`;
}

/** Dòng phụ của một việc ở khối "Cần xử lý". */
export function todoDetail(item: TodoItem): string {
  const head = item.periodName;
  switch (item.kind) {
    case "OVERDUE":
      return item.deadline
        ? `${head} · Hạn nộp ${formatDate(item.deadline)}, ${
            item.daysLeft !== null && item.daysLeft < 0 ? `quá ${-item.daysLeft} ngày` : "đã quá hạn"
          }`
        : `${head} · Đã quá hạn nộp`;
    case "PENDING":
      return item.submittedAt
        ? `${head} · Nộp ${formatDateTime(item.submittedAt)}, chờ Sở duyệt`
        : `${head} · Chờ Sở duyệt`;
    case "RETURNED": {
      const when = item.returnedAt ? ` ${formatDate(item.returnedAt)}` : "";
      const reason = item.returnReason?.trim() ? `, ${item.returnReason.trim()}` : "";
      return `${head} · Sở trả lại${when}${reason}`;
    }
    case "ENTERING": {
      if (!item.deadline) return `${head} · Chưa đặt hạn nộp`;
      const left =
        item.daysLeft === null || item.daysLeft > 0
          ? `còn ${item.daysLeft ?? 0} ngày`
          : "hạn hôm nay";
      return `${head} · Hạn nộp ${formatDate(item.deadline)}, ${left}`;
    }
  }
}
