import { API_URL } from "@/shared/api/constants";
import type { StatusTone } from "@/shared/components/asxh";

/**
 * Màn "Bản chất chỉ tiêu" — dữ liệu từ `GET/PUT /api/indicator_measures`.
 *
 * Bản chất quyết định cách gộp số khi tổng hợp NHIỀU KỲ (quý, năm): cùng một
 * người hưởng ở mọi tháng thì lấy kỳ cao nhất, lượt hỗ trợ thì cộng dồn, mức hỗ
 * trợ thì lấy kỳ mới nhất. Gộp một kỳ thì mọi bản chất cho cùng một số.
 */

/** Tên hằng máy chủ nhận — chỉ dùng trong mã, không bao giờ hiện lên màn. */
export type MeasureKind = "NGUOI" | "LUOT" | "DON_GIA" | "THOI_GIAN" | "TIEN";
export type TimeRule = "SUM" | "MAX" | "LAST";

export const MEASURE_KINDS: MeasureKind[] = ["NGUOI", "LUOT", "DON_GIA", "THOI_GIAN", "TIEN"];

/** Giá trị lọc "chưa khai" của tham số `measureKind`. */
export const UNSET = "UNSET";

export interface ApiIndicatorMeasure {
  id: string;
  indicatorCode: string;
  indicatorName: string;
  sheets: string[];
  measureKind: MeasureKind | null;
  effectiveKind: MeasureKind;
  quantityRule: TimeRule;
  amountRule: TimeRule;
  note: string | null;
  entryCount: number;
  inUse: boolean;
  updatedAt: string | null;
}

export const INDICATOR_MEASURES_URL = `${API_URL}/indicator_measures`;

export const KIND_VIEW: Record<MeasureKind, { label: string; hint: string; tone: StatusTone }> = {
  NGUOI: {
    label: "Người hưởng thường xuyên",
    hint: "Cùng một người, một hộ được hưởng ở nhiều kỳ, ví dụ trẻ em, học sinh, đối tượng bảo trợ hằng tháng.",
    tone: "info",
  },
  LUOT: {
    label: "Lượt hỗ trợ",
    hint: "Mỗi kỳ là một lần hỗ trợ riêng, ví dụ hỗ trợ mai táng, trợ giúp đột xuất.",
    tone: "success",
  },
  DON_GIA: {
    label: "Mức hỗ trợ, đơn giá",
    hint: "Mức tiền cho một người hoặc một tháng theo quy định — không cộng dồn qua các kỳ.",
    tone: "warning",
  },
  THOI_GIAN: {
    label: "Số tháng, định suất",
    hint: "Số tháng hoặc số suất được hỗ trợ trong kỳ.",
    tone: "neutral",
  },
  TIEN: {
    label: "Chỉ có kinh phí",
    hint: "Chỉ tiêu chỉ ghi số tiền, không có số đối tượng đi kèm.",
    tone: "outline",
  },
};

/** Cách gộp qua các kỳ của mỗi bản chất — trùng `MeasureKind.java`. */
export const KIND_RULES: Record<MeasureKind, { quantity: TimeRule; amount: TimeRule }> = {
  NGUOI: { quantity: "MAX", amount: "SUM" },
  LUOT: { quantity: "SUM", amount: "SUM" },
  DON_GIA: { quantity: "LAST", amount: "LAST" },
  THOI_GIAN: { quantity: "SUM", amount: "SUM" },
  TIEN: { quantity: "SUM", amount: "SUM" },
};

const RULE_TEXT: Record<TimeRule, string> = {
  SUM: "cộng các kỳ",
  MAX: "lấy kỳ cao nhất",
  LAST: "lấy kỳ mới nhất",
};

/** "Số đối tượng: lấy kỳ cao nhất · Kinh phí: cộng các kỳ". */
export function ruleText(quantity: TimeRule, amount: TimeRule): string {
  if (quantity === amount) return `Số đối tượng và kinh phí: ${RULE_TEXT[quantity]}`;
  return `Số đối tượng: ${RULE_TEXT[quantity]} · Kinh phí: ${RULE_TEXT[amount]}`;
}

/** Dòng phụ dưới tên chỉ tiêu: biểu chứa nó và đã có số liệu chưa. */
export function sheetLine(row: ApiIndicatorMeasure): string {
  const sheets = row.sheets.length > 0 ? `Biểu ${row.sheets.join(", ")}` : "Chưa có số liệu đã duyệt";
  return row.inUse ? `${sheets} · ${row.entryCount.toLocaleString("vi-VN")} dòng số liệu` : sheets;
}
