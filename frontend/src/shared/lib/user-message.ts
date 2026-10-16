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
