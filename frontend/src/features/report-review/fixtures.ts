// Dữ liệu mẫu — thay bằng API khi backend có.
//
// Mười phiếu Quý IV/2026 của các đơn vị Đồng Nai, đủ bốn trạng thái màn Duyệt
// phiếu nhập hiện (Chờ duyệt, Đã trả lại, Đã phê duyệt, Chưa nộp), thêm hai
// phiếu Quý III/2026 đã duyệt của kỳ đã chốt. Số liệu từng biểu được dựng từ
// bảng chỉ tiêu bên dưới và cộng trong `buildSheet`, nên dòng "Tổng cộng" và
// cột "Cộng dồn" luôn khớp.

export type ReviewStatus = "pending" | "returned" | "approved" | "notSubmitted";

/** Một lần nộp trước đó của phiếu, đã bị Sở trả lại. */
export type PreviousVersion = {
  no: number;
  submittedAt: string;
  returnedAt: string;
  reason: string;
};

export type TreasuryFile = {
  key: string;
  name: string;
  title: string;
  confirmedAt: string;
};

export type ReviewPeriod = {
  key: string;
  name: string;
  /** "01/10–31/12/2026" */
  range: string;
  year: number;
  deadline: string;
  /** Kỳ đã chốt số liệu: phiếu chỉ còn xem. */
  closed: boolean;
};

export type ReviewReport = {
  id: string;
  orgName: string;
  orgBlock: "Khối huyện" | "Khối xã";
  district: string;
  /** Hệ số nhân số liệu mẫu của đơn vị (1 = đúng số trên Figma). */
  scale: number;
  templateSet: string;
  period: ReviewPeriod;
  status: ReviewStatus;
  /** Số biểu đơn vị đã nhập xong (theo thứ tự SHEET_DEFS). */
  doneSheets: number;
  submittedAt?: string;
  approvedAt?: string;
  approver?: string;
  returnedAt?: string;
  returnReason?: string;
  previousVersions: PreviousVersion[];
  treasuryFiles: TreasuryFile[];
  /** Giả lập: lần phê duyệt đầu tiên báo lỗi "Không phê duyệt được". */
  failApproveOnce?: boolean;
};

/** Mốc "hôm nay" của dữ liệu mẫu, để "còn N ngày" và giờ thao tác khớp câu chuyện. */
export const MOCK_TODAY = "2027-01-09T09:00";

/** Người đang đăng nhập (chuyên viên Sở) trong dữ liệu mẫu. */
export const CURRENT_REVIEWER = "Nguyễn Thị Thu";

const Q4_2026: ReviewPeriod = {
  key: "2026-q4",
  name: "Quý IV/2026",
  range: "01/10–31/12/2026",
  year: 2026,
  deadline: "2027-01-15",
  closed: false,
};

const Q3_2026: ReviewPeriod = {
  key: "2026-q3",
  name: "Quý III/2026",
  range: "01/07–30/09/2026",
  year: 2026,
  deadline: "2026-10-15",
  closed: true,
};

const SET_HUYEN = "Bộ biểu khối huyện 2026";
const SET_XA = "Bộ biểu khối xã 2026";

function treasury(confirmedAt: string): TreasuryFile[] {
  return [
    {
      key: "giay-xac-nhan",
      name: "Giấy xác nhận chi trả.pdf",
      title: "GIẤY XÁC NHẬN CHI TRẢ",
      confirmedAt,
    },
    {
      key: "bang-ke",
      name: "Bảng kê chi tiết chi trả.pdf",
      title: "BẢNG KÊ CHI TIẾT CHI TRẢ",
      confirmedAt,
    },
  ];
}

