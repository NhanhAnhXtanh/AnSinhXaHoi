import { useSyncExternalStore } from "react";

import { INPUT_REPORTS } from "./fixtures";
import type { InputReport } from "./model";

/**
 * Kho phiếu tạm trong bộ nhớ trình duyệt, dùng chung cho màn danh sách và màn
 * nhập phiếu — để phiếu vừa nộp ở màn nhập hiện "Chờ duyệt" khi quay ra danh
 * sách. Tải lại trang là về dữ liệu mẫu ban đầu.
 *
 * Thay bằng gọi API (Refine `useList` / `useOne` / `useUpdate`) khi backend có.
 */

let reports: InputReport[] = INPUT_REPORTS.map((r) => structuredClone(r));
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

export function useInputReports(): InputReport[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useInputReport(id: string | undefined): InputReport | undefined {
  const all = useInputReports();
  return all.find((r) => r.id === id);
}

export function updateInputReport(id: string, change: (r: InputReport) => InputReport) {
  reports = reports.map((r) => (r.id === id ? change(r) : r));
  listeners.forEach((l) => l());
}
