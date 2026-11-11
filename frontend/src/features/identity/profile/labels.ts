/**
 * "Việc được làm" trên màn Tài khoản của tôi: các mã quyền (`users:read`…) đổi
 * thành tên chức năng tiếng Việt, mỗi chức năng một lần.
 *
 * Bảng riêng của tính năng identity — tính năng không được nhập từ tính năng
 * khác, nên không dùng chung bảng của màn quản trị.
 */
const RESOURCE_LABELS: Record<string, string> = {
  dashboard: "Trang chủ",
  input_reports: "Nhập liệu báo cáo",
  report_review: "Duyệt phiếu nhập",
  period_setup: "Thiết lập & điều hành",
  summary: "Tổng hợp báo cáo",
  annual_review: "Duyệt báo cáo năm",
  templates: "Bộ biểu mẫu",
  report_calendar: "Lịch và kỳ báo cáo",
  publication_history: "Lịch sử mở đợt",
  report_units: "Danh sách đơn vị",
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
  // Mã tài nguyên của quyền ở máy chủ (khác tên màn ở trên).
  annual_reports: "Báo cáo năm",
  indicator_measures: "Bản chất chỉ tiêu",
  ledger_entries: "Số liệu đã duyệt",
  input_report_sheets: "Biểu trong phiếu nhập",
  input_report_attachments: "File đính kèm phiếu nhập",
  period_assignments: "Thiết lập biểu cho đơn vị",
  publications: "Đợt báo cáo đã mở",
  report_calendars: "Lịch báo cáo",
  report_periods: "Kỳ báo cáo",
  template_sets: "Bộ mẫu",
  template_versions: "Phiên bản mẫu",
};

/**
 * Tên vai trò theo mã — dùng khi tài khoản không có quyền xem người dùng nên không đọc được tên
 * vai trò từ bản ghi, chỉ có mã trong phiên đăng nhập (mã có thể viết thường).
 */
const ROLE_NAMES: Record<string, string> = {
  ADMIN: "Quản trị hệ thống",
  MANAGER: "Quản lý nội dung",
  USER: "Người xem nội dung",
  ORGANIZATION_REPORTER: "Cán bộ đơn vị nhập liệu",
  REPORT_APPROVER: "Cán bộ Sở duyệt phiếu",
  REPORT_ADMIN: "Cán bộ Sở điều hành kỳ báo cáo",
  TEMPLATE_ADMIN: "Cán bộ quản lý biểu mẫu",
  DEPT_REPORT_COMPILER: "Cán bộ Sở tổng hợp số liệu",
  DEPT_REPORT_SUBMITTER: "Cán bộ Sở nộp báo cáo năm",
  UBND_APPROVER: "Lãnh đạo UBND duyệt báo cáo năm",
  AUDITOR: "Kiểm tra (chỉ xem)",
};

/** Tên vai trò tiếng Việt cho một mã vai trò; chưa biết mã thì giữ nguyên chữ nhận được. */
export function roleName(code: string): string {
  return ROLE_NAMES[code.trim().toUpperCase()] ?? code;
}

function fallbackLabel(resource: string): string {
  const spaced = resource.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function workLabels(permissionCodes: string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const code of permissionCodes) {
    const separator = code.indexOf(":");
    const resource = separator === -1 ? code : code.slice(0, separator);
    if (seen.has(resource)) continue;
    seen.add(resource);
    labels.push(RESOURCE_LABELS[resource] ?? fallbackLabel(resource));
  }
  return labels;
}
