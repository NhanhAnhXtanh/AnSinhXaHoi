import { formatNumber } from "@/shared/components/asxh";

const pad = (v: number) => String(v).padStart(2, "0");

/** Thời điểm hiện tại theo giờ máy, dạng "2026-10-16T09:30" (đọc được bởi formatDateTime). */
export function nowIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Nguyễn Thị Thu" → "NT" (chữ đầu của họ và tên). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** ["1a","1b","1c"] → "1a, 1b và 1c". */
export function joinVi(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} và ${items[items.length - 1]}`;
}

const PERCENT = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** +4830 → "+4.830" ; -6750 → "−6.750" (dấu trừ chuẩn, không phải gạch nối). */
export function formatSigned(n: number): string {
  if (n === 0) return "0";
  return `${n > 0 ? "+" : "−"}${formatNumber(Math.abs(n))}`;
}

/** Phần trăm thay đổi có dấu, một chữ số thập phân: "+0,5%". */
export function formatSignedPercent(delta: number, base: number): string {
  if (base === 0) return delta === 0 ? "0,0%" : "mới";
  const pct = (delta / base) * 100;
  return `${pct >= 0 ? "+" : "−"}${PERCENT.format(Math.abs(pct))}%`;
}

/** Kiểm tra và đọc ngày gõ tay "dd/mm/yyyy" → "yyyy-mm-dd"; sai → null. */
export function parseViDate(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Chữ không dấu, nối gạch: "Quý I/2026" → "Quy-I-2026". */
function slug(raw: string): string {
  return raw
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Tên tệp xuất Excel bảng tổng hợp (UC-53): "TongHop_1a_Quy-I-2026.xlsx". */
export function summaryExportName(sheetLabel: string, scopeLabel: string): string {
  const parts = ["TongHop", slug(sheetLabel), slug(scopeLabel)].filter((part) => part !== "");
  return `${parts.join("_")}.xlsx`;
}

/** Hôm nay dạng "dd/mm/yyyy". */
export function todayVi(): string {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
