/**
 * Cách viết số và ngày trên các màn ASXH.
 *
 * Cố định theo kiểu Việt Nam, không theo ngôn ngữ của trình duyệt: cán bộ xã
 * mở máy cài tiếng Anh vẫn phải thấy "1.234.567" và "05/10/2026", vì đó là cách
 * số liệu được viết trên giấy tờ họ đối chiếu.
 */

/** Gạch ngang dài thay cho ô trống — ô trắng trông như lỗi hiển thị. */
const EMPTY = "—";

const NUMBER = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

/** 1234567 → "1.234.567" ; 1234.5 → "1.234,5" ; null/undefined/NaN → "—". */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return EMPTY;
  return NUMBER.format(n);
}

const pad = (v: number) => String(v).padStart(2, "0");

/**
 * Đọc ngày. Chuỗi chỉ có ngày ("2026-10-05") được hiểu theo giờ máy, không
 * theo UTC — `new Date("2026-10-05")` là nửa đêm UTC, ở múi giờ âm sẽ lùi
 * sang hôm trước.
 */
function toDate(d: string | Date | null | undefined): Date | null {
  if (d === null || d === undefined || d === "") return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** dd/MM/yyyy ; giá trị không đọc được → "—". */
export function formatDate(d: string | Date): string {
  const date = toDate(d);
  if (!date) return EMPTY;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** dd/MM/yyyy HH:mm ; giá trị không đọc được → "—". */
export function formatDateTime(d: string | Date): string {
  const date = toDate(d);
  if (!date) return EMPTY;
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