export const INITIAL_REPORTS: ReviewReport[] = [
  {
    id: "q4-2026-huyen-long-thanh",
    orgName: "UBND huyện Long Thành",
    orgBlock: "Khối huyện",
    district: "Huyện Long Thành",
    scale: 3.2,
    templateSet: SET_HUYEN,
    period: Q4_2026,
    status: "approved",
    doneSheets: 10,
    submittedAt: "2027-01-03T15:20",
    approvedAt: "2027-01-08T10:15",
    approver: "Nguyễn Thị Thu",
    previousVersions: [],
    treasuryFiles: treasury("2027-01-02"),
  },
  {
    id: "q4-2026-huyen-nhon-trach",
    orgName: "UBND huyện Nhơn Trạch",
    orgBlock: "Khối huyện",
    district: "Huyện Nhơn Trạch",
    scale: 2.8,
    templateSet: SET_HUYEN,
    period: Q4_2026,
    status: "pending",
    doneSheets: 10,
    submittedAt: "2027-01-06T14:10",
    previousVersions: [],
    treasuryFiles: treasury("2027-01-05"),
  },
  {
    id: "q4-2026-huyen-trang-bom",
    orgName: "UBND huyện Trảng Bom",
    orgBlock: "Khối huyện",
    district: "Huyện Trảng Bom",
    scale: 3.5,
    templateSet: SET_HUYEN,
    period: Q4_2026,
    status: "pending",
    doneSheets: 10,
    submittedAt: "2027-01-05T09:32",
    previousVersions: [],
    treasuryFiles: treasury("2027-01-04"),
    failApproveOnce: true,
  },
  {
    id: "q4-2026-tp-bien-hoa",
    orgName: "UBND TP. Biên Hoà",
    orgBlock: "Khối huyện",
    district: "Thành phố Biên Hoà",
    scale: 5.4,
    templateSet: SET_HUYEN,
    period: Q4_2026,
    status: "pending",
    doneSheets: 10,
    submittedAt: "2027-01-06T10:48",
    previousVersions: [],
    treasuryFiles: treasury("2027-01-05"),
  },
  {
    id: "q4-2026-xa-bau-can",
    orgName: "UBND xã Bàu Cạn",
    orgBlock: "Khối xã",
    district: "Huyện Long Thành",
    scale: 0.7,
    templateSet: SET_XA,
    period: Q4_2026,
    status: "notSubmitted",
    doneSheets: 0,
    previousVersions: [],
    treasuryFiles: [],
  },
  {
    id: "q4-2026-xa-bau-ham",
    orgName: "UBND xã Bàu Hàm",
    orgBlock: "Khối xã",
    district: "Huyện Trảng Bom",
    scale: 0.9,
    templateSet: SET_XA,
    period: Q4_2026,
    status: "returned",
    doneSheets: 10,
    submittedAt: "2027-01-04T10:05",
    returnedAt: "2027-01-07T16:20",
    returnReason: "Thiếu số liệu biểu 1b",
    previousVersions: [],
    treasuryFiles: treasury("2027-01-03"),
  },
  {
    id: "q4-2026-xa-ho-nai-3",
    orgName: "UBND xã Hố Nai 3",
    orgBlock: "Khối xã",
    district: "Huyện Trảng Bom",
    scale: 1.1,
    templateSet: SET_XA,
    period: Q4_2026,
    status: "notSubmitted",
    doneSheets: 6,
    previousVersions: [],
    treasuryFiles: [],
  },
  {
    id: "q4-2026-xa-phu-huu",
    orgName: "UBND xã Phú Hữu",
    orgBlock: "Khối xã",
    district: "Huyện Nhơn Trạch",
    scale: 1,
    templateSet: SET_XA,
    period: Q4_2026,
    status: "pending",
    doneSheets: 10,
    submittedAt: "2027-01-06T14:10",
    previousVersions: [
      {
        no: 1,
        submittedAt: "2026-12-30T10:30",
        returnedAt: "2027-01-03T08:50",
        reason: "Thiếu số liệu biểu 1b",
      },
    ],
    treasuryFiles: treasury("2027-01-05"),
  },
  {
    id: "q4-2026-xa-an-phuoc",
    orgName: "UBND xã An Phước",
    orgBlock: "Khối xã",
    district: "Huyện Long Thành",
    scale: 0.8,
    templateSet: SET_XA,
    period: Q4_2026,
    status: "approved",
    doneSheets: 10,
    submittedAt: "2027-01-02T09:40",
    approvedAt: "2027-01-07T15:05",
    approver: "Trần Văn Bình",
    previousVersions: [],
    treasuryFiles: treasury("2026-12-31"),
  },
  {
    id: "q4-2026-xa-phuoc-thien",
    orgName: "UBND xã Phước Thiền",
    orgBlock: "Khối xã",
    district: "Huyện Nhơn Trạch",
    scale: 1.2,
    templateSet: SET_XA,
    period: Q4_2026,
    status: "pending",
    doneSheets: 10,
    submittedAt: "2027-01-08T08:30",
    previousVersions: [],
    treasuryFiles: treasury("2027-01-07"),
  },
  {
    id: "q3-2026-xa-long-phuoc",
    orgName: "UBND xã Long Phước",
    orgBlock: "Khối xã",
    district: "Huyện Long Thành",
    scale: 1,
    templateSet: SET_XA,
    period: Q3_2026,
    status: "approved",
    doneSheets: 10,
    submittedAt: "2026-10-05T08:50",
    approvedAt: "2026-10-08T09:30",
    approver: "Nguyễn Thị Thu",
    previousVersions: [],
    treasuryFiles: treasury("2026-10-03"),
  },
  {
    id: "q3-2026-xa-phu-huu",
    orgName: "UBND xã Phú Hữu",
    orgBlock: "Khối xã",
    district: "Huyện Nhơn Trạch",
    scale: 0.9,
    templateSet: SET_XA,
    period: Q3_2026,
    status: "approved",
    doneSheets: 10,
    submittedAt: "2026-10-06T11:02",
    approvedAt: "2026-10-09T14:00",
    approver: "Nguyễn Thị Thu",
    previousVersions: [],
    treasuryFiles: treasury("2026-10-04"),
  },
];

