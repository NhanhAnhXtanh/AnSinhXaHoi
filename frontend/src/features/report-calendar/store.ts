import { useSyncExternalStore } from "react";

import type { StatusTone } from "@/shared/components/asxh";

import {
  REPORT_CALENDARS,
  type CalendarPeriod,
  type PeriodKind,
  type PeriodStatus,
  type ReportCalendarData,
} from "./fixtures";

/**
 * Kho lịch theo năm, sống suốt phiên mở trang (chưa có API). Đổi năm ở đầu
 * trang rồi quay lại vẫn thấy lịch vừa tạo.
 */
let calendars: Record<number, ReportCalendarData> = Object.fromEntries(
  REPORT_CALENDARS.map((c) => [c.year, c])
);
const listeners = new Set<() => void>();

function emit(next: Record<number, ReportCalendarData>) {
  calendars = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCalendars(): Record<number, ReportCalendarData> {
  return useSyncExternalStore(subscribe, () => calendars);
}

export function saveCalendar(calendar: ReportCalendarData) {
  emit({ ...calendars, [calendar.year]: calendar });
}

export function removeCalendar(year: number) {
  const next = { ...calendars };
  delete next[year];
  emit(next);
}

/* ------------------------------------------------------------------ */

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  "chua-thiet-lap": "Chưa thiết lập",
  "cho-mo-dot": "Chờ mở đợt",
  "dang-mo": "Đang mở",
  "qua-han": "Quá hạn",
  "da-chot": "Đã chốt",
};

export const PERIOD_STATUS_TONES: Record<PeriodStatus, StatusTone> = {
  "chua-thiet-lap": "neutral",
  "cho-mo-dot": "success",
  "dang-mo": "info",
  "qua-han": "overdue",
  "da-chot": "locked",
};

/** Kỳ đã được gán cho đơn vị (đã qua bước thiết lập) — chặn bỏ loại kỳ và chặn xoá lịch. */
export function isAssigned(p: CalendarPeriod): boolean {
  return p.status !== "chua-thiet-lap";
}

/** Các loại kỳ đã có kỳ gán cho đơn vị — không bỏ chọn được. */
export function lockedKinds(calendar: ReportCalendarData | undefined): Set<PeriodKind> {
  return new Set(
    (calendar?.periods ?? []).filter(isAssigned).map((p) => p.kind)
  );
}
