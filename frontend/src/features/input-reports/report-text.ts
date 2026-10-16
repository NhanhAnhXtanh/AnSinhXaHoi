import { formatDate, formatDateTime } from "@/shared/components/asxh";

import type { InputReportRecord } from "./api";
import { displayStatus } from "./model";

export const LIST_PATH = "/input-reports";

/** Đường dẫn màn nhập phiếu. Mỗi phiên bản phiếu có id riêng — bản cũ mở thẳng id của nó. */
export function workPath(id: number | string): string {
  return `${LIST_PATH}/${encodeURIComponent(String(id))}`;
}

/** Tên phiếu theo lần nộp, cột "Phiếu" của danh sách. */
export function reportKindLabel(r: InputReportRecord): string {
  if (r.revisionNo > 1) return "Phiếu nộp lại";
  return r.publication.kind === "BO_SUNG" ? "Phiếu bổ sung" : "Phiếu lần đầu";
}

/** Dòng phụ trạng thái — dùng ở cột Trạng thái và ở đầu thẻ màn nhập (nguyên tắc §5). */
export function statusLine(r: InputReportRecord): string {
  switch (displayStatus(r)) {
    case "draft":
      if (r.period.status === "published") return "Kỳ báo cáo chưa mở nhập";
      return r.updatedAt ? `Cập nhật ${formatDateTime(r.updatedAt)}` : "Chưa nộp";
    case "returned":
      return `Sở trả lại ${r.returnedAt ? formatDate(r.returnedAt) : ""} · Lý do: ${r.returnReason ?? "—"}`;
    case "submitted":
      return `Đã nộp ${r.submittedAt ? formatDateTime(r.submittedAt) : ""} · chờ Sở duyệt`;
    case "overdue":
      return `Hết hạn nộp${r.period.deadline ? ` ${formatDate(r.period.deadline)}` : ""} · liên hệ Sở Tài chính nếu cần gia hạn`;
    case "locked":
      return "Sở đã chốt số liệu · chỉ xem";
    case "approved":
      return `Sở duyệt ${r.approvedAt ? formatDateTime(r.approvedAt) : ""}`;
    case "cancelled":
      return "Phiếu đã huỷ · chỉ xem";
    case "superseded":
      return `Bản cũ, Sở đã trả lại ${r.returnedAt ? formatDate(r.returnedAt) : ""} · chỉ xem`;
  }
}

/** Dòng giải thích vì sao phiếu đang chỉ xem (đầu thẻ màn nhập). */
export function readOnlyReason(r: InputReportRecord): string | null {
  if (r.status !== "DRAFT" && r.status !== "RETURNED") return null;
  switch (r.period.status) {
    case "open":
      return null;
    case "overdue":
      return "Kỳ báo cáo đã quá hạn nên phiếu đang chỉ xem. Liên hệ Sở Tài chính nếu cần gia hạn.";
    case "published":
      return "Kỳ báo cáo chưa tới ngày mở nhập nên phiếu đang chỉ xem.";
    default:
      return "Kỳ báo cáo không còn mở nên phiếu đang chỉ xem.";
  }
}
