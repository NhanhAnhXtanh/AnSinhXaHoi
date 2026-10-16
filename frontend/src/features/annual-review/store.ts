import { useSyncExternalStore } from "react";

import { CURRENT_APPROVER, SUBMISSIONS, type AnnualSubmission } from "./fixtures";

/**
 * Kho phiếu năm trong phiên làm việc (dữ liệu mẫu, chưa có API).
 *
 * Ba màn của feature — danh sách, xem phiếu, lịch sử — đọc chung một kho để
 * phê duyệt / trả lại ở màn xem phiếu hiện ngay khi quay về danh sách. Tải lại
 * trang thì về dữ liệu mẫu ban đầu.
 */
let state: AnnualSubmission[] = SUBMISSIONS;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(id: string, patch: (s: AnnualSubmission) => AnnualSubmission) {
  state = state.map((s) => (s.id === id ? patch(s) : s));
  listeners.forEach((l) => l());
}

const pad = (v: number) => String(v).padStart(2, "0");
function nowIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function useSubmissions(): AnnualSubmission[] {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Phiếu mới nhất của mỗi năm, năm mới nhất lên đầu. */
export function latestPerYear(list: AnnualSubmission[]): AnnualSubmission[] {
  const byYear = new Map<number, AnnualSubmission>();
  for (const s of list) {
    const cur = byYear.get(s.year);
    if (!cur || s.revisionNo > cur.revisionNo) byYear.set(s.year, s);
  }
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

/** Phiếu có phải lần nộp mới nhất của năm đó không (chỉ phiếu mới nhất mới được quyết định). */
export function isLatest(list: AnnualSubmission[], s: AnnualSubmission): boolean {
  return !list.some((x) => x.year === s.year && x.revisionNo > s.revisionNo);
}

export const decisions = {
  approve(id: string) {
    update(id, (s) => ({
      ...s,
      status: "da-duyet",
      decidedAt: nowIso(),
      decidedBy: CURRENT_APPROVER,
      reason: undefined,
      reopened: false,
    }));
  },
  returnReport(id: string, reason: string) {
    update(id, (s) => ({
      ...s,
      status: "tra-lai",
      decidedAt: nowIso(),
      decidedBy: CURRENT_APPROVER,
      reason,
      reopened: false,
    }));
  },
  reopen(id: string, reason: string) {
    update(id, (s) => ({
      ...s,
      status: "tra-lai",
      decidedAt: nowIso(),
      decidedBy: CURRENT_APPROVER,
      reason,
      reopened: true,
    }));
  },
};
