import { formatDate } from "@/shared/components/asxh";

/** "2026-01-01", "2026-03-31" → "01/01 – 31/03/2026" (cùng năm thì bỏ năm ở đầu). */
export function formatRange(from: string, to: string): string {
  const a = formatDate(from);
  const b = formatDate(to);
  if (a.slice(6) === b.slice(6)) return `${a.slice(0, 5)} – ${b}`;
  return `${a} – ${b}`;
}

/** Biểu nhập hộ (mỗi dòng một đơn vị) — script đổ một dòng / đơn vị. */
export function isPerUnitSheet(shortName: string): boolean {
  return shortName.trim().toLowerCase() === "1g";
}

/**
 * Câu báo khi script của biểu gọi máy chủ lấy số không thành công (bảng có thể thiếu số). Chỉ
 * trích câu của máy chủ khi đó là câu tiếng Việt viết cho người dùng.
 */
export function scriptApiErrorText(shortName: string, errors: string[]): string {
  const said = errors.find((text) => /[À-ỹ]/.test(text));
  return `Chưa lấy đủ số liệu tổng hợp của biểu ${shortName}${said ? `: ${said.replace(/\.$/, "")}` : ""}. Bạn bấm Làm mới hoặc thử lại sau ít phút.`;
}

/** Câu báo kỳ quá khứ mượn phiên bản ban hành sớm nhất (UC-50 3b). */
export function borrowedNote(periodName: string, versionNo: number | null): string {
  return `${periodName} đứng trước ngày áp dụng của mẫu — đang dùng phiên bản ${versionNo ?? ""} ban hành sớm nhất.`.replace(
    "phiên bản  ",
    "phiên bản "
  );
}

/** Phạm vi đơn vị của ô "Phạm vi" → tham số `/api/summary/period_sheet` (UC-51). */
export function scopeQuery(scope: string): {
  scopeKind: string;
  block?: string;
  organizationId?: number;
} {
  if (scope === "tinh") return { scopeKind: "ALL" };
  if (scope.startsWith("khoi-")) return { scopeKind: "BLOCK", block: scope.slice(5) };
  const id = Number(scope);
  return Number.isFinite(id) ? { scopeKind: "ORGANIZATION", organizationId: id } : { scopeKind: "ALL" };
}
