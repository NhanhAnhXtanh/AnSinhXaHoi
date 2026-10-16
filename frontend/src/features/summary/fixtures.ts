// Dữ liệu mẫu — thay bằng API khi backend có

/**
 * Dữ liệu mẫu cho màn Tổng hợp báo cáo (Đồng Nai).
 *
 * Số liệu không viết tay từng ô: mỗi đơn vị có số riêng sinh từ một hàm băm cố
 * định (cùng đầu vào → cùng số), rồi bảng được CỘNG từ số của từng đơn vị. Nhờ
 * vậy dòng nhóm luôn bằng tổng các dòng con, "Toàn tỉnh" luôn bằng "Khối huyện"
 * + "Khối xã", và đổi phạm vi vẫn ra số đúng.
 */

import type { PeriodKind, StatusTone } from "@/shared/components/asxh";

// ---------------------------------------------------------------- Đơn vị

export type UnitBlock = "huyen" | "xa";
export type Unit = { id: string; name: string; block: UnitBlock };

const HUYEN = [
  "UBND TP. Biên Hoà",
  "UBND TP. Long Khánh",
  "UBND huyện Trảng Bom",
  "UBND huyện Long Thành",
  "UBND huyện Nhơn Trạch",
  "UBND huyện Vĩnh Cửu",
  "UBND huyện Định Quán",
  "UBND huyện Xuân Lộc",
];

const XA = [
  "UBND xã Phú Hữu",
  "UBND xã Long Tân",
  "UBND xã Đại Phước",
  "UBND xã Phước Thiền",
  "UBND xã Hiệp Phước",
  "UBND xã Bình An",
  "UBND xã An Phước",
  "UBND xã Long Phước",
  "UBND xã Bàu Hàm",
  "UBND xã Sông Trầu",
  "UBND xã Bắc Sơn",
  "UBND xã Hưng Thịnh",
  "UBND xã Trị An",
  "UBND xã Tân An",
  "UBND xã Phú Lý",
  "UBND xã Thạnh Phú",
  "UBND xã La Ngà",
  "UBND xã Phú Ngọc",
  "UBND xã Gia Canh",
  "UBND xã Phú Vinh",
  "UBND xã Xuân Bắc",
  "UBND xã Xuân Định",
  "UBND xã Xuân Thành",
  "UBND xã Xuân Hưng",
  "UBND xã Xuân Phú",
  "UBND xã Xuân Đông",
  "UBND xã Bảo Vinh",
  "UBND xã Bàu Trâm",
  "UBND xã Hàng Gòn",
  "UBND xã Xuân Tân",
  "UBND xã Bình Lộc",
  "UBND xã Suối Tre",
];

export const UNITS: Unit[] = [
  ...HUYEN.map((name, i) => ({ id: `huyen-${i + 1}`, name, block: "huyen" as const })),
  ...XA.map((name, i) => ({ id: `xa-${i + 1}`, name, block: "xa" as const })),
];

// ---------------------------------------------------------------- Biểu

/** Một chỉ tiêu. Lá có `rate` = kinh phí hỗ trợ (nghìn đồng / người / tháng). */
export type Indicator = {
  code: string;
  label: string;
  rate?: number;
  children?: Indicator[];
};

export type SheetDef = {
  key: string;
  /** Tên ngắn trên tab: "1a", "1b"… */
  short: string;
  title: string;
  tree: Indicator[];
};

