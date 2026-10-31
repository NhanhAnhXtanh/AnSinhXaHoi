import { API_URL } from "@/shared/api/constants";

/**
 * Hình dạng dữ liệu của chi tiết đợt và lịch sử một dòng (xem
 * `PublicationItemsResponse.java`, `InputReportHistoryResponse.java`,
 * `LedgerWriteAuditResponse.java`, `AttachmentResponse.java`).
 *
 * Bản riêng của màn này — một feature không import feature khác (`npm run
 * verify:arch`), nên kiểu dây của lịch sử phiếu được khai lại ở đây như màn Duyệt
 * phiếu đã làm. Tên hằng trên dây KHÔNG đưa lên giao diện — chữ hiển thị lấy từ
 * `model.ts` và `item-history.tsx`.
 */

/** Trạng thái phiếu — enum Java, trên dây là tên hằng viết hoa. */
export type ApiReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "RETURNED"
  | "LOCKED"
  | "CANCELLED"
  | "SUPERSEDED";

export type ApiSheetCompletion = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "NO_DATA";

export type ApiLedgerWrite = {
  at: string;
  by: string | null;
  linesAdded: number;
  linesUpdated: number;
  linesRemoved: number;
  failReason: string | null;
};

/** Một dòng đơn vị × biểu của đợt — `GET /api/publications/{id}/items`. */
export type ApiPublicationItem = {
  unit: { id: number; name: string | null; block: "tinh" | "huyen" | "xa" | null };
  template: { id: number; shortName: string | null; name: string | null };
  templateVersion: { id: number | null; versionNo: number | null };
  /** Phiếu mới của đợt, hay thêm vào phiếu đang nhập lập ở đợt trước. */
  delivery: "NEW_REPORT" | "ADDED_TO_OPEN_REPORT";
  /** Số thứ tự đợt đã lập phiếu chứa biểu. */
  reportPublicationNo: number;
  /** Thời điểm tờ biểu được phát. */
  issuedAt: string;
  /** Việc gán dòng cho đợt là suy ra (dữ liệu không đủ chắc). */
  derived: boolean;
  /** Bản mới nhất của chuỗi phiên bản phiếu; `firstId` là bản phát. */
  report: { id: number; firstId: number; revisionNo: number; status: ApiReportStatus; approvedAt: string | null };
  sheet: {
    id: number;
    completion: ApiSheetCompletion;
    dataUpdatedAt: string | null;
    dataUpdatedBy: string | null;
    completedAt: string | null;
    completedBy: string | null;
  };
  /** `null` khi tài khoản không có quyền xem số liệu đã lưu. */
  ledger: { lastSuccess: ApiLedgerWrite | null; lastFailure: ApiLedgerWrite | null } | null;
};

export type ApiPublicationItems = { publicationId: number; items: ApiPublicationItem[] };

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

/** `GET /api/input_reports/{id}/history` (UC-44) — mới trước. */
export type ApiReportHistory = {
  revisions: { id: number; revisionNo: number; status: ApiReportStatus; createdAt: string }[];
  events: {
    action: HistoryAction;
    at: string | null;
    by: string | null;
    revisionNo: number;
    /** Tên ngắn của biểu với mốc của tờ biểu; `null` với mốc của phiếu. */
    sheet: string | null;
    note: string | null;
    derived: boolean;
  }[];
};

/** `GET /api/input_reports/{id}/ledger_audits` — nhật ký ghi số liệu, mới trước. */
export type ApiLedgerAudit = {
  id: number;
  reportId: number;
  templateId: number | null;
  result: "SUCCESS" | "FAILED";
  linesAdded: number;
  linesUpdated: number;
  linesRemoved: number;
  failReason: string | null;
  operatedAt: string;
  operatedBy: string | null;
};

/** `GET /api/input_reports/{id}/attachments` — chứng từ đính kèm phiếu. */
export type ApiAttachment = {
  id: number;
  reportId: number;
  fileName: string;
  createdAt: string;
  createdBy: string | null;
};

export const publicationItemsUrl = (id: number | string) => `${API_URL}/publications/${id}/items`;
export const reportHistoryUrl = (id: number | string) => `${API_URL}/input_reports/${id}/history`;
export const ledgerAuditsUrl = (id: number | string) => `${API_URL}/input_reports/${id}/ledger_audits`;
export const attachmentsUrl = (id: number | string) => `${API_URL}/input_reports/${id}/attachments`;
