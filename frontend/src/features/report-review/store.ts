import { useSyncExternalStore } from "react";

import { CURRENT_REVIEWER, INITIAL_REPORTS, type ReviewReport } from "./fixtures";
import { mockNow } from "./model";

/**
 * Kho phiếu giả lập dùng chung cho danh sách và màn Xem phiếu, để phê duyệt /
 * trả lại ở màn Xem phiếu hiện ngay trên danh sách khi quay về. Sống tới khi
 * tải lại trang. Thay bằng API khi backend có.
 */
let reports: ReviewReport[] = INITIAL_REPORTS;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return reports;
}

function update(id: string, change: (r: ReviewReport) => ReviewReport) {
  reports = reports.map((r) => (r.id === id ? change(r) : r));
  listeners.forEach((l) => l());
}

export function useReviewReports(): ReviewReport[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useReviewReport(id: string | undefined): ReviewReport | undefined {
  const all = useReviewReports();
  return all.find((r) => r.id === id);
}

/**
 * Phê duyệt phiếu Chờ duyệt. Trả `false` khi hệ thống "chưa tính được số
 * liệu" (giả lập lần đầu của phiếu có `failApproveOnce`) — phiếu giữ nguyên.
 */
export function approveReport(id: string): boolean {
  const target = reports.find((r) => r.id === id);
  if (!target || target.status !== "pending") return false;
  if (target.failApproveOnce) {
    update(id, (r) => ({ ...r, failApproveOnce: false }));
    return false;
  }
  update(id, (r) => ({
    ...r,
    status: "approved",
    approvedAt: mockNow(),
    approver: CURRENT_REVIEWER,
  }));
  return true;
}

/** Trả phiếu Chờ duyệt về đơn vị kèm lý do. */
export function returnReport(id: string, reason: string): boolean {
  const target = reports.find((r) => r.id === id);
  if (!target || target.status !== "pending") return false;
  update(id, (r) => ({
    ...r,
    status: "returned",
    returnedAt: mockNow(),
    returnReason: reason,
  }));
  return true;
}
