import { API_URL } from "@/shared/api/constants";

/**
 * Hình dạng dữ liệu của `/api/input_reports` và `/api/input_report_sheets` (xem
 * `InputReportResponse.java`, `InputReportSheetResponse.java`,
 * `InputReportSummaryResponse.java`, `InputReportHistoryResponse.java`).
 *
 * Bản riêng của màn Duyệt phiếu — một feature không import feature khác
 * (`npm run verify:arch`), nên kiểu dây được khai lại ở đây, giống cách backend
 * mỗi slice tự khai DTO của mình.
 *
 * Tên trạng thái ở đây là tên trên dây, KHÔNG đưa lên giao diện — chữ người dùng
 * thấy lấy từ `STATUS_META` trong `model.ts`.
 */

export const REPORTS_RESOURCE = "input_reports";
export const SHEETS_RESOURCE = "input_report_sheets";

/** Trạng thái phiếu — enum Java, trên dây là tên hằng viết hoa. */
export type ApiReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "RETURNED"
  | "LOCKED"
  | "CANCELLED"
  | "SUPERSEDED";

/** Trạng thái kỳ — trên dây viết thường. Chỉ `open` mới nhập / nộp được. */
export type ApiPeriodStatus =
  | "draft"
  | "ready"
  | "published"
  | "open"
  | "overdue"
  | "closed"
  | "locked"
  | "cancelled";

/** Tình trạng nhập của một biểu trong phiếu. */
export type ApiSheetCompletion = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "NO_DATA";

export type InputReportRecord = {
  id: number;
  unit: {
    id: number;
    budgetCode: string;
    name: string;
    block: "tinh" | "huyen" | "xa" | null;
    parentName: string | null;
  };
  period: {
    id: number;
    name: string;
    year: number | null;
    kind: string | null;
    /** yyyy-MM-dd */
    fromDate: string;
    toDate: string;
    deadline: string | null;
    status: ApiPeriodStatus;
  };
  publication: { id: number; kind: "LAN_DAU" | "BO_SUNG"; publicationNo: number };
  revisionNo: number;
  previousRevisionId: number | null;
  status: ApiReportStatus;
  submittedAt: string | null;
  submittedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  returnedAt: string | null;
  returnedBy: string | null;
  returnReason: string | null;
  progress: { done: number; total: number };
  createdAt: string;
  updatedAt: string | null;
};

export type InputReportSheetRecord = {
  id: number;
  reportId: number;
  template: { id: number; shortName: string; name: string };
  templateVersionId: number;
  completion: ApiSheetCompletion;
  completedAt: string | null;
  completedBy: string | null;
  dataUpdatedAt: string | null;
  dataUpdatedBy: string | null;
  /** Số hiệu bản lưu — gửi lại khi lưu để máy chủ phát hiện ghi đè. */
  version: number;
  /** Chỉ có ở `GET /{id}`. */
  dataJson: string | null;
  /** Chỉ có ở `GET /{id}`, và chỉ khi biểu chưa có số liệu. */
  templateWorkbookJson: string | null;
  /** Chỉ có ở `GET /{id}`. */
  scriptText: string | null;
};

/** Khoá trạng thái hiển thị — tham số `display` của danh sách và khoá của `counts`. */
export type DisplayKey = "draft" | "overdue" | "returned" | "submitted" | "approved" | "locked";

export type InputReportSummary = {
  total: number;
  counts: Partial<Record<DisplayKey, number>>;
  periods: { id: number; name: string; fromDate: string; toDate: string; status: ApiPeriodStatus }[];
  templateSets: { id: number; name: string }[];
  districts: { id: number; name: string }[];
};

export type HistoryAction =
  | "ISSUED"
  | "SUBMITTED"
  | "RETURNED"
  | "APPROVED"
  | "LOCKED"
  | "CANCELLED"
  | "SHEET_SAVED"
  | "SHEET_COMPLETED"
  | "SHEET_NO_DATA";

export type InputReportHistory = {
  /** Mới trước. */
  revisions: {
    id: number;
    revisionNo: number;
    status: ApiReportStatus;
    createdAt: string;
    submittedAt: string | null;
    submittedBy: string | null;
    approvedAt: string | null;
    approvedBy: string | null;
    returnedAt: string | null;
    returnedBy: string | null;
    returnReason: string | null;
  }[];
  /** Mới trước. */
  events: {
    action: HistoryAction;
    at: string | null;
    by: string | null;
    revisionNo: number;
    sheet: string | null;
    note: string | null;
    derived: boolean;
  }[];
};

/**
 * Đường dẫn action `POST /api/input_reports/{id}/<action>`. `return` trả về PHIÊN
 * BẢN MỚI của phiếu (Bị trả lại, số phiên bản + 1); bản đang xem thành Bản cũ.
 */
export function reportActionUrl(id: number | string, action: "approve" | "return"): string {
  return `${API_URL}/${REPORTS_RESOURCE}/${id}/${action}`;
}

export const SUMMARY_URL = `${API_URL}/${REPORTS_RESOURCE}/summary`;

export function historyUrl(id: number | string): string {
  return `${API_URL}/${REPORTS_RESOURCE}/${id}/history`;
}

/**
 * `useCustomMutation` đi qua ky gốc, không mang sẵn kiểu nội dung như các lệnh
 * CRUD — thiếu dòng này máy chủ trả 415 cho thân JSON.
 */
export const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };

/** Câu lỗi tiếng Việt máy chủ trả (`ApiExceptionHandler`), hoặc câu dự phòng. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    // Chỉ hiện câu của máy chủ khi nó là câu tiếng Việt viết cho người dùng.
    if (message !== "" && /[À-ỹ]/.test(message)) return message;
  }
  return fallback;
}

/** Mã lỗi HTTP của một lỗi Refine (`HttpError.statusCode`). */
export function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const code = Number((error as { statusCode?: unknown }).statusCode);
    return Number.isFinite(code) ? code : undefined;
  }
  return undefined;
}

/**
 * Đọc chuỗi JSON workbook; hỏng, trống, hoặc workbook không có sheet nào (dữ liệu
 * mẫu ghi `{"version":"16.0","sheets":{}}` cho biểu chưa nhập) → null, để màn lấy
 * khung của phiên bản mẫu.
 */
export function parseWorkbook(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw || raw.trim() === "") return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const sheets = (value as { sheets?: unknown }).sheets;
    if (!sheets || typeof sheets !== "object" || Object.keys(sheets).length === 0) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}
