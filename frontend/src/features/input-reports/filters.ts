import type { CrudFilter } from "@refinedev/core";

import type { DisplayKey } from "./api";

/** Bộ lọc của màn danh sách phiếu. */
export const ALL = "all";

export type ListFilters = {
  search: string;
  /** Id kỳ (chuỗi), hoặc ALL */
  period: string;
  statuses: DisplayKey[];
  /** Id bộ biểu mẫu (chuỗi), hoặc ALL */
  templateSet: string;
};

export const EMPTY_FILTERS: ListFilters = {
  search: "",
  period: ALL,
  statuses: [],
  templateSet: ALL,
};

/** Khoá trạng thái không khớp phiếu nào — máy chủ trả rỗng khi thẻ nhanh và ô Trạng thái không giao nhau. */
const NO_MATCH = "none";

/** Lọc gửi lên máy chủ, TRỪ trạng thái — dùng chung cho danh sách và số đếm thẻ lọc nhanh. */
export function baseFilters(year: number, f: ListFilters): CrudFilter[] {
  const filters: CrudFilter[] = [{ field: "year", operator: "eq", value: year }];
  if (f.period !== ALL) filters.push({ field: "period.id", operator: "eq", value: f.period });
  if (f.templateSet !== ALL) filters.push({ field: "templateSet.id", operator: "eq", value: f.templateSet });
  const q = f.search.trim();
  if (q !== "") filters.push({ field: "q", operator: "eq", value: q });
  return filters;
}

/** Tham số `display`: giao của thẻ lọc nhanh và ô Trạng thái; rỗng = mọi trạng thái. */
export function displayFilter(quick: DisplayKey | null, statuses: DisplayKey[]): CrudFilter[] {
  let keys: string[] = statuses;
  if (quick) keys = statuses.length === 0 || statuses.includes(quick) ? [quick] : [NO_MATCH];
  return keys.length === 0 ? [] : [{ field: "display", operator: "eq", value: keys.join(",") }];
}

/** `baseFilters` dạng chuỗi truy vấn cho `useCustom` (điểm cuối số đếm). */
export function toQuery(filters: CrudFilter[]): Record<string, string> {
  const query: Record<string, string> = {};
  for (const f of filters) {
    if ("field" in f && f.value !== undefined && f.value !== null) query[f.field] = String(f.value);
  }
  return query;
}
