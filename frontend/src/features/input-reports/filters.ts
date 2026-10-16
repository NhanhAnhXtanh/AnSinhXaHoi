import type { DisplayStatus } from "./model";

/** Bộ lọc của màn danh sách phiếu. */
export const ALL = "all";

export type ListFilters = {
  search: string;
  /** Tên kỳ, hoặc ALL */
  period: string;
  statuses: DisplayStatus[];
  /** Tên bộ biểu mẫu, hoặc ALL */
  templateSet: string;
  /** Tên phiên bản biểu mẫu, hoặc ALL */
  templateVersion: string;
};

export const EMPTY_FILTERS: ListFilters = {
  search: "",
  period: ALL,
  statuses: [],
  templateSet: ALL,
  templateVersion: ALL,
};
