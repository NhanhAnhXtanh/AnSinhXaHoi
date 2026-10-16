// Dữ liệu mẫu — thay bằng API khi backend có.

export type PeriodKind = "thang" | "quy" | "6thang" | "nam";

export const KIND_ORDER: PeriodKind[] = ["thang", "quy", "6thang", "nam"];

export const KIND_LABELS: Record<PeriodKind, string> = {
  thang: "Tháng",
  quy: "Quý",
  "6thang": "6 tháng",
  nam: "Năm",
};

/** Dòng mô tả trên thẻ Loại kỳ cần sinh. */
export const KIND_DESCRIPTIONS: Record<PeriodKind, string> = {
  thang: "12 kỳ · mỗi tháng 1 kỳ",
  quy: "4 kỳ · quý I đến quý IV",
  "6thang": "2 kỳ · nửa đầu, nửa cuối năm",
  nam: "1 kỳ · cả năm",
};

/** Trạng thái kỳ. Giá trị nội bộ — nhãn ở PERIOD_STATUS_LABELS. */
export type PeriodStatus = "chua-thiet-lap" | "cho-mo-dot" | "dang-mo" | "qua-han" | "da-chot";

export type CalendarPeriod = {
  id: string;
  kind: PeriodKind;
  /** Thứ tự trong năm: tháng 1–12, quý 1–4, nửa năm 1–2, năm 1. */
  index: number;
  name: string;
  /** yyyy-MM-dd */
  from: string;
  /** yyyy-MM-dd */
  to: string;
  /** Hạn nộp, yyyy-MM-dd. */
  deadline: string;
  /** Hạn nộp được sửa tay, không tự tính lại theo số ngày. */
  customDeadline: boolean;
  status: PeriodStatus;
};

export type ReportCalendarData = {
  year: number;
  /** Số ngày sau khi hết kỳ (1–365). */
  deadlineDays: number;
  kinds: PeriodKind[];
  periods: CalendarPeriod[];
};

/* ------------------------------------------------------------------ */
/* Sinh kỳ                                                             */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** yyyy-MM-dd → Date theo giờ máy (không lệch ngày như new Date("yyyy-MM-dd")). */
export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

const ROMAN = ["I", "II", "III", "IV"];

/** Ngày cuối của tháng (month 1–12). */
function lastDay(year: number, month: number): string {
  return toIso(new Date(year, month, 0));
}

function firstDay(year: number, month: number): string {
  return `${year}-${pad(month)}-01`;
}

/** Các kỳ của một loại trong năm, trạng thái "Chưa thiết lập". */
export function generatePeriods(
  year: number,
  kind: PeriodKind,
  deadlineDays: number
): CalendarPeriod[] {
  const make = (index: number, name: string, fromMonth: number, toMonth: number): CalendarPeriod => {
    const to = lastDay(year, toMonth);
    return {
      id: `${year}-${kind}-${index}`,
      kind,
      index,
      name,
      from: firstDay(year, fromMonth),
      to,
      deadline: addDays(to, deadlineDays),
      customDeadline: false,
      status: "chua-thiet-lap",
    };
  };

  switch (kind) {
    case "thang":
      return Array.from({ length: 12 }, (_, i) => make(i + 1, `Tháng ${i + 1}/${year}`, i + 1, i + 1));
    case "quy":
      return Array.from({ length: 4 }, (_, i) =>
        make(i + 1, `Quý ${ROMAN[i]}/${year}`, i * 3 + 1, i * 3 + 3)
      );
    case "6thang":
      return [
        make(1, `6 tháng đầu năm ${year}`, 1, 6),
        make(2, `6 tháng cuối năm ${year}`, 7, 12),
      ];
    case "nam":
      return [make(1, `Năm ${year}`, 1, 12)];
  }
}

/* ------------------------------------------------------------------ */
/* Lịch mẫu                                                            */
/* ------------------------------------------------------------------ */

function withStatuses(
  periods: CalendarPeriod[],
  statusOf: (p: CalendarPeriod) => PeriodStatus
): CalendarPeriod[] {
  return periods.map((p) => ({ ...p, status: statusOf(p) }));
}

/** Năm 2025: đã xong cả năm, mọi kỳ đã chốt. */
const CALENDAR_2025: ReportCalendarData = {
  year: 2025,
  deadlineDays: 5,
  kinds: ["thang", "quy", "6thang", "nam"],
  periods: KIND_ORDER.flatMap((k) =>
    withStatuses(generatePeriods(2025, k, 5), () => "da-chot")
  ),
};

/** Năm 2026 (đang ở giữa tháng 10/2026) — khớp Figma 310:46295. */
const CALENDAR_2026: ReportCalendarData = {
  year: 2026,
  deadlineDays: 5,
  kinds: ["thang", "quy", "6thang"],
  periods: [
    ...withStatuses(generatePeriods(2026, "thang", 5), (p) =>
      p.index <= 8
        ? "da-chot"
        : p.index === 9
          ? "qua-han"
          : p.index === 10
            ? "dang-mo"
            : p.index === 11
              ? "cho-mo-dot"
              : "chua-thiet-lap"
    ),
    ...withStatuses(generatePeriods(2026, "quy", 5), (p) =>
      p.index <= 2 ? "da-chot" : p.index === 3 ? "qua-han" : "chua-thiet-lap"
    ),
    ...withStatuses(generatePeriods(2026, "6thang", 5), (p) =>
      p.index === 1 ? "da-chot" : "chua-thiet-lap"
    ),
  ],
};

export const REPORT_CALENDARS: ReportCalendarData[] = [CALENDAR_2025, CALENDAR_2026];
