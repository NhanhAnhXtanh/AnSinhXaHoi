// Dữ liệu mẫu — thay bằng API khi backend có.
//
// Bộ mẫu → biểu mẫu → các phiên bản của biểu (UC-09..19). Ngày lưu theo
// ISO ("2026-07-01", "2026-07-01T14:10:00"); màn tự viết lại theo dd/MM/yyyy.

export type VersionStatus =
  | "draft"
  | "testing"
  | "published"
  | "locked"
  | "revoked"
  | "archived";

export type FormKind = "chi-tiet" | "tong-hop";

export type TemplateSet = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type TemplateForm = {
  id: string;
  setId: string;
  /** Tên ngắn hiện trên thẻ biểu: "1a", "1b"… */
  name: string;
  /** Dòng phụ dưới tên biểu. */
  title?: string;
  kind: FormKind;
};

export type TemplateVersion = {
  id: string;
  formId: string;
  number: number;
  status: VersionStatus;
  /** Ngày áp dụng từ (chỉ có ngày bắt đầu, không có ngày hết hạn). */
  effectiveFrom: string | null;
  publishedAt: string | null;
  approver: string | null;
  /** Số phiếu đã lập theo phiên bản này — lớn hơn 0 thì không xoá được. */
  usedCount: number;
};

export type ChangeLogEntry = {
  id: string;
  setId: string;
  at: string;
  actor: string;
  content: string;
};

/** Một dòng số liệu của biểu chi tiết: tên chính sách, số đối tượng, mức hỗ trợ (đồng/tháng), số tháng. */
export type PolicyItem = [name: string, people: number, monthly: number, months: number];

export const CURRENT_USER = "Nguyễn Thị Thu";

export const TEMPLATE_SETS: TemplateSet[] = [
  {
    id: "set-asxh",
    name: "Biểu mẫu ASXH",
    description: "Các biểu báo cáo chính sách an sinh xã hội của cấp xã.",
    createdAt: "2023-12-10",
    updatedAt: "2026-10-15",
  },
  {
    id: "set-stc",
    name: "Mẫu báo cáo Sở Tài chính",
    createdAt: "2025-11-20",
    updatedAt: "2026-09-02",
  },
  {
    id: "set-tt08",
    name: "Bộ biểu mẫu thông tư 08",
    createdAt: "2025-06-05",
    updatedAt: "2026-08-20",
  },
  {
    id: "set-q4",
    name: "Mẫu thử nghiệm quý IV",
    createdAt: "2026-09-08",
    updatedAt: "2026-09-08",
  },
];

export const TEMPLATE_FORMS: TemplateForm[] = [
  { id: "f-1a", setId: "set-asxh", name: "1a", title: "Chính sách hỗ trợ giáo dục", kind: "chi-tiet" },
  { id: "f-1b", setId: "set-asxh", name: "1b", title: "Chính sách bảo hiểm y tế", kind: "chi-tiet" },
  { id: "f-1c", setId: "set-asxh", name: "1c", title: "Trợ cấp xã hội hằng tháng", kind: "chi-tiet" },
  { id: "f-1d", setId: "set-asxh", name: "1d", title: "Hỗ trợ người có công", kind: "chi-tiet" },
  { id: "f-1e", setId: "set-asxh", name: "1e", title: "Chính sách người cao tuổi", kind: "chi-tiet" },
  { id: "f-1f", setId: "set-asxh", name: "1f", title: "Chính sách người khuyết tật", kind: "chi-tiet" },
  { id: "f-1g", setId: "set-asxh", name: "1g", title: "Hỗ trợ nhà ở hộ nghèo", kind: "chi-tiet" },
  { id: "f-1h", setId: "set-asxh", name: "1h", title: "Hỗ trợ học nghề, việc làm", kind: "chi-tiet" },
  { id: "f-thn", setId: "set-asxh", name: "tổng hợp năm", title: "Tổng hợp kết quả cả năm", kind: "tong-hop" },
  { id: "f-01", setId: "set-stc", name: "01", title: "Quyết toán kinh phí an sinh xã hội", kind: "chi-tiet" },
  { id: "f-02", setId: "set-stc", name: "02", title: "Thuyết minh quyết toán", kind: "tong-hop" },
  { id: "f-08a", setId: "set-tt08", name: "08a", title: "Tình hình thực hiện chính sách", kind: "chi-tiet" },
  { id: "f-08b", setId: "set-tt08", name: "08b", title: "Kinh phí chi trả qua bưu điện", kind: "chi-tiet" },
];

function v(
  formId: string,
  number: number,
  status: VersionStatus,
  effectiveFrom: string | null,
  publishedAt: string | null,
  approver: string | null,
  usedCount: number
): TemplateVersion {
  return {
    id: `${formId}-v${number}`,
    formId,
    number,
    status,
    effectiveFrom,
    publishedAt,
    approver,
    usedCount,
  };
}

