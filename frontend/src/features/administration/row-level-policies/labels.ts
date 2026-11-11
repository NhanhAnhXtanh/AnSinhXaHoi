import {
  NULLARY_OPERATORS,
  type PolicyKind,
  type ScopeNode,
} from "@/domains/row-level-policy/types";

/**
 * Chữ tiếng Việt cho màn Phạm vi dữ liệu.
 *
 * `domains/row-level-policy` giữ các mã máy (`eq`, `SCOPE`, `user.id`) và bản
 * đọc tiếng Anh; ở đây là bản đọc cho cán bộ. Mã nào chưa có trong bảng thì
 * hiện nguyên mã, không hiện trống.
 */

export const KIND_LABELS: Record<PolicyKind, string> = {
  SCOPE: "Mở rộng",
  FILTER: "Hạn chế",
};

export const KIND_OPTION_LABELS: Record<PolicyKind, string> = {
  SCOPE: "Mở rộng cho một vai trò",
  FILTER: "Hạn chế cho mọi người",
};

export const OPERATOR_LABELS_VI: Record<string, string> = {
  eq: "bằng",
  ne: "khác",
  in: "là một trong",
  notIn: "không thuộc",
  lt: "nhỏ hơn",
  lte: "không lớn hơn",
  gt: "lớn hơn",
  gte: "không nhỏ hơn",
  between: "trong khoảng",
  like: "chứa",
  notLike: "không chứa",
  isNull: "để trống",
  isNotNull: "có giá trị",
};

export function operatorLabelVi(op: string): string {
  return OPERATOR_LABELS_VI[op] ?? op;
}

/** Tên trường dữ liệu theo phần cuối đường dẫn (`organization.id` → Đơn vị). */
const FIELD_PART_LABELS: Record<string, string> = {
  id: "Mã số",
  code: "Mã",
  name: "Tên",
  title: "Tiêu đề",
  status: "Trạng thái",
  priority: "Mức ưu tiên",
  dueDate: "Hạn hoàn thành",
  completedAt: "Ngày hoàn thành",
  createdAt: "Ngày tạo",
  updatedAt: "Ngày sửa",
  assignee: "Người được giao",
  category: "Danh mục",
  createdBy: "Người tạo",
  updatedBy: "Người sửa",
  department: "Phòng ban",
  organization: "Đơn vị",
  role: "Vai trò",
  user: "Người dùng",
  // Phiếu nhập / số liệu đã duyệt (input_reports, ledger_entries).
  unit: "Đơn vị báo cáo",
  submitterUnit: "Đơn vị nộp",
  period: "Kỳ báo cáo",
  template: "Biểu mẫu",
  report: "Phiếu nhập",
  publication: "Đợt báo cáo",
};

export function fieldLabel(path: string): string {
  const parts = path.split(".");
  // `organization.id` là "đơn vị" chứ không phải "mã số của đơn vị".
  if (parts.length === 2 && parts[1] === "id") {
    return FIELD_PART_LABELS[parts[0]] ?? path;
  }
  if (parts.length === 1) return FIELD_PART_LABELS[parts[0]] ?? path;
  const labels = parts.map((part) => FIELD_PART_LABELS[part]);
  if (labels.some((label) => label === undefined)) return path;
  return [...labels].reverse().join(" của ").replace(/^./, (c) => c.toUpperCase());
}

const CONTEXT_LABELS: Record<string, string> = {
  "user.id": "tài khoản đang đăng nhập",
  // Tài khoản đơn vị báo cáo (ASXH) lưu đơn vị ở `reportUnitId`; `organizationId` là cột của khung
  // gốc và để trống với các tài khoản đó — đặt phạm vi phiếu theo `organizationId` sẽ không khớp dòng nào.
  "user.reportUnitId": "đơn vị báo cáo của tài khoản đang đăng nhập",
  "user.organizationId": "tổ chức (khung gốc) của tài khoản đang đăng nhập",
  "user.departmentId": "phòng ban của tài khoản đang đăng nhập",
  "user.roleCodes": "vai trò của tài khoản đang đăng nhập",
  today: "ngày hôm nay",
  now: "thời điểm hiện tại",
};

export function contextLabel(key: string): string {
  return CONTEXT_LABELS[key] ?? key;
}

/** Cây điều kiện thành một câu tiếng Việt — theo đúng cây người viết đã viết. */
export function readConditionVi(node: ScopeNode | undefined | null): string {
  if (!node) return "—";

  if ("all" in node) {
    if (node.all.length === 0) return "mọi dòng";
    return node.all.map(readConditionVi).join(" và ");
  }
  if ("any" in node) {
    if (node.any.length === 0) return "không dòng nào";
    return `(${node.any.map(readConditionVi).join(" hoặc ")})`;
  }
  if ("not" in node) {
    return `không phải (${readConditionVi(node.not)})`;
  }

  const field = fieldLabel(node.field);
  const op = operatorLabelVi(node.op);
  if (NULLARY_OPERATORS.has(node.op)) {
    return `${field} ${op}`;
  }

  const value = node.value;
  if (value && "ctx" in value) {
    return `${field} ${op} ${contextLabel(value.ctx)}`;
  }
  if (value && "lit" in value) {
    const literal = Array.isArray(value.lit)
      ? node.op === "between"
        ? `${value.lit[0] ?? ""} đến ${value.lit[1] ?? ""}`
        : value.lit.join(", ")
      : String(value.lit);
    return `${field} ${op} ${literal}`;
  }
  return `${field} ${op}`;
}

const COMPILED_LEAF =
  /\b([A-Za-z]\w*(?:\.\w+)+)\s+(eq|ne|in|notIn|lt|lte|gt|gte|between|like|notLike|isNull|isNotNull)\b(?:\s+([^\s()]+))?/g;

/**
 * Điều kiện máy chủ đã biên dịch (`((unit.id eq user.organizationId)) AND …`) thành chữ cho cán bộ:
 * tên trường, phép so sánh và giá trị lấy từ tài khoản đọc bằng nhãn tiếng Việt; AND / OR / NOT
 * thành và / hoặc / không. Phần máy chủ đã viết sẵn bằng tiếng Việt giữ nguyên.
 */
export function readCompiledVi(text: string | null | undefined): string {
  if (!text) return "—";
  return text
    .replace(COMPILED_LEAF, (_match, field: string, op: string, value?: string) => {
      const label = fieldLabel(field);
      const shown = value === undefined ? "" : ` ${CONTEXT_LABELS[value] ?? value}`;
      return `${label} ${operatorLabelVi(op)}${shown}`;
    })
    .replace(/\bAND\b/g, "và")
    .replace(/\bOR\b/g, "hoặc")
    .replace(/\bNOT\b/g, "không phải")
    .replace(/\beverything\b/g, "mọi dòng")
    .replace(/\bnothing\b/g, "không dòng nào");
}
