import { API_URL } from "@/shared/api/constants";
import { getAccessToken, refreshSession } from "@/shared/api/session";
import type { StatusTone } from "@/shared/components/asxh";
import { loadErrorText } from "@/shared/lib/user-message";

/**
 * Báo cáo năm — hình dạng dữ liệu của `/api/annual_reports` (xem `AnnualReportController` phía máy
 * chủ). Mỗi lần Sở nộp báo cáo năm lên UBND là một "Phiếu n"; một năm chỉ một phiếu còn hiệu lực.
 *
 * - `GET /annual_reports?year=&status=` — các lần nộp (mảng trần + `X-Total-Count`)
 * - `GET /annual_reports/{id}` — đầu phiếu + biểu + file phiếu nộp
 * - `POST /annual_reports/{id}/approve | return {reason} | reopen {reason}`
 * - `GET /annual_reports/{id}/sheets/{templateId}` — dựng một biểu năm ở phiên bản đã ghim
 * - `GET /annual_reports/{id}/attachments/{aid}/content` — tải file phiếu nộp
 */

export const ANNUAL_RESOURCE = "annual_reports";
/** Resource Refine của màn (khai ở `app/resources`) — `useCan` hỏi quyền theo tên này. */
export const ANNUAL_SCREEN = "annual_review";

export const SUBMITTER_ORG = "Sở Tài chính Đồng Nai";
export const UBND_ORG = "UBND tỉnh Đồng Nai";

/** Trạng thái phiếu năm — trên dây viết thường. */
export type AnnualStatus = "submitted" | "approved" | "returned";

export const STATUS: Record<AnnualStatus, { label: string; tone: StatusTone }> = {
  submitted: { label: "Chờ UBND duyệt", tone: "warning" },
  approved: { label: "UBND đã duyệt", tone: "success" },
  returned: { label: "UBND trả lại", tone: "destructive" },
};

export type AnnualSheet = {
  templateId: number;
  /** Mã nội bộ — chỉ để script đọc, không hiện cho người dùng. */
  templateCode: string;
  shortName: string;
  name: string;
  templateVersionId: number;
  versionNo: number;
  displayOrder: number;
};

export type AnnualAttachment = {
  id: number;
  reportId: number;
  fileName: string;
  contentType: string | null;
  fileSize: number;
  previewable: boolean;
  createdAt: string;
  createdBy: string | null;
};

export type AnnualAction = "approve" | "return" | "reopen";

/** Một lần nộp báo cáo năm ("Phiếu n"). */
export type AnnualReportRecord = {
  id: number;
  year: number;
  revisionNo: number;
  status: AnnualStatus;
  statusLabel: string;
  /** Phiên bản số liệu tổng hợp đã ghim khi nộp. */
  ledgerVersion: number;
  docNo: string;
  docDate: string;
  submittedAt: string;
  submittedBy: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  returnReason: string | null;
  /** UBND mở lại sau khi đã duyệt (trạng thái thành trả lại). */
  reopened: boolean;
  /** Lần nộp mới nhất của năm — chỉ phiếu này được quyết định. */
  latest: boolean;
  sheetCount: number;
  attachmentCount: number;
  /** Thao tác tài khoản đang dùng làm được (máy chủ vẫn kiểm lại khi bấm). */
  actions: AnnualAction[];
  /** Chỉ có ở `GET /{id}`; danh sách trả `null`. */
  sheets: AnnualSheet[] | null;
  attachments: AnnualAttachment[] | null;
};

/** Một biểu năm để dựng bảng — cùng dạng biểu năm ở màn Tổng hợp, nhưng ở phiên bản đã ghim. */
export type AnnualSheetRuntime = {
  reportId: number;
  year: number;
  revisionNo: number;
  templateId: number;
  sheetCode: string;
  shortName: string;
  sheetName: string;
  versionId: number;
  versionNo: number;
  workbookJson: string;
  scriptText: string | null;
  ledgerVersion: number;
  summaryDataUrl: string;
  a: number;
  b: number;
  rows: Record<string, unknown>[];
};

// ---------------------------------------------------------------- đường dẫn

export function annualUrl(id: number, suffix = ""): string {
  return `${API_URL}/${ANNUAL_RESOURCE}/${id}${suffix}`;
}