export const PERIOD_SHEETS: SheetDef[] = [
  {
    key: "1a",
    short: "1a",
    title: "TỔNG HỢP KINH PHÍ HỖ TRỢ CHI PHÍ HỌC TẬP THEO NGHỊ ĐỊNH SỐ 238/2025/NĐ-CP",
    tree: [
      {
        code: "A",
        label: "Hỗ trợ chi phí học tập",
        children: [
          { code: "1", label: "Trẻ em mẫu giáo 5 tuổi", rate: 150 },
          { code: "2", label: "Học sinh tiểu học", rate: 150 },
          { code: "3", label: "Học sinh trung học cơ sở", rate: 150 },
        ],
      },
      {
        code: "B",
        label: "Miễn, giảm học phí",
        children: [
          {
            code: "I",
            label: "Miễn học phí",
            children: [
              { code: "1", label: "Học sinh mồ côi cả cha lẫn mẹ", rate: 170 },
              { code: "2", label: "Học sinh khuyết tật", rate: 150 },
              { code: "3", label: "Học sinh là con hộ nghèo, hộ cận nghèo", rate: 190 },
              { code: "4", label: "Học sinh dân tộc thiểu số ở vùng đặc biệt khó khăn", rate: 160 },
            ],
          },
          {
            code: "II",
            label: "Giảm học phí",
            children: [
              { code: "1", label: "Học sinh là con của người có công với cách mạng", rate: 50 },
              { code: "2", label: "Học sinh là con cán bộ, công chức bị tai nạn lao động", rate: 180 },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "1b",
    short: "1b",
    title: "TỔNG HỢP TRỢ CẤP XÃ HỘI HẰNG THÁNG CHO ĐỐI TƯỢNG BẢO TRỢ XÃ HỘI",
    tree: [
      {
        code: "A",
        label: "Trợ cấp xã hội hằng tháng",
        children: [
          { code: "1", label: "Trẻ em dưới 16 tuổi không có nguồn nuôi dưỡng", rate: 900 },
          { code: "2", label: "Người cao tuổi từ 80 tuổi trở lên", rate: 500 },
          { code: "3", label: "Người khuyết tật nặng", rate: 750 },
          { code: "4", label: "Người khuyết tật đặc biệt nặng", rate: 1000 },
        ],
      },
      {
        code: "B",
        label: "Hỗ trợ kinh phí chăm sóc",
        children: [
          { code: "1", label: "Hộ gia đình chăm sóc người khuyết tật", rate: 500 },
          { code: "2", label: "Người nhận chăm sóc trẻ em mồ côi", rate: 900 },
        ],
      },
    ],
  },
  {
    key: "1c",
    short: "1c",
    title: "TỔNG HỢP HỖ TRỢ MUA THẺ BẢO HIỂM Y TẾ",
    tree: [
      {
        code: "A",
        label: "Hỗ trợ mua thẻ bảo hiểm y tế",
        children: [
          { code: "1", label: "Người thuộc hộ nghèo", rate: 85 },
          { code: "2", label: "Người thuộc hộ cận nghèo", rate: 60 },
          { code: "3", label: "Người dân tộc thiểu số ở vùng khó khăn", rate: 85 },
          { code: "4", label: "Trẻ em dưới 6 tuổi", rate: 85 },
        ],
      },
    ],
  },
  {
    key: "1d",
    short: "1d",
    title: "TỔNG HỢP TRỢ GIÚP XÃ HỘI KHẨN CẤP",
    tree: [
      {
        code: "A",
        label: "Hỗ trợ lương thực",
        children: [
          { code: "1", label: "Hộ thiếu đói dịp Tết", rate: 120 },
          { code: "2", label: "Hộ thiếu đói giáp hạt", rate: 120 },
        ],
      },
      {
        code: "B",
        label: "Hỗ trợ khác",
        children: [
          { code: "1", label: "Hỗ trợ làm nhà ở", rate: 1500 },
          { code: "2", label: "Hỗ trợ chi phí mai táng", rate: 800 },
        ],
      },
    ],
  },
  {
    key: "1e",
    short: "1e",
    title: "TỔNG HỢP HỖ TRỢ TIỀN ĐIỆN CHO HỘ NGHÈO VÀ HỘ CHÍNH SÁCH XÃ HỘI",
    tree: [
      {
        code: "A",
        label: "Hỗ trợ tiền điện",
        children: [
          { code: "1", label: "Hộ nghèo", rate: 55 },
          { code: "2", label: "Hộ chính sách xã hội", rate: 55 },
        ],
      },
    ],
  },
  {
    key: "1g",
    short: "1g",
    title: "TỔNG HỢP CHÍNH SÁCH ĐỐI VỚI NGƯỜI CÓ CÔNG VỚI CÁCH MẠNG",
    tree: [
      {
        code: "A",
        label: "Trợ cấp hằng tháng",
        children: [
          { code: "1", label: "Thương binh", rate: 2100 },
          { code: "2", label: "Bệnh binh", rate: 1900 },
          { code: "3", label: "Thân nhân liệt sĩ", rate: 2000 },
        ],
      },
      {
        code: "B",
        label: "Ưu đãi khác",
        children: [
          { code: "1", label: "Điều dưỡng phục hồi sức khoẻ", rate: 300 },
          { code: "2", label: "Hỗ trợ cải thiện nhà ở", rate: 1200 },
        ],
      },
    ],
  },
  {
    key: "1h",
    short: "1h",
    title: "TỔNG HỢP HỖ TRỢ NGƯỜI LAO ĐỘNG MẤT VIỆC LÀM",
    tree: [
      {
        code: "A",
        label: "Hỗ trợ người lao động",
        children: [
          { code: "1", label: "Hỗ trợ học nghề", rate: 400 },
          { code: "2", label: "Hỗ trợ tìm việc làm", rate: 150 },
        ],
      },
    ],
  },
  {
    key: "1i",
    short: "1i",
    title: "TỔNG HỢP CHĂM SÓC NGƯỜI CAO TUỔI",
    tree: [
      {
        code: "A",
        label: "Chăm sóc người cao tuổi",
        children: [
          { code: "1", label: "Chúc thọ, mừng thọ", rate: 70 },
          { code: "2", label: "Khám sức khoẻ định kỳ", rate: 40 },
        ],
      },
    ],
  },
  {
    key: "1k",
    short: "1k",
    title: "TỔNG HỢP HỖ TRỢ TRẺ EM CÓ HOÀN CẢNH ĐẶC BIỆT",
    tree: [
      {
        code: "A",
        label: "Hỗ trợ trẻ em",
        children: [
          { code: "1", label: "Trẻ em mồ côi", rate: 600 },
          { code: "2", label: "Trẻ em khuyết tật", rate: 450 },
          { code: "3", label: "Trẻ em bị xâm hại", rate: 300 },
        ],
      },
    ],
  },
];

/** Biểu tổng hợp năm (01): theo hai nửa năm + cả năm. */
export const YEAR_SHEET: SheetDef = {
  key: "01",
  short: "01",
  title: "TỔNG HỢP KẾT QUẢ THỰC HIỆN CÁC CHÍNH SÁCH, CHẾ ĐỘ NĂM",
  tree: PERIOD_SHEETS[0].tree,
};

// ---------------------------------------------------------------- Kỳ báo cáo

export type PeriodStatus = "chua-mo" | "dang-mo" | "qua-han" | "da-chot";

export const PERIOD_STATUS: Record<PeriodStatus, { label: string; tone: StatusTone }> = {
  "chua-mo": { label: "Chưa mở", tone: "outline" },
  "dang-mo": { label: "Đang mở", tone: "info" },
  "qua-han": { label: "Quá hạn", tone: "overdue" },
  "da-chot": { label: "Đã chốt", tone: "locked" },
};

/** Một ô Sở đã sửa: cộng `delta` vào số tổng hợp toàn tỉnh của chỉ tiêu lá. */
export type CellPatch = {
  sheet: string;
  /** Mã dòng lá, nối bằng dấu chấm: "B.I.2". */
  leaf: string;
  col: "people" | "money";
  delta: number;
};

/** Một lần lưu số liệu tổng hợp của kỳ. */
export type SavedVersion = {
  no: number;
  savedAt: string;
  savedBy: string;
  note: string;
  /** Nhãn chip thay cho "N ô đổi" (vd. lần lưu đầu: "Tất cả biểu"). */
  tag?: string;
  /** Các ô đổi so với lần lưu trước. */
  patches: CellPatch[];
};

export type SummaryPeriod = {
  id: string;
  name: string;
  range: string;
  kind: PeriodKind;
  /** Số tháng của kỳ — dùng để tính kinh phí mẫu. */
  months: number;
  status: PeriodStatus;
  /** Số đơn vị đã được duyệt / số đơn vị có phiếu / số phiếu đang chờ duyệt. */
  approved: number;
  total: number;
  pending: number;
  /** Lần duyệt phiếu gần nhất. */
  updatedAt: string;
  versions: SavedVersion[];
  /** Đang sửa số: danh sách biểu đã lưu nháp (null = không sửa). */
  draft: string[] | null;
};

const THU = "Nguyễn Thị Thu";
const HAI = "Trần Văn Hải";

export const CURRENT_USER = THU;

const FIRST_SAVE = "Lưu lần đầu từ các phiếu đã duyệt";

function firstSave(savedAt: string, savedBy = THU): SavedVersion {
  return { no: 1, savedAt, savedBy, note: FIRST_SAVE, tag: "Tất cả biểu", patches: [] };
}

export const PERIODS_2026: SummaryPeriod[] = [
  {
    id: "2026-t12", name: "Tháng 12/2026", range: "01/12 – 31/12/2026", kind: "thang", months: 1,
    status: "chua-mo", approved: 0, total: 40, pending: 0, updatedAt: "2026-10-01T08:00", versions: [], draft: null,
  },
  {
    id: "2026-t11", name: "Tháng 11/2026", range: "01/11 – 30/11/2026", kind: "thang", months: 1,
    status: "chua-mo", approved: 0, total: 40, pending: 0, updatedAt: "2026-10-01T08:00", versions: [], draft: null,
  },
  {
    id: "2026-t10", name: "Tháng 10/2026", range: "01/10 – 31/10/2026", kind: "thang", months: 1,
    status: "dang-mo", approved: 0, total: 40, pending: 0, updatedAt: "2026-10-01T08:00", versions: [], draft: null,
  },
  {
    id: "2026-q4", name: "Quý IV/2026", range: "01/10 – 31/12/2026", kind: "quy", months: 3,
    status: "dang-mo", approved: 38, total: 40, pending: 2, updatedAt: "2026-10-15T16:40", versions: [], draft: null,
  },
  {
    id: "2026-t9", name: "Tháng 9/2026", range: "01/09 – 30/09/2026", kind: "thang", months: 1,
    status: "qua-han", approved: 35, total: 40, pending: 1, updatedAt: "2026-10-12T10:20", versions: [], draft: null,
  },
  {
    id: "2026-q3", name: "Quý III/2026", range: "01/07 – 30/09/2026", kind: "quy", months: 3,
    status: "da-chot", approved: 40, total: 40, pending: 0, updatedAt: "2026-10-06T09:15", versions: [], draft: null,
  },
  {
    id: "2026-t8", name: "Tháng 8/2026", range: "01/08 – 31/08/2026", kind: "thang", months: 1,
    status: "da-chot", approved: 40, total: 40, pending: 0, updatedAt: "2026-09-08T15:30",
    versions: [firstSave("2026-09-10T08:30")], draft: null,
  },
  {
    id: "2026-t7", name: "Tháng 7/2026", range: "01/07 – 31/07/2026", kind: "thang", months: 1,
    status: "da-chot", approved: 40, total: 40, pending: 0, updatedAt: "2026-08-07T11:05",
    versions: [firstSave("2026-08-10T09:00", HAI)], draft: null,
  },
  {
    id: "2026-h1", name: "6 tháng đầu năm 2026", range: "01/01 – 30/06/2026", kind: "6thang", months: 6,
    status: "da-chot", approved: 40, total: 40, pending: 0, updatedAt: "2026-07-10T14:00",
    versions: [firstSave("2026-07-15T10:00")], draft: null,
  },
  {
    id: "2026-q2", name: "Quý II/2026", range: "01/04 – 30/06/2026", kind: "quy", months: 3,
    status: "da-chot", approved: 40, total: 40, pending: 0, updatedAt: "2026-07-06T09:40",
    versions: [
      firstSave("2026-09-25T16:05"),
      {
        no: 2, savedAt: "2026-10-02T09:45", savedBy: HAI, note: "Cập nhật lại số liệu biểu 1b",
        patches: [
          { sheet: "1b", leaf: "A.1", col: "money", delta: 4830 },
          { sheet: "1b", leaf: "A.2", col: "money", delta: -6750 },
          { sheet: "1b", leaf: "A.3", col: "money", delta: 12550 },
          { sheet: "1b", leaf: "A.3", col: "people", delta: 12 },
          { sheet: "1b", leaf: "A.4", col: "money", delta: 61500 },
          { sheet: "1b", leaf: "B.1", col: "money", delta: -34400 },
          { sheet: "1b", leaf: "B.2", col: "money", delta: 2100 },
        ],
      },
      {
        no: 3, savedAt: "2026-10-08T14:20", savedBy: THU, note: "Sở sửa số liệu biểu 1a",
        patches: [
          { sheet: "1a", leaf: "A.1", col: "money", delta: 4830 },
          { sheet: "1a", leaf: "A.2", col: "people", delta: 15 },
          { sheet: "1a", leaf: "A.3", col: "money", delta: -6750 },
          { sheet: "1a", leaf: "B.I.2", col: "money", delta: 61500 },
          { sheet: "1a", leaf: "B.II.1", col: "money", delta: -1500 },
          { sheet: "1b", leaf: "A.1", col: "money", delta: 1200 },
          { sheet: "1b", leaf: "A.2", col: "money", delta: -900 },
          { sheet: "1b", leaf: "A.3", col: "people", delta: -4 },
          { sheet: "1b", leaf: "A.4", col: "money", delta: 5000 },
          { sheet: "1b", leaf: "B.1", col: "money", delta: -34400 },
          { sheet: "1b", leaf: "B.1", col: "people", delta: 2 },
          { sheet: "1b", leaf: "B.2", col: "money", delta: 12550 },
        ],
      },
    ],
    draft: null,
  },
  {
    id: "2026-t6", name: "Tháng 6/2026", range: "01/06 – 30/06/2026", kind: "thang", months: 1,
    status: "da-chot", approved: 40, total: 40, pending: 0, updatedAt: "2026-07-05T08:50",
    versions: [firstSave("2026-07-08T09:10")], draft: null,
  },
  {
    id: "2026-t5", name: "Tháng 5/2026", range: "01/05 – 31/05/2026", kind: "thang", months: 1,
    status: "da-chot", approved: 40, total: 40, pending: 0, updatedAt: "2026-06-06T10:15",
    versions: [firstSave("2026-06-09T14:00", HAI)], draft: null,
  },
  {
    id: "2026-t4", name: "Tháng 4/2026", range: "01/04 – 30/04/2026", kind: "thang", months: 1,
    status: "da-chot", approved: 40, total: 40, pending: 0, updatedAt: "2026-05-07T09:30",
    versions: [firstSave("2026-05-11T15:20")],
    // Sở đang sửa dở biểu 1a, 1b — chặn nộp báo cáo năm cho tới khi hoàn tất.
    draft: ["1a", "1b"],
  },
  {
    id: "2026-q1", name: "Quý I/2026", range: "01/01 – 31/03/2026", kind: "quy", months: 3,
    status: "da-chot", approved: 40, total: 40, pending: 0, updatedAt: "2026-04-08T16:00",
    versions: [
      firstSave("2026-04-10T10:30"),
      { no: 2, savedAt: "2026-04-20T08:45", savedBy: THU, note: "Lưu lại, không sửa số liệu", patches: [] },
    ],
    draft: ["1a"],
  },
];

// ---------------------------------------------------------------- Báo cáo năm

export type SubmissionStatus = "cho-duyet" | "da-duyet" | "tra-lai";
export type YearStatus = "dang-soan" | SubmissionStatus;

export const YEAR_STATUS: Record<YearStatus, { label: string; tone: StatusTone }> = {
  "dang-soan": { label: "Đang soạn", tone: "neutral" },
  "cho-duyet": { label: "Chờ UBND duyệt", tone: "warning" },
  "da-duyet": { label: "UBND đã duyệt", tone: "success" },
  "tra-lai": { label: "UBND trả lại", tone: "destructive" },
};

export type AttachedFile = { name: string; sizeKb: number };

/** Một lần Sở nộp báo cáo năm lên UBND ("Phiếu n"). */
export type YearSubmission = {
  /** Trùng mã phiếu ở màn Duyệt báo cáo năm: `nam-2026-phieu-2`. */
  id: string;
  revisionNo: number;
  docNo: string;
  docDate: string;
  submittedAt: string;
  submittedBy: string;
  files: AttachedFile[];
  /** Phiên bản số liệu tổng hợp được ghim khi nộp. */
  versionNo: number;
  status: SubmissionStatus;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
  /** UBND mở lại sau khi đã duyệt (trạng thái vẫn là trả lại). */
  reopened?: boolean;
};

export type YearReport = {
  year: number;
  /** Phiên bản số liệu tổng hợp mới nhất của năm. */
  versionNo: number;
  updatedAt: string;
  /** Năm đã qua: số kỳ đã lưu / số kỳ đã chốt (năm hiện tại tính từ danh sách kỳ). */
  savedPeriods: number;
  closedPeriods: number;
  submissions: YearSubmission[];
};

const MINH = "Lê Quang Minh";

export const YEAR_REPORTS: YearReport[] = [
  {
    year: 2026, versionNo: 4, updatedAt: "2026-10-08T14:20", savedPeriods: 0, closedPeriods: 0,
    submissions: [
      {
        id: "nam-2026-phieu-1", revisionNo: 1, docNo: "12/TTr-STC", docDate: "2027-01-06",
        submittedAt: "2027-01-06T14:10", submittedBy: THU,
        files: [{ name: "Tờ trình 12-TTr-STC.pdf", sizeKb: 842 }], versionNo: 3,
        status: "tra-lai", decidedAt: "2027-01-12T16:05", decidedBy: MINH,
        reason: "Thiếu số liệu biểu 1b của Quý I/2026",
      },
    ],
  },
  {
    year: 2025, versionNo: 3, updatedAt: "2026-01-06T09:30", savedPeriods: 16, closedPeriods: 16,
    submissions: [
      {
        id: "nam-2025-phieu-1", revisionNo: 1, docNo: "09/TTr-STC", docDate: "2026-01-08",
        submittedAt: "2026-01-08T10:05", submittedBy: THU,
        files: [{ name: "Tờ trình 09-TTr-STC.pdf", sizeKb: 765 }], versionNo: 3,
        status: "da-duyet", decidedAt: "2026-01-14T15:30", decidedBy: MINH,
      },
    ],
  },
  {
    year: 2024, versionNo: 5, updatedAt: "2025-01-18T16:00", savedPeriods: 16, closedPeriods: 16,
    submissions: [
      {
        id: "nam-2024-phieu-1", revisionNo: 1, docNo: "08/TTr-STC", docDate: "2025-01-10",
        submittedAt: "2025-01-10T08:45", submittedBy: HAI,
        files: [{ name: "Tờ trình 08-TTr-STC.pdf", sizeKb: 690 }], versionNo: 4,
        status: "tra-lai", decidedAt: "2025-01-15T10:20", decidedBy: MINH,
        reason: "Số kinh phí biểu 1c chưa khớp với quyết toán",
      },
      {
        id: "nam-2024-phieu-2", revisionNo: 2, docNo: "14/TTr-STC", docDate: "2025-01-20",
        submittedAt: "2025-01-20T14:30", submittedBy: HAI,
        files: [{ name: "Tờ trình 14-TTr-STC.pdf", sizeKb: 712 }], versionNo: 5,
        status: "da-duyet", decidedAt: "2025-01-24T09:00", decidedBy: MINH,
      },
    ],
  },
  {
    year: 2023, versionNo: 4, updatedAt: "2024-01-16T10:00", savedPeriods: 16, closedPeriods: 16,
    submissions: [
      {
        id: "nam-2023-phieu-1", revisionNo: 1, docNo: "05/TTr-STC", docDate: "2024-01-09",
        submittedAt: "2024-01-09T15:00", submittedBy: THU,
        files: [{ name: "Tờ trình 05-TTr-STC.pdf", sizeKb: 655 }], versionNo: 3,
        status: "tra-lai", decidedAt: "2024-01-12T08:30", decidedBy: MINH,
        reason: "Thiếu số người cao tuổi ở biểu 1i",
      },
      {
        id: "nam-2023-phieu-2", revisionNo: 2, docNo: "11/TTr-STC", docDate: "2024-01-18",
        submittedAt: "2024-01-18T08:45", submittedBy: THU,
        files: [{ name: "Tờ trình 11-TTr-STC.pdf", sizeKb: 698 }], versionNo: 4,
        status: "da-duyet", decidedAt: "2024-01-23T14:10", decidedBy: MINH,
      },
    ],
  },
  {
    year: 2022, versionNo: 2, updatedAt: "2023-01-10T09:00", savedPeriods: 16, closedPeriods: 16,
    submissions: [
      {
        id: "nam-2022-phieu-1", revisionNo: 1, docNo: "07/TTr-STC", docDate: "2023-01-12",
        submittedAt: "2023-01-12T09:30", submittedBy: HAI,
        files: [{ name: "Tờ trình 07-TTr-STC.pdf", sizeKb: 604 }], versionNo: 2,
        status: "da-duyet", decidedAt: "2023-01-17T16:45", decidedBy: MINH,
      },
    ],
  },
];
