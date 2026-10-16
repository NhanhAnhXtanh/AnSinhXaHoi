import { API_URL } from "@/shared/api/constants";
import { getAccessToken, refreshSession } from "@/shared/api/session";

import { REPORTS_RESOURCE } from "./api";

/**
 * Xác nhận Kho bạc của phiếu (UC-38, BR-38.1..38.3) — điểm cuối của slice đính kèm:
 *
 * - `GET/POST /api/input_reports/{id}/attachments` (POST multipart, trường `file`)
 * - `GET /api/input_reports/{id}/attachments/{aid}/content`, `DELETE …/{aid}`
 * - `GET/PUT /api/input_reports/{id}/treasury_confirmation` (thân `{confirmed}`)
 *
 * Gọi bằng `fetch` thay vì data provider: tải tệp lên là multipart, mà bộ ky của
 * data provider gắn sẵn kiểu nội dung JSON; tải tệp về cần nhận nhị phân.
 */

export type AttachmentRecord = {
  id: number;
  reportId: number;
  kind: "TREASURY_CONFIRMATION";
  fileName: string;
  contentType: string | null;
  fileSize: number;
  previewable: boolean;
  createdAt: string;
  createdBy: string | null;
};

export type TreasuryConfirmation = {
  reportId: number;
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedBy: string | null;
  fileCount: number;
  /** Đủ điều kiện nộp: có tệp VÀ đã tích (hoặc đơn vị không bắt buộc). */
  ready: boolean;
  required: boolean;
  maxFiles: number;
  maxFileBytes: number;
};

/** Lỗi theo đúng dạng `HttpError` của Refine, để `errorMessage` đọc được câu của máy chủ. */
type ApiError = { message: string; statusCode: number };

function base(reportId: number): string {
  return `${API_URL}/${REPORTS_RESOURCE}/${reportId}`;
}

/** `fetch` có mã đăng nhập; mã hết hạn thì làm mới một lần rồi gửi lại. */
async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
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
    const error: ApiError = { message: body?.message || response.statusText, statusCode: response.status };
    throw error;
  }
  return response;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(url, init);
  return (await response.json()) as T;
}

export function listAttachments(reportId: number): Promise<AttachmentRecord[]> {
  return json<AttachmentRecord[]>(`${base(reportId)}/attachments`);
}

export function uploadAttachment(reportId: number, file: File): Promise<AttachmentRecord> {
  const form = new FormData();
  form.append("file", file);
  return json<AttachmentRecord>(`${base(reportId)}/attachments`, { method: "POST", body: form });
}

export function deleteAttachment(reportId: number, attachmentId: number): Promise<AttachmentRecord> {
  return json<AttachmentRecord>(`${base(reportId)}/attachments/${attachmentId}`, { method: "DELETE" });
}

export function getTreasuryConfirmation(reportId: number): Promise<TreasuryConfirmation> {
  return json<TreasuryConfirmation>(`${base(reportId)}/treasury_confirmation`);
}

export function setTreasuryConfirmation(reportId: number, confirmed: boolean): Promise<TreasuryConfirmation> {
  return json<TreasuryConfirmation>(`${base(reportId)}/treasury_confirmation`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmed }),
  });
}

/** Tải một tệp đính kèm về máy (tên tệp giữ nguyên như lúc tải lên). */
export async function downloadAttachment(reportId: number, attachment: AttachmentRecord): Promise<void> {
  const response = await authFetch(`${base(reportId)}/attachments/${attachment.id}/content`);
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