/** Một biểu trong bộ biểu: tên ngắn (tab), tên đầy đủ, chỉ tiêu [tên, số kỳ trước, số kỳ này] (nghìn đồng). */
export type SheetDef = {
  code: string;
  title: string;
  items: [name: string, previous: number, current: number][];
};

export const SHEET_DEFS: SheetDef[] = [
  {
    code: "1a",
    title: "TỔNG HỢP KINH PHÍ THỰC HIỆN CHÍNH SÁCH AN SINH XÃ HỘI",
    items: [
      ["Kinh phí trợ giúp xã hội", 2_114_600, 721_100],
      ["Kinh phí ưu đãi người có công", 1_356_000, 452_000],
      ["Kinh phí hỗ trợ bảo hiểm y tế", 864_300, 288_100],
      ["Kinh phí hỗ trợ giáo dục", 412_500, 137_500],
      ["Kinh phí hỗ trợ nhà ở", 240_000, 80_000],
    ],
  },
  {
    code: "1b",
    title: "KẾT QUẢ CHI TRẢ CÁC CHẾ ĐỘ AN SINH XÃ HỘI",
    items: [
      ["Trợ cấp xã hội hằng tháng", 1_284_500, 436_200],
      ["Hỗ trợ người cao tuổi từ 80 tuổi trở lên", 312_000, 108_000],
      ["Hỗ trợ người khuyết tật nặng", 245_600, 83_400],
      ["Hỗ trợ hộ nghèo, hộ cận nghèo", 190_300, 61_700],
      ["Hỗ trợ chi phí mai táng", 24_000, 12_000],
      ["Hỗ trợ khác theo quy định của tỉnh", 58_200, 19_800],
    ],
  },
  {
    code: "1c",
    title: "CHI TRỢ CẤP ƯU ĐÃI NGƯỜI CÓ CÔNG VỚI CÁCH MẠNG",
    items: [
      ["Trợ cấp hằng tháng thương binh, bệnh binh", 642_000, 214_000],
      ["Trợ cấp thân nhân liệt sĩ", 398_400, 132_800],
      ["Trợ cấp người hoạt động kháng chiến", 215_100, 71_700],
      ["Trợ cấp một lần", 100_500, 33_500],
    ],
  },
  {
    code: "1d",
    title: "CHI HỖ TRỢ MUA THẺ BẢO HIỂM Y TẾ",
    items: [
      ["Người thuộc hộ nghèo", 412_800, 137_600],
      ["Người thuộc hộ cận nghèo", 236_100, 78_700],
      ["Trẻ em dưới 6 tuổi", 158_400, 52_800],
      ["Người cao tuổi từ 80 tuổi trở lên", 57_000, 19_000],
    ],
  },
  {
    code: "1e",
    title: "CHI HỖ TRỢ GIÁO DỤC",
    items: [
      ["Miễn, giảm học phí", 186_000, 62_000],
      ["Hỗ trợ chi phí học tập", 142_500, 47_500],
      ["Hỗ trợ tiền ăn trưa cho trẻ mẫu giáo", 84_000, 28_000],
    ],
  },
  {
    code: "1g",
    title: "CHI HỖ TRỢ NHÀ Ở",
    items: [
      ["Hỗ trợ xây mới nhà ở", 160_000, 50_000],
      ["Hỗ trợ sửa chữa nhà ở", 80_000, 30_000],
    ],
  },
  {
    code: "1h",
    title: "CHI HỖ TRỢ ĐỘT XUẤT",
    items: [
      ["Hỗ trợ lương thực", 36_600, 12_200],
      ["Hỗ trợ người bị thương nặng", 18_000, 6_000],
      ["Hỗ trợ khắc phục nhà ở bị hư hỏng", 45_000, 15_000],
    ],
  },
  {
    code: "1i",
    title: "CHI HỖ TRỢ GIẢI QUYẾT VIỆC LÀM",
    items: [
      ["Hỗ trợ đào tạo nghề", 96_000, 32_000],
      ["Hỗ trợ đi làm việc ở nước ngoài", 27_000, 9_000],
      ["Hỗ trợ vay vốn tạo việc làm", 210_000, 70_000],
    ],
  },
  {
    code: "1k",
    title: "CHI CHĂM SÓC, BẢO VỆ TRẺ EM",
    items: [
      ["Trẻ em có hoàn cảnh đặc biệt", 54_000, 18_000],
      ["Trẻ em mồ côi cả cha và mẹ", 31_500, 10_500],
      ["Hỗ trợ khám, chữa bệnh cho trẻ em", 22_500, 7_500],
    ],
  },
  {
    code: "1l",
    title: "CHI THỰC HIỆN CÁC CHÍNH SÁCH AN SINH XÃ HỘI KHÁC",
    items: [
      ["Hỗ trợ nạn nhân bạo lực gia đình", 12_000, 4_000],
      ["Hỗ trợ người cai nghiện ma tuý", 27_600, 9_200],
      ["Chi khác theo quy định", 15_900, 5_300],
    ],
  },
];
