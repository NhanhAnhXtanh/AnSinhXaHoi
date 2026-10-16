import { API_URL } from "@/shared/api/constants";
import { getAccessToken, refreshSession } from "@/shared/api/session";

import { REPORTS_RESOURCE } from "./api";

/**
 * Xác nhận Kho bạc của phiếu, phía Sở chỉ đọc (UC-40 bước 3) — điểm cuối của slice
 * đính kèm: `GET /api/input_reports/{id}/attachments`,
 * `GET /api/input_reports/{id}/attachments/{aid}/content`.
 *
 * Gọi bằng `fetch` thay vì data provider vì tải tệp về cần nhận nhị phân. Bản
 * riêng của feature này (không import feature Nhập liệu).
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

/**
 * Mở một tệp đính kèm: ảnh / PDF mở ở thẻ mới để xem, tệp khác tải về máy (tên tệp
 * giữ nguyên như lúc tải lên).
 */
export async function openAttachment(
  reportId: number,
  attachment: AttachmentRecord,
  mode: "view" | "download"
): Promise<void> {
  const response = await authFetch(`${base(reportId)}/attachments/${attachment.id}/content`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    if (mode === "view" && attachment.previewable) {
      a.target = "_blank";
      a.rel = "noopener";
    } else {
      a.download = attachment.fileName;
    }
    a.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
