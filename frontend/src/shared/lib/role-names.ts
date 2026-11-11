/**
 * Tên tiếng Việt của vai trò theo MÃ vai trò — cho chỗ chỉ có mã trong tay (phiên đăng nhập, kết
 * quả "kiểm tra ai thấy gì"), không đọc được tên từ bản ghi vai trò. Mã vai trò mới chưa có trong
 * bảng thì hiện nguyên mã.
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

/** Mã có thể viết thường (`dept_report_compiler`) — so sánh không phân biệt hoa thường. */
export function roleName(code: string): string {
  return ROLE_NAMES[code.trim().toUpperCase()] ?? code;
}