export function annualSheetUrl(id: number, templateId: number): string {
  return annualUrl(id, `/sheets/${templateId}`);
}

/** `useCustomMutation` đi qua ky gốc — thiếu dòng này máy chủ trả 415 cho thân JSON. */
export const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };

// ---------------------------------------------------------------- tiện ích thuần

/** Phiếu mới nhất của mỗi năm, năm mới nhất lên đầu. */
export function latestPerYear(list: AnnualReportRecord[]): AnnualReportRecord[] {
  const byYear = new Map<number, AnnualReportRecord>();
  for (const s of list) {
    const cur = byYear.get(s.year);
    if (!cur || s.revisionNo > cur.revisionNo) byYear.set(s.year, s);
  }
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

/** Câu lỗi tiếng Việt máy chủ trả (`ApiExceptionHandler`), hoặc câu dự phòng. */
export function errorMessage(error: unknown, fallback: string): string {
  // Câu tiếng Việt của máy chủ nếu có; mất mạng và thiếu quyền (403) có câu riêng thay cho
  // `fallback` (trước đây 403 cũng hiện thành "mạng có thể đang chập chờn").
  return loadErrorText(error, fallback);
}

/** Mã lỗi HTTP của một lỗi Refine (`HttpError.statusCode`). */
export function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const code = Number((error as { statusCode?: unknown }).statusCode);
    return Number.isFinite(code) ? code : undefined;
  }
  return undefined;
}

/** Đọc chuỗi JSON workbook; hỏng / rỗng / không có sheet → null. */
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

/** Chữ không dấu, nối gạch: "Năm 2026" → "Nam-2026". */
function slug(raw: string): string {
  return raw
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Tên tệp xuất Excel: "BaoCaoNam_2026_Phieu-2_01.xlsx". */
export function exportFileName(year: number, revisionNo: number, sheetLabel: string): string {
  const parts = ["BaoCaoNam", String(year), `Phieu-${revisionNo}`, slug(sheetLabel)].filter((p) => p !== "");
  return `${parts.join("_")}.xlsx`;
}

/** Dung lượng dễ đọc: 912 KB, 1,2 MB. */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("vi-VN")} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
}

const ORDINAL = ["", "đầu", "thứ hai", "thứ ba", "thứ tư", "thứ năm", "thứ sáu", "thứ bảy"];

/** 1 → "nộp lần đầu"; 2 → "nộp lần thứ hai". */
export function submitOrdinal(n: number): string {
  return `nộp lần ${ORDINAL[n] ?? `thứ ${n}`}`;
}

// ---------------------------------------------------------------- tải file phiếu nộp

/**
 * Tải file nhị phân bằng `fetch` có mã đăng nhập (data provider chỉ đọc JSON); mã hết hạn thì làm
 * mới một lần rồi gửi lại. Lỗi ném theo dạng `HttpError` của Refine để `errorMessage` đọc được.
 */
async function authFetch(url: string): Promise<Response> {
  const send = (token: string | null) => {
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { headers });
  };
  let response = await send(getAccessToken());
  if (response.status === 401) {
    const token = await refreshSession(API_URL);
    if (token) response = await send(token);
  }
  if (!response.ok) {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { message?: string } | null;
    throw { message: body?.message || response.statusText, statusCode: response.status };
  }
  return response;
}

/** Tải một file phiếu nộp về máy (tên tệp giữ nguyên như lúc nộp). */
export async function downloadAttachment(attachment: AnnualAttachment): Promise<void> {
  const response = await authFetch(annualUrl(attachment.reportId, `/attachments/${attachment.id}/content`));
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.fileName;
    a.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}

/** File phiếu nộp của một lần nộp (danh sách không mang file — đọc riêng khi cần). */
export async function listAttachments(reportId: number): Promise<AnnualAttachment[]> {
  const response = await authFetch(annualUrl(reportId, "/attachments"));
  return (await response.json()) as AnnualAttachment[];
}

/** Tải lần lượt mọi file phiếu nộp của một lần nộp. */
export async function downloadAll(attachments: AnnualAttachment[]): Promise<void> {
  for (const attachment of attachments) {
    await downloadAttachment(attachment);
  }
}
