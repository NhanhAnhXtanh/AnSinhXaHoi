import type { StatusTone } from "@/shared/components/asxh";

import type { CellStatus, SheetStatus, Unit } from "./fixtures";

/**
 * Cách gọi và tô màu từng tình trạng phiếu trên Trang chủ.
 *
 * Màu đi theo token trạng thái của theme: đã duyệt = success, chờ duyệt =
 * warning, bị trả lại = destructive, đang nhập = info. Tên lớp viết nguyên
 * chuỗi để Tailwind quét được.
 */
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
};

export const SHEET_STATUS_ORDER: SheetStatus[] = [
  "approved",
  "pending",
  "returned",
  "entering",
];

/** Ô tình trạng của một đơn vị trong một kỳ (bảng "Theo đơn vị"). */
export const CELL_STATUS: Record<CellStatus, { label: string; tone: StatusTone }> = {
  approved: { label: "Đã duyệt", tone: "success" },
  pending: { label: "Chờ duyệt", tone: "warning" },
  returned: { label: "Bị trả lại", tone: "destructive" },
  entering: { label: "Đang nhập", tone: "info" },
  notStarted: { label: "Chưa nộp", tone: "neutral" },
};

/** Tình trạng chung của một đơn vị qua các kỳ đang xem. */
export type UnitProgress = "notSubmitted" | "returned" | "partial" | "complete";

export const UNIT_PROGRESS: Record<
  UnitProgress,
  { label: string; tone: StatusTone; dot: string }
> = {
  notSubmitted: { label: "Chưa nộp", tone: "neutral", dot: "bg-neutral" },
  returned: { label: "Có trả lại", tone: "destructive", dot: "bg-destructive" },
  partial: { label: "Nộp thiếu", tone: "warning", dot: "bg-warning" },
  complete: { label: "Đã nộp đủ", tone: "success", dot: "bg-success" },
};

export const UNIT_PROGRESS_ORDER: UnitProgress[] = [
  "notSubmitted",
  "returned",
  "partial",
  "complete",
];

export const isSubmitted = (s: CellStatus) => s === "approved" || s === "pending";

/**
 * Có phiếu bị trả lại thì cần xử lý trước hết; còn lại xét đã nộp bao nhiêu kỳ.
 * Chờ duyệt tính là đã nộp — phần của đơn vị đã xong.
 */
export function unitProgress(unit: Unit, periodIds: string[]): UnitProgress {
  const statuses = unit.reports
    .filter((r) => periodIds.includes(r.periodId))
    .map((r) => r.status);
  if (statuses.includes("returned")) return "returned";
  if (statuses.length > 0 && statuses.every(isSubmitted)) return "complete";
  if (statuses.some(isSubmitted)) return "partial";
  return "notSubmitted";
}

/** Làm tròn phần trăm, chia cho 0 thì ra 0. */
export const percent = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;