const MINH = "Trần Văn Minh";
const THU = "Nguyễn Thị Thu";
const HOA = "Lê Thị Hoa";

export const TEMPLATE_VERSIONS: TemplateVersion[] = [
  v("f-1a", 1, "published", "2025-01-01", "2024-12-16T09:20:00", MINH, 104),
  v("f-1a", 2, "published", "2026-01-01", "2025-12-20T10:05:00", MINH, 106),
  v("f-1a", 3, "published", "2026-07-01", "2026-07-01T14:10:00", THU, 53),
  v("f-1a", 4, "draft", null, null, null, 0),

  v("f-1b", 1, "published", "2025-01-01", "2024-12-16T09:25:00", MINH, 104),
  v("f-1b", 2, "published", "2026-01-01", "2025-12-22T15:40:00", MINH, 106),

  v("f-1c", 1, "locked", "2026-01-01", "2025-12-22T15:45:00", MINH, 106),

  v("f-1d", 1, "published", "2025-01-01", "2024-12-16T09:30:00", MINH, 104),
  v("f-1d", 2, "published", "2026-04-01", "2026-03-25T08:50:00", THU, 80),

  v("f-1e", 1, "draft", null, null, null, 0),

  v("f-1f", 1, "published", "2024-01-01", "2023-12-18T10:00:00", MINH, 98),
  v("f-1f", 2, "published", "2025-01-01", "2024-12-16T09:35:00", MINH, 104),
  v("f-1f", 3, "published", "2026-01-01", "2025-12-22T16:00:00", MINH, 106),
  v("f-1f", 4, "published", "2026-07-01", "2026-06-26T11:15:00", THU, 53),

  v("f-1g", 1, "published", "2025-01-01", "2024-12-16T09:40:00", MINH, 104),
  v("f-1g", 2, "published", "2026-01-01", "2025-12-22T16:10:00", MINH, 106),

  v("f-1h", 1, "published", "2026-01-01", "2025-12-22T16:20:00", MINH, 106),

  v("f-thn", 1, "published", "2025-01-01", "2024-12-18T14:00:00", MINH, 2),
  v("f-thn", 2, "published", "2026-01-01", "2025-12-24T09:10:00", MINH, 1),
  v("f-thn", 3, "published", "2026-07-01", "2026-09-17T10:41:00", MINH, 0),

  v("f-01", 1, "published", "2026-01-01", "2025-12-26T10:00:00", HOA, 12),
  v("f-02", 1, "published", "2026-01-01", "2025-12-26T10:05:00", HOA, 12),

  v("f-08a", 1, "published", "2025-07-01", "2025-06-20T09:00:00", HOA, 40),
  v("f-08a", 2, "revoked", "2026-01-01", "2025-12-29T15:30:00", HOA, 0),
  v("f-08b", 1, "testing", null, null, null, 0),
];

export const CHANGE_LOG: ChangeLogEntry[] = [
  { id: "log-11", setId: "set-asxh", at: "2026-10-15T17:23:00", actor: THU, content: "Tạo phiên bản 4 của biểu 1a" },
  { id: "log-10", setId: "set-asxh", at: "2026-10-13T13:29:00", actor: THU, content: "Sửa thiết kế phiên bản 4 của biểu 1a" },
  { id: "log-09", setId: "set-asxh", at: "2026-10-02T09:46:00", actor: MINH, content: "Khoá phiên bản 1 của biểu 1c" },
  { id: "log-08", setId: "set-asxh", at: "2026-09-17T10:41:00", actor: MINH, content: "Ban hành phiên bản 3 của biểu tổng hợp năm" },
  { id: "log-07", setId: "set-asxh", at: "2026-09-17T10:26:00", actor: HOA, content: "Đổi tên bộ mẫu thành “Biểu mẫu ASXH”" },
  { id: "log-06", setId: "set-asxh", at: "2026-09-16T14:29:00", actor: HOA, content: "Tạo biểu 1h" },
  { id: "log-05", setId: "set-asxh", at: "2026-09-16T14:01:00", actor: THU, content: "Sửa quy tắc tính của biểu 1b" },
  { id: "log-04", setId: "set-asxh", at: "2026-07-01T14:10:00", actor: THU, content: "Ban hành phiên bản 3 của biểu 1a" },
  { id: "log-03", setId: "set-asxh", at: "2026-06-26T11:15:00", actor: THU, content: "Ban hành phiên bản 4 của biểu 1f" },
  { id: "log-02", setId: "set-asxh", at: "2026-03-25T08:50:00", actor: THU, content: "Ban hành phiên bản 2 của biểu 1d" },
  { id: "log-01", setId: "set-asxh", at: "2023-12-10T09:12:00", actor: THU, content: "Tạo bộ mẫu “Biểu mẫu ASXH”" },
  { id: "log-s2", setId: "set-stc", at: "2026-09-02T08:30:00", actor: HOA, content: "Sửa mô tả bộ mẫu" },
  { id: "log-s1", setId: "set-stc", at: "2025-11-20T10:00:00", actor: HOA, content: "Tạo bộ mẫu “Mẫu báo cáo Sở Tài chính”" },
  { id: "log-t2", setId: "set-tt08", at: "2026-08-20T15:00:00", actor: HOA, content: "Tạo biểu 08b" },
  { id: "log-t1", setId: "set-tt08", at: "2025-06-05T09:00:00", actor: HOA, content: "Tạo bộ mẫu “Bộ biểu mẫu thông tư 08”" },
  { id: "log-q1", setId: "set-q4", at: "2026-09-08T16:45:00", actor: THU, content: "Tạo bộ mẫu “Mẫu thử nghiệm quý IV”" },
];

