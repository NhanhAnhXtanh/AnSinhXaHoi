import type { UserStatus } from "@/domains/user/types";
import { humanizeResource } from "@/domains/permission/types";

/**
 * Chữ tiếng Việt dùng chung cho các màn quản trị (người dùng, vai trò, quyền,
 * phạm vi dữ liệu).
 *
 * Tên tài nguyên và tên thao tác trên API là mã máy (`row_level_policies`,
 * `write`), nên mọi chỗ hiện cho cán bộ đều đi qua đây. Mã nào chưa có trong
 * bảng thì rơi về cách viết cũ (`humanizeResource`) thay vì hiện trống.
 */

export const RESOURCE_LABELS: Record<string, string> = {
  users: "Người dùng",
  roles: "Vai trò",
  permissions: "Quyền",
  row_level_policies: "Phạm vi dữ liệu",
  organizations: "Đơn vị",
  departments: "Phòng ban",
  notifications: "Thông báo",
  tasks: "Công việc",
  blog_posts: "Bài viết",
  categories: "Danh mục",
  dashboard: "Trang chủ",
  report_units: "Danh sách đơn vị",
  input_reports: "Nhập liệu báo cáo",
  report_review: "Duyệt phiếu nhập",
  period_setup: "Thiết lập & điều hành",
  summary: "Tổng hợp báo cáo",
  annual_review: "Duyệt báo cáo năm",
  templates: "Bộ biểu mẫu",
  report_calendar: "Lịch và kỳ báo cáo",
  publication_history: "Lịch sử mở đợt",
};

export function resourceLabel(resource: string | null | undefined): string {
  if (!resource) return "—";
  return RESOURCE_LABELS[resource] ?? humanizeResource(resource);
}

/** `read` / `write` / `delete` của mã quyền và của phạm vi dữ liệu. */
export const ACTION_LABELS: Record<string, string> = {
  read: "Xem",
  write: "Thêm, sửa",
  delete: "Xoá",
};

export function actionLabel(action: string | null | undefined): string {
  if (!action) return "—";
  return ACTION_LABELS[action] ?? action;
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "Đang hoạt động",
  inactive: "Ngừng hoạt động",
  locked: "Đã khoá",
};

export function userStatusLabel(status: UserStatus | null | undefined): string {
  if (!status) return "—";
  return USER_STATUS_LABELS[status] ?? status;
}

export const USER_STATUS_FILTER_OPTIONS: { label: string; value: UserStatus }[] =
  [
    { label: "Đang hoạt động", value: "active" },
    { label: "Ngừng hoạt động", value: "inactive" },
    { label: "Đã khoá", value: "locked" },
  ];

export const YES_NO_OPTIONS = [
  { label: "Có", value: "true" },
  { label: "Không", value: "false" },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** dd/MM/yyyy — "—" khi không có giá trị. */
export function formatDateVi(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** dd/MM/yyyy HH:mm — "—" khi không có giá trị. */
export function formatDateTimeVi(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDateVi(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Lỗi trả về từ máy chủ, đưa vào dòng mô tả của thông báo nổi. */
export function errorDescription(error: unknown): string | undefined {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" && message.length > 0 ? message : undefined;
  }
  return undefined;
}
