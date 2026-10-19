import type { CrudFilter } from "@refinedev/core";

import type { StatusTone } from "@/shared/components/asxh";
import { formatDate, formatDateTime } from "@/shared/components/asxh";

import type { InputReportRecord, InputReportSummary } from "./api";

/**
 * Quy tắc hiển thị của màn Duyệt phiếu (UC-39..44), phía Sở.
 *
 * Hàng đợi chỉ liệt kê 4 trạng thái (BR-39.1): Chờ duyệt, Đã trả lại, Đã phê
 * duyệt, Chưa nộp (gồm cả phiếu chưa nộp của kỳ quá hạn). Không hiện Đã khoá,
 * Đã huỷ, Bản cũ.
 */
export type ReviewStatus = "pending" | "returned" | "approved" | "notSubmitted";

export const STATUS_META: Record<ReviewStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Chờ duyệt", tone: "warning" },
  returned: { label: "Đã trả lại", tone: "destructive" },
  approved: { label: "Đã phê duyệt", tone: "success" },
  notSubmitted: { label: "Chưa nộp", tone: "neutral" },
};

/** Thứ tự thẻ lọc nhanh và ô Trạng thái trong Bộ lọc khác. */
export const STATUS_ORDER: ReviewStatus[] = ["pending", "returned", "approved", "notSubmitted"];

/** Tham số `display` của máy chủ ứng với từng trạng thái phía Sở. */
const DISPLAY_KEYS: Record<ReviewStatus, string[]> = {
  pending: ["submitted"],
  returned: ["returned"],
  approved: ["approved"],
  notSubmitted: ["draft", "overdue"],
};

/** Trạng thái phía Sở của một phiếu; `null` = không thuộc hàng đợi (đã khoá, huỷ, bản cũ). */
export function reviewStatus(r: InputReportRecord): ReviewStatus | null {
  switch (r.status) {
    case "SUBMITTED":
      return "pending";
    case "RETURNED":
      return "returned";
    case "APPROVED":
      return "approved";
    case "LOCKED":
      // Khoá sau khi duyệt (còn ngày duyệt) vẫn là phiếu đã duyệt; không có = chốt khi chưa nộp.
      return r.approvedAt ? "approved" : null;
    case "DRAFT":
      return "notSubmitted";
    default:
      return null;
  }
}

/** Nhãn + màu badge — cả các trạng thái ngoài hàng đợi khi mở thẳng một phiếu. */
export function badgeOf(r: InputReportRecord): { label: string; tone: StatusTone } {
  const s = reviewStatus(r);
  if (s === "approved" && r.status === "LOCKED") return { label: "Đã phê duyệt · đã khoá", tone: "success" };
  if (s === "approved" && r.period.status === "closed") return { label: "Đã chốt", tone: "locked" };
  if (s) return STATUS_META[s];
  switch (r.status) {
    case "LOCKED":
      return { label: "Đã chốt", tone: "locked" };
    case "CANCELLED":
      return { label: "Đã huỷ", tone: "neutral" };
    default:
      return { label: "Bản cũ", tone: "neutral" };
  }
}

/** Lọc trạng thái gửi lên máy chủ: giao của thẻ nhanh và ô Trạng thái; mặc định đủ 4 trạng thái. */
export function displayFilter(quick: ReviewStatus | null, statuses: ReviewStatus[]): CrudFilter {
  let chosen: ReviewStatus[] = statuses.length === 0 ? STATUS_ORDER : statuses;
  if (quick) chosen = chosen.includes(quick) ? [quick] : [];
  const keys = chosen.flatMap((s) => DISPLAY_KEYS[s]);
  return { field: "display", operator: "eq", value: keys.length === 0 ? "none" : keys.join(",") };
}

/** Số trên thẻ lọc nhanh. */
export function countOf(summary: InputReportSummary | undefined, s: ReviewStatus): number {
  if (!summary) return 0;
  return DISPLAY_KEYS[s].reduce((acc, key) => acc + (summary.counts[key as keyof typeof summary.counts] ?? 0), 0);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: string): number {
  const date = new Date(d.length === 10 ? `${d}T00:00` : d);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function daysBetween(from: string, to: string): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

/** Hôm nay theo giờ máy (yyyy-MM-dd). `toISOString()` là ngày UTC — 0h–7h sáng ở Việt Nam còn là hôm qua. */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function timeOf(d: string): string {
  return formatDateTime(d).slice(11);
}

/** "01/10–31/12/2026" (cùng năm) hoặc "01/12/2026–31/01/2027". */
export function formatRange(from: string, to: string): string {
  const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const full = (iso: string) => `${ddmm(iso)}/${iso.slice(0, 4)}`;
  return from.slice(0, 4) === to.slice(0, 4) ? `${ddmm(from)}–${full(to)}` : `${full(from)}–${full(to)}`;
}

/** Dòng phụ dưới badge trạng thái trên bảng. */
export function statusSubline(r: InputReportRecord): string {
  const deadline = r.period.deadline;
  switch (reviewStatus(r)) {
    case "approved":
      return `Duyệt ${r.approvedAt ? formatDate(r.approvedAt) : ""}${r.approvedBy ? ` · ${r.approvedBy}` : ""}`;
    case "pending": {
      if (!deadline || !r.submittedAt) return "Chờ Sở duyệt";
      const late = daysBetween(deadline, r.submittedAt);
      return late > 0 ? `Nộp trễ ${late} ngày` : "Nộp đúng hạn";
    }
    case "returned":
      return `Sở đã trả lại ${r.returnedAt ? formatDate(r.returnedAt) : ""} · Lý do: ${r.returnReason ?? "—"} · Đang chờ đơn vị sửa và nộp lại`;
    case "notSubmitted": {
      if (r.period.status === "overdue") {
        return `Quá hạn nộp${deadline ? ` ${formatDate(deadline)}` : ""} · đơn vị bị khoá nhập`;
      }
      if (!deadline) return "Chưa nộp";
      const left = daysBetween(todayLocal(), deadline);
      const when = left > 0 ? `còn ${left} ngày` : left === 0 ? "hết hạn hôm nay" : `quá hạn ${-left} ngày`;
      return `Hạn nộp ${formatDate(deadline)} · ${when}`;
    }
    default:
      return "Chỉ xem";
  }
}

/** Phiếu chưa nhập biểu nào: không có gì để xem, xuất. */
export function hasNoData(r: InputReportRecord): boolean {
  return r.progress.done === 0 && r.submittedAt === null;
}

export const NO_DATA_REASON = "Đơn vị chưa nhập số liệu nào";

const BLOCK_LABEL: Record<NonNullable<InputReportRecord["unit"]["block"]>, string> = {
  tinh: "Khối tỉnh",
  huyen: "Khối huyện",
  xa: "Khối xã",
};

/** "Khối xã · Huyện Long Thành" — dòng phụ cột Đơn vị. */
export function unitSubline(r: InputReportRecord): string {
  const parts = [r.unit.block ? BLOCK_LABEL[r.unit.block] : null, r.unit.parentName].filter(
    (x): x is string => Boolean(x)
  );
  return parts.join(" · ");
}

export const BLOCK_OPTIONS = (Object.keys(BLOCK_LABEL) as (keyof typeof BLOCK_LABEL)[]).map((key) => ({
  key,
  label: BLOCK_LABEL[key],
}));