/**
 * Số liệu minh hoạ trên bảng thiết kế của từng biểu. Kinh phí (triệu đồng)
 * = số đối tượng × mức hỗ trợ × số tháng / 1.000.000, làm tròn — tính lúc dựng
 * bảng nên dòng Cộng luôn khớp.
 */
export const POLICY_ITEMS: Record<string, PolicyItem[]> = {
  "f-1a": [
    ["Hỗ trợ chi phí học tập — hộ nghèo", 1240, 150000, 9],
    ["Hỗ trợ chi phí học tập — hộ cận nghèo", 860, 150000, 9],
    ["Miễn giảm học phí — học sinh THPT", 2115, 300000, 9],
    ["Hỗ trợ tiền ăn trưa — trẻ mầm non", 3470, 150000, 9],
    ["Hỗ trợ học sinh dân tộc thiểu số vùng khó khăn", 410, 540000, 9],
    ["Hỗ trợ học bổng — học sinh khuyết tật", 96, 600000, 9],
  ],
  "f-1b": [
    ["Mua thẻ bảo hiểm y tế — người nghèo", 3820, 105300, 12],
    ["Mua thẻ bảo hiểm y tế — người cận nghèo", 2140, 73710, 12],
    ["Mua thẻ bảo hiểm y tế — trẻ dưới 6 tuổi", 5260, 105300, 12],
  ],
  "f-1c": [
    ["Trợ cấp người đơn thân nuôi con", 312, 500000, 12],
    ["Trợ cấp trẻ mồ côi", 87, 1000000, 12],
    ["Trợ cấp người khuyết tật nặng", 645, 750000, 12],
  ],
  "f-1d": [
    ["Trợ cấp thương binh", 418, 2789000, 12],
    ["Trợ cấp thân nhân liệt sĩ", 236, 2789000, 12],
  ],
  "f-1e": [
    ["Trợ cấp người cao tuổi từ 80 tuổi", 2750, 500000, 12],
    ["Mừng thọ người cao tuổi", 1320, 300000, 1],
  ],
  "f-1f": [
    ["Trợ cấp người khuyết tật đặc biệt nặng", 214, 1000000, 12],
    ["Trợ cấp người khuyết tật nặng", 645, 750000, 12],
  ],
  "f-1g": [
    ["Hỗ trợ xây mới nhà ở hộ nghèo", 38, 40000000, 1],
    ["Hỗ trợ sửa chữa nhà ở hộ nghèo", 54, 20000000, 1],
  ],
  "f-1h": [
    ["Hỗ trợ học nghề — lao động nông thôn", 620, 450000, 6],
    ["Hỗ trợ tìm việc làm — người khuyết tật", 75, 300000, 6],
  ],
  "f-thn": [
    ["Chính sách hỗ trợ giáo dục", 8191, 0, 0],
    ["Chính sách bảo hiểm y tế", 11220, 0, 0],
  ],
  "f-01": [["Chi trợ cấp xã hội hằng tháng", 1044, 750000, 12]],
  "f-02": [["Thuyết minh chênh lệch dự toán", 0, 0, 0]],
  "f-08a": [["Chi trả trợ cấp hằng tháng", 1044, 750000, 12]],
  "f-08b": [["Chi trả qua bưu điện", 980, 750000, 12]],
};

/** Đơn vị minh hoạ in trên đầu biểu. */
export const SAMPLE_UNIT = "UBND xã Phú Hữu";
export const SAMPLE_PLACE = "Phú Hữu";

/** Quy tắc nhập minh hoạ trong khung "Soạn công thức và quy tắc nhập". */
export const SAMPLE_RULE = {
  name: "Tự tính kinh phí",
  code: [
    "// Tự tính kinh phí khi sửa số đối tượng hoặc mức hỗ trợ",
    "khi_sua_o(C, E, F) {",
    "    D = C * E * F / 1.000.000",
    "    nếu (C < 0) báo_lỗi(\"Số đối tượng không được âm\")",
    "}",
    "// Dòng cộng",
    "D12 = TỔNG(D6:D11)",
  ].join("\n"),
};
