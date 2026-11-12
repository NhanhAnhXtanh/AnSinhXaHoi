/**
 * Chọn câu báo lỗi cho cán bộ đọc.
 *
 * Máy chủ trả lời bằng tiếng Việt (`ApiExceptionHandler`), nhưng không phải câu
 * nào tới được trình duyệt cũng từ đó: một proxy, trình duyệt ("Failed to
 * fetch"), hay một chỗ cũ của khung nền vẫn có thể trả câu tiếng Anh. Câu có chữ
 * tiếng Việt có dấu thì dùng nguyên văn; câu chỉ toàn chữ không dấu (tiếng Anh,
 * mã lỗi kỹ thuật) thì thay bằng `fallback` — người dùng không bao giờ phải đọc
 * một câu tiếng Anh.
 */
export function vietnameseOr(message: string | null | undefined, fallback: string): string {
  const text = message?.trim();
  if (!text) return fallback;
  // Tiếng Việt có dấu luôn có ký tự ngoài bảng ASCII (đ, ă, ơ, dấu thanh…).
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) return text;
  }
  return fallback;
}

/** Câu khi máy tính mất mạng — không phải "mạng chập chờn": thử lại ngay cũng vô ích. */
export const OFFLINE_TEXT = "Máy tính đang mất kết nối mạng. Bạn kiểm tra dây mạng hoặc wifi, có mạng lại thì bấm Thử lại.";

/** Câu khi máy chủ trả 403 — thiếu quyền, bấm Thử lại bao nhiêu lần cũng vậy. */
export const FORBIDDEN_TEXT =
  "Tài khoản của bạn chưa được cấp quyền xem nội dung này. Nếu công việc cần, hãy liên hệ người quản trị hệ thống.";

/** Mã HTTP của một lỗi Refine / data provider (`statusCode`), không có thì `undefined`. */
export function errorStatusOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const code = Number((error as { statusCode?: unknown }).statusCode);
    return Number.isFinite(code) ? code : undefined;
  }
  return undefined;
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Lỗi thiếu quyền: ẩn nút "Thử lại" (thử lại không đổi được gì). */
export function isForbiddenError(error: unknown): boolean {
  return errorStatusOf(error) === 403;
}

/**
 * Câu báo khi TẢI dữ liệu hỏng: mất mạng và thiếu quyền có câu riêng (trước đây mọi lỗi đều thành
 * "mạng có thể đang chập chờn", kể cả 403); câu tiếng Việt của máy chủ nếu có; còn lại `fallback`.
 */
export function loadErrorText(error: unknown, fallback: string): string {
  if (isOffline()) return OFFLINE_TEXT;
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  if (isForbiddenError(error)) return vietnameseOr(message, FORBIDDEN_TEXT);
  return vietnameseOr(message, fallback);
}
