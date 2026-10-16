import type { SheetData, SheetRow, StatusTone } from "@/shared/components/asxh";
import { formatDate, formatDateTime } from "@/shared/components/asxh";

import {
  MOCK_TODAY,
  SHEET_DEFS,
  type ReviewReport,
  type ReviewStatus,
} from "./fixtures";

/** Nhãn và màu của bốn trạng thái phiếu phía Sở. */
export const STATUS_META: Record<ReviewStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Chờ duyệt", tone: "warning" },
  returned: { label: "Đã trả lại", tone: "destructive" },
  approved: { label: "Đã phê duyệt", tone: "success" },
  notSubmitted: { label: "Chưa nộp", tone: "neutral" },
};

/** Thứ tự thẻ lọc nhanh và ô Trạng thái trong Bộ lọc khác. */
export const STATUS_ORDER: ReviewStatus[] = [
  "pending",
  "returned",
  "approved",
  "notSubmitted",
];

export const TOTAL_SHEETS = SHEET_DEFS.length;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: string): number {
  const date = new Date(d.length === 10 ? `${d}T00:00` : d);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Số ngày từ "hôm nay" của dữ liệu mẫu tới ngày `d` (âm = đã qua). */
export function daysFromToday(d: string): number {
  return Math.round((startOfDay(d) - startOfDay(MOCK_TODAY)) / DAY_MS);
}

/** Giờ thao tác giả lập: ngày của dữ liệu mẫu + giờ thật trên máy. */
export function mockNow(): string {
  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${MOCK_TODAY.slice(0, 10)}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function timeOf(d: string): string {
  return formatDateTime(d).slice(11);
}

/** Dòng phụ dưới badge trạng thái trên bảng. */
export function statusSubline(r: ReviewReport): string {
  switch (r.status) {
    case "approved":
      return `Duyệt ${formatDate(r.approvedAt ?? "")} · ${r.approver ?? ""}`;
    case "pending": {
      const late = r.submittedAt
        ? daysBetween(r.period.deadline, r.submittedAt)
        : 0;
      return late > 0 ? `Nộp trễ ${late} ngày` : "Nộp đúng hạn";
    }
    case "returned":
      return `Sở trả lại ${formatDate(r.returnedAt ?? "")} · ${r.returnReason ?? ""}`;
    case "notSubmitted": {
      const left = daysFromToday(r.period.deadline);
      const when =
        left > 0 ? `còn ${left} ngày` : left === 0 ? "hết hạn hôm nay" : `quá hạn ${-left} ngày`;
      return `Hạn nộp ${formatDate(r.period.deadline)} · ${when}`;
    }
  }
}

function daysBetween(from: string, to: string): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

/** Phiếu chưa nhập biểu nào: không có gì để xem, xuất. */
export function hasNoData(r: ReviewReport): boolean {
  return r.doneSheets === 0;
}

export const NO_DATA_REASON = "Đơn vị chưa nhập số liệu nào";

/** Bỏ dấu, chữ thường — để tìm "phu huu" vẫn ra "Phú Hữu". */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function periodLabel(r: ReviewReport): string {
  return `${r.period.name} · ${r.orgName}`;
}

const round100 = (v: number) => Math.round(v / 100) * 100;

/**
 * Dựng bảng tính chỉ đọc của một biểu: 4 dòng đầu biểu, dòng tiêu đề cột, các
 * chỉ tiêu, dòng "Tổng cộng". Cột "Cộng dồn" = kỳ trước + kỳ này; dòng tổng
 * cộng từ các dòng trên, nên số luôn khớp.
 */
export function buildSheet(r: ReviewReport, code: string): SheetData {
  const index = SHEET_DEFS.findIndex((s) => s.code === code);
  const def = SHEET_DEFS[index] ?? SHEET_DEFS[0];
  const filled = index >= 0 && index < r.doneSheets;

  const title = (text: string, kind: SheetRow["kind"] = "title"): SheetRow => ({
    cells: [null, text, null, null, null, null],
    kind,
  });

  let sumPrev = 0;
  let sumCur = 0;
  const items: SheetRow[] = def.items.map(([name, prev, cur], i) => {
    if (!filled) {
      return { cells: [String(i + 1), name, null, null, null, null], kind: "normal" };
    }
    const p = round100(prev * r.scale);
    const c = round100(cur * r.scale);
    sumPrev += p;
    sumCur += c;
    return { cells: [String(i + 1), name, p, c, p + c, null], kind: "normal" };
  });

  return {
    columns: [
      { label: "STT", width: 64, align: "center" },
      { label: "Chỉ tiêu", width: 440, align: "left" },
      { label: "Số kỳ trước", width: 168, align: "right" },
      { label: "Số kỳ này", width: 168, align: "right" },
      { label: "Cộng dồn", width: 168, align: "right" },
      { label: "Ghi chú", width: 280, align: "left" },
    ],
    rows: [
      title(`ĐƠN VỊ: ${r.orgName}`),
      title(`BIỂU ${def.code} — ${def.title}`),
      title(`Kỳ báo cáo: ${r.period.name} (${r.period.range})`, "normal"),
      title("Đơn vị tính: nghìn đồng", "normal"),
      {
        cells: ["STT", "Chỉ tiêu", "Số kỳ trước", "Số kỳ này", "Cộng dồn", "Ghi chú"],
        kind: "header",
      },
      ...items,
      {
        cells: filled
          ? [null, "Tổng cộng", sumPrev, sumCur, sumPrev + sumCur, null]
          : [null, "Tổng cộng", null, null, null, null],
        kind: "total",
      },
    ],
  };
}

/** Số tiền trên giấy xác nhận kho bạc: tổng "Số kỳ này" của biểu 1b, ra đồng. */
export function treasuryAmount(r: ReviewReport): number {
  const sheet = buildSheet(r, "1b");
  const total = sheet.rows[sheet.rows.length - 1]?.cells[3];
  return typeof total === "number" ? total * 1000 : 0;
}

/** Tên tệp Excel của phiếu, không dấu. */
export function exportFileName(r: ReviewReport, revision: number): string {
  const slug = (s: string) =>
    normalize(s)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const ban = revision > 1 ? `_ban-${revision}` : "";
  return `Phieu_${slug(r.orgName)}_${slug(r.period.name)}${ban}.xlsx`;
}
