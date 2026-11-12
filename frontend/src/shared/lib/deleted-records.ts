/**
 * Bản ghi vừa xoá từ chính màn đang mở nó.
 *
 * Khi xoá thành công, Refine gỡ truy vấn "một bản ghi" khỏi bộ nhớ đệm; màn Sửa / Xem vẫn đang
 * theo dõi truy vấn đó nên tải lại ngay, nhận "không tìm thấy" và hiện thêm một thông báo đỏ
 * "Chưa tải được dữ liệu" ngay sau thông báo "Đã xoá" — trước khi kịp chuyển về danh sách.
 * Ghi tên bản ghi vào đây lúc bấm xoá để thông báo lỗi tải của đúng bản ghi đó được bỏ qua trong
 * vài giây; bản ghi khác và lỗi thật vẫn hiện bình thường.
 */
const SUPPRESS_MS = 8_000;

const deletedAt = new Map<string, number>();

/** Khoá thông báo lỗi tải một bản ghi do Refine đặt (`useOne`). */
export function loadNotificationKey(resource: string, id: unknown): string {
  return `${String(id)}-${resource}-getOne-notification`;
}

export function markRecordDeleting(resource: string, id: unknown): void {
  deletedAt.set(loadNotificationKey(resource, id), Date.now());
}

/** Xoá không thành công: các thông báo lỗi tải lại như bình thường. */
export function unmarkRecordDeleting(resource: string, id: unknown): void {
  deletedAt.delete(loadNotificationKey(resource, id));
}

/** True khi thông báo mang khoá này là lỗi tải của bản ghi vừa xoá. */
export function isDeletedRecordNotification(key: string | undefined): boolean {
  if (!key) return false;
  const at = deletedAt.get(key);
  if (at === undefined) return false;
  if (Date.now() - at > SUPPRESS_MS) {
    deletedAt.delete(key);
    return false;
  }
  return true;
}
