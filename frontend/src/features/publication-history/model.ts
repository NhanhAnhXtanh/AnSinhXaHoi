import { formatNumber, type StatusTone } from "@/shared/components/asxh";

import type { ApiPublicationItem, ApiSheetCompletion } from "./api";

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu trên dây                                               */
/* ------------------------------------------------------------------ */

export type PublicationKind = "LAN_DAU" | "BO_SUNG";
export type PublicationStatus = "PUBLISHED" | "CANCELLED";

/** `PublicationResponse` — `/api/publications` (UC-30). */
export type ApiPublication = {
  id: number;
  period: { id: number; name: string; status: string };
  kind: PublicationKind;
  status: PublicationStatus;
  publicationNo: number;
  unitCount: number;
  reportCount: number;
  sheetCount: number;
  createdBy: string | null;
  createdAt: string;
  cancelledAt: string | null;
};

/** `ReportPeriodResponse` — chỉ các trường màn này đọc. */
export type ApiPeriodLite = {
  id: number;
  name: string;
  year: number | null;
  fromDate: string;
  toDate: string;
};

/* ------------------------------------------------------------------ */
/* Nhãn                                                                */
/* ------------------------------------------------------------------ */

export const KIND_LABEL: Record<PublicationKind, string> = {
  LAN_DAU: "Lần đầu",
  BO_SUNG: "Bổ sung",
};

export const STATUS_VIEW: Record<PublicationStatus, { label: string; tone: StatusTone }> = {
  PUBLISHED: { label: "Đã tạo phiếu", tone: "success" },
  CANCELLED: { label: "Đã thu hồi", tone: "outline" },
};

export const UNIT_GROUP_LABEL: Record<"tinh" | "huyen" | "xa", string> = {
  tinh: "Khối tỉnh",
  huyen: "Khối huyện, thành phố",
  xa: "Khối xã, phường",
};

/* ------------------------------------------------------------------ */
/* Chi tiết đợt: trạng thái hiển thị của một dòng đơn vị × biểu         */
/* ------------------------------------------------------------------ */

/** Khoá thẻ lọc nhanh / trạng thái hiển thị của một dòng. */
export type RowStatus = "draft" | "submitted" | "returned" | "approved" | "locked" | "cancelled";

export const ROW_STATUS_VIEW: Record<RowStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Đang nhập", tone: "neutral" },
  submitted: { label: "Chờ duyệt", tone: "info" },
  returned: { label: "Bị trả lại", tone: "warning" },
  approved: { label: "Đã duyệt", tone: "success" },
  locked: { label: "Khoá khi chốt đợt", tone: "locked" },
  cancelled: { label: "Đã huỷ", tone: "outline" },
};

export const ROW_STATUS_ORDER: RowStatus[] = ["draft", "submitted", "returned", "approved", "locked", "cancelled"];

/**
 * Trạng thái phiếu đang chứa biểu, theo cách cán bộ hiểu. Phiếu khoá SAU khi duyệt vẫn là phiếu
 * đã duyệt (số liệu đã ghi nhận); phiếu khoá khi Sở chốt đợt mà chưa duyệt thì tách riêng.
 */
export function rowStatus(item: ApiPublicationItem): RowStatus {
  switch (item.report.status) {
    case "SUBMITTED":
      return "submitted";
    case "RETURNED":
      return "returned";
    case "APPROVED":
      return "approved";
    case "LOCKED":
      return item.report.approvedAt ? "approved" : "locked";
    case "CANCELLED":
    case "SUPERSEDED":
      return "cancelled";
    default:
      return "draft";
  }
}

export const COMPLETION_VIEW: Record<ApiSheetCompletion, { label: string; tone: StatusTone }> = {
  NOT_STARTED: { label: "Chưa nhập", tone: "outline" },
  IN_PROGRESS: { label: "Đang nhập", tone: "neutral" },
  COMPLETED: { label: "Đã nhập xong", tone: "success" },
  NO_DATA: { label: "Không phát sinh", tone: "neutral" },
};

/** dd/MM – dd/MM/yyyy của kỳ, viết sẵn cho dòng phụ. */
export function periodRange(p: ApiPeriodLite | undefined, format: (d: string) => string): string {
  if (!p) return "";
  return `${format(p.fromDate).slice(0, 5)} – ${format(p.toDate)}`;
}

export const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "thêm 12, sửa 3, xoá 0 dòng". */
export function ledgerCounts(w: { linesAdded: number; linesUpdated: number; linesRemoved: number }): string {
  return `thêm ${formatNumber(w.linesAdded)}, sửa ${formatNumber(w.linesUpdated)}, xoá ${formatNumber(
    w.linesRemoved
  )} dòng`;
}
