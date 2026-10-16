// Dữ liệu mẫu — thay bằng API khi backend có.
import type {
  InputReport,
  ReportSheet,
  SheetLine,
  SheetState,
} from "./model";

/**
 * 7 phiếu của UBND xã Phú Hữu (Đồng Nai), năm 2026, đủ 6 trạng thái hiển thị:
 * Đang nhập liệu · Bị trả lại · Chờ duyệt · Quá hạn · Đã chốt · Đã phê duyệt.
 * Mọi biểu có cột E = C + D và dòng Tổng cộng tự cộng (xem `sheet-data.ts`),
 * nên số trên bảng luôn khớp nhau.
 */

const ORG = "UBND xã Phú Hữu";
const TEMPLATE_SET = "Bộ biểu an sinh xã hội cấp xã";
const VERSION_1 = "Phiên bản 1 (áp dụng từ 01/01/2026)";
const VERSION_2 = "Phiên bản 2 (áp dụng từ 01/07/2026)";

export const TEMPLATE_SETS = [TEMPLATE_SET];
export const TEMPLATE_VERSIONS = [VERSION_1, VERSION_2];

const MONEY: [string, string, string] = ["Số kỳ trước", "Số kỳ này", "Cộng dồn"];

type SheetDef = Omit<ReportSheet, "state">;

/** Mười biểu của phiếu, theo thứ tự tab. */
const SHEET_CATALOG: SheetDef[] = [
  {
    code: "1a",
    title: "SỐ ĐỐI TƯỢNG HƯỞNG CHÍNH SÁCH AN SINH XÃ HỘI",
    unit: "người",
    headers: ["Đầu kỳ", "Tăng trong kỳ", "Cuối kỳ"],
    lines: [
      { label: "Người cao tuổi hưởng trợ cấp hằng tháng", previous: 412, current: 9 },
      { label: "Người khuyết tật nặng, đặc biệt nặng", previous: 156, current: 4 },
      { label: "Trẻ em mồ côi, có hoàn cảnh đặc biệt", previous: 23, current: 1 },
      { label: "Thành viên hộ nghèo, hộ cận nghèo được hỗ trợ", previous: 87, current: 3 },
    ],
  },
  {
    code: "1b",
    title: "KẾT QUẢ CHI TRẢ CÁC CHẾ ĐỘ AN SINH XÃ HỘI",
    unit: "nghìn đồng",
    headers: MONEY,
    lines: [
      { label: "Trợ cấp xã hội hằng tháng", previous: 1_284_500, current: 436_200 },
      { label: "Hỗ trợ người cao tuổi từ 80 tuổi trở lên", previous: 312_000, current: 108_000 },
      { label: "Hỗ trợ người khuyết tật nặng", previous: 245_600, current: 83_400 },
      { label: "Hỗ trợ hộ nghèo, hộ cận nghèo", previous: 190_300, current: 61_700 },
      { label: "Hỗ trợ chi phí mai táng", previous: 24_000, current: 12_000 },
      { label: "Hỗ trợ khác theo quy định của tỉnh", previous: 58_200, current: 19_800 },
    ],
  },
  {
    code: "1c",
    title: "KINH PHÍ MUA THẺ BẢO HIỂM Y TẾ",
    unit: "nghìn đồng",
    headers: MONEY,
    lines: [
      { label: "Người cao tuổi", previous: 182_400, current: 45_600 },
      { label: "Người khuyết tật", previous: 96_000, current: 24_000 },
      { label: "Trẻ em dưới 6 tuổi", previous: 210_300, current: 52_500 },
    ],
  },
  {
    code: "1d",
    title: "CHI TRẢ TRỢ CẤP NGƯỜI CÓ CÔNG",
    unit: "nghìn đồng",
    headers: MONEY,
    lines: [
      { label: "Trợ cấp thương binh", previous: 324_000, current: 81_000 },
      { label: "Trợ cấp thân nhân liệt sĩ", previous: 198_600, current: 49_650 },
      { label: "Trợ cấp người hoạt động kháng chiến", previous: 142_800, current: 35_700 },
    ],
  },
  {
    code: "1e",
    title: "HỖ TRỢ KHẨN CẤP",
    unit: "nghìn đồng",
    headers: MONEY,
    lines: [
      { label: "Hỗ trợ lương thực", previous: 18_000, current: 6_000 },
      { label: "Hỗ trợ sửa nhà do thiên tai", previous: 40_000, current: 20_000 },
      { label: "Hỗ trợ người bị thương nặng", previous: 6_000, current: 2_000 },
    ],
  },
  {
    code: "1g",
    title: "HỖ TRỢ CHI PHÍ HỌC TẬP",
    unit: "nghìn đồng",
    headers: MONEY,
    lines: [
      { label: "Học sinh thuộc hộ nghèo", previous: 36_500, current: 12_300 },
      { label: "Học sinh khuyết tật", previous: 8_400, current: 2_800 },
    ],
  },
  {
    code: "2a",
    title: "KINH PHÍ ĐƯỢC GIAO",
    unit: "nghìn đồng",
    headers: ["Dự toán đầu năm", "Bổ sung trong kỳ", "Tổng kinh phí"],
    lines: [
      { label: "Kinh phí trợ cấp xã hội", previous: 3_200_000, current: 400_000 },
      { label: "Kinh phí người có công", previous: 1_500_000, current: 0 },
    ],
  },
  {
    code: "2b",
    title: "CHI TRẢ QUA BƯU ĐIỆN",
    unit: "nghìn đồng",
    headers: MONEY,
    lines: [
      { label: "Số tiền chi trả qua bưu điện", previous: 1_612_300, current: 540_100 },
      { label: "Phí chi trả", previous: 16_100, current: 5_400 },
    ],
  },
  {
    code: "2c",
    title: "KINH PHÍ QUẢN LÝ",
    unit: "nghìn đồng",
    headers: MONEY,
    lines: [
      { label: "Văn phòng phẩm, in ấn", previous: 12_400, current: 3_600 },
      { label: "Công tác phí", previous: 8_200, current: 2_400 },
    ],
  },
  {
    code: "2d",
    title: "KINH PHÍ CÒN LẠI CHUYỂN KỲ SAU",
    unit: "nghìn đồng",
    headers: MONEY,
    lines: [
      { label: "Trợ cấp xã hội", previous: 420_000, current: 85_300 },
      { label: "Người có công", previous: 210_000, current: 40_200 },
    ],
  },
];

/**
 * Dựng 10 biểu cho một phiếu.
 * @param done   mã biểu đã nhập xong
 * @param noData mã biểu khai không phát sinh số liệu
 * @param blanks ô "Số kỳ này" còn trống: mã biểu → chỉ số dòng số liệu (từ 0)
 */
function makeSheets(
  done: string[] | "all",
  noData: string[] = [],
  blanks: Record<string, number[]> = {}
): ReportSheet[] {
  return SHEET_CATALOG.map((def) => {
    const state: SheetState = noData.includes(def.code)
      ? "no_data"
      : done === "all" || done.includes(def.code)
        ? "completed"
        : "in_progress";
    const empty = blanks[def.code] ?? [];
    const lines: SheetLine[] = def.lines.map((l, i) =>
      empty.includes(i) ? { ...l, current: null } : { ...l }
    );
    return { ...def, lines, state };
  });
}

function rev1(tone: InputReport["history"][number]["tone"], statusLabel: string, meta: string) {
  return [{ no: 1, tone, statusLabel, meta }];
}

export const INPUT_REPORTS: InputReport[] = [
  {
    id: "phu-huu-2026-q4",
    periodName: "Quý IV/2026",
    periodFrom: "2026-10-01",
    periodTo: "2026-12-31",
    dueDate: "2027-01-15",
    periodState: "open",
    orgName: ORG,
    templateSet: TEMPLATE_SET,
    templateVersion: VERSION_2,
    revision: 1,
    status: "draft",
    updatedAt: "2027-01-11T18:40:00",
    // 6/10 biểu xong; biểu 1e còn trống một ô để thử "Kiểm tra & hoàn tất" báo lỗi.
    sheets: makeSheets(["1a", "1c", "1d", "2a", "2b", "2c"], [], { "1e": [1] }),
    attachments: [],
    treasuryConfirmed: false,
    history: rev1("info", "Đang nhập liệu", "Mở ngày 02/01/2027 08:00 · cập nhật 11/01/2027 18:40"),
  },
  {
    id: "phu-huu-2026-t12",
    periodName: "Tháng 12/2026",
    periodFrom: "2026-12-01",
    periodTo: "2026-12-31",
    dueDate: "2027-01-20",
    periodState: "open",
    orgName: ORG,
    templateSet: TEMPLATE_SET,
    templateVersion: VERSION_2,
    revision: 2,
    status: "returned",
    updatedAt: "2027-01-06T09:12:00",
    returnedAt: "2027-01-06T09:12:00",
    returnReason: "thiếu số liệu biểu 1b",
    sheets: makeSheets(["1a", "1c", "1d", "1e", "1g", "2a", "2b", "2c", "2d"]),
    attachments: [],
    treasuryConfirmed: false,
    history: [
      {
        no: 2,
        tone: "destructive",
        statusLabel: "Bị trả lại",
        meta: "Mở lại ngày 06/01/2027 09:12 để sửa theo ý kiến của Sở · chưa nộp lại",
        reason: "thiếu số liệu biểu 1b",
      },
      {
        no: 1,
        tone: "destructive",
        statusLabel: "Đã trả lại",
        meta: "Nộp ngày 04/01/2027 10:30 · Sở trả lại ngày 06/01/2027 09:12",
        reason: "thiếu số liệu biểu 1b",
      },
    ],
  },
  {
    id: "phu-huu-2026-t11",
    periodName: "Tháng 11/2026",
    periodFrom: "2026-11-01",
    periodTo: "2026-11-30",
    dueDate: "2026-12-15",
    periodState: "open",
    orgName: ORG,
    templateSet: TEMPLATE_SET,
    templateVersion: VERSION_2,
    revision: 1,
    status: "submitted",
    updatedAt: "2026-12-12T09:35:00",
    submittedAt: "2026-12-12T09:35:00",
    sheets: makeSheets("all"),
    attachments: [{ id: "f-t11", name: "Xac-nhan-kho-bac-thang-11-2026.pdf", size: 1_150_000 }],
    treasuryConfirmed: true,
    history: rev1("warning", "Chờ duyệt", "Nộp ngày 12/12/2026 09:35 · chờ Sở duyệt"),
  },
  {
    id: "phu-huu-2026-t8",
    periodName: "Tháng 8/2026",
    periodFrom: "2026-08-01",
    periodTo: "2026-08-31",
    dueDate: "2026-09-15",
    periodState: "overdue",
    orgName: ORG,
    templateSet: TEMPLATE_SET,
    templateVersion: VERSION_2,
    revision: 1,
    status: "draft",
    updatedAt: "2026-09-10T16:05:00",
    sheets: makeSheets(["1a", "1c", "1d"]),
    attachments: [],
    treasuryConfirmed: false,
    history: rev1("overdue", "Quá hạn", "Mở ngày 01/09/2026 08:00 · hết hạn nộp 15/09/2026"),
  },
  {
    id: "phu-huu-2026-q3",
    periodName: "Quý III/2026",
    periodFrom: "2026-07-01",
    periodTo: "2026-09-30",
    dueDate: "2026-10-15",
    periodState: "closed",
    orgName: ORG,
    templateSet: TEMPLATE_SET,
    templateVersion: VERSION_2,
    revision: 1,
    status: "locked",
    updatedAt: "2026-10-05T17:00:00",
    lockedAt: "2026-10-05T17:00:00",
    sheets: makeSheets("all"),
    attachments: [],
    treasuryConfirmed: false,
    history: rev1("locked", "Đã chốt", "Sở đã chốt số liệu ngày 05/10/2026"),
  },
  {
    id: "phu-huu-2026-q2",
    periodName: "Quý II/2026",
    periodFrom: "2026-04-01",
    periodTo: "2026-06-30",
    dueDate: "2026-07-15",
    periodState: "closed",
    orgName: ORG,
    templateSet: TEMPLATE_SET,
    templateVersion: VERSION_1,
    revision: 1,
    status: "approved",
    updatedAt: "2026-07-09T14:20:00",
    submittedAt: "2026-07-06T10:15:00",
    approvedAt: "2026-07-09T14:20:00",
    sheets: makeSheets("all", ["1e"]),
    attachments: [{ id: "f-q2", name: "Xac-nhan-kho-bac-quy-II-2026.pdf", size: 980_000 }],
    treasuryConfirmed: true,
    history: rev1("success", "Đã phê duyệt", "Nộp ngày 06/07/2026 10:15 · Sở duyệt ngày 09/07/2026 14:20"),
  },
  {
    id: "phu-huu-2026-q1",
    periodName: "Quý I/2026",
    periodFrom: "2026-01-01",
    periodTo: "2026-03-31",
    dueDate: "2026-04-15",
    periodState: "closed",
    orgName: ORG,
    templateSet: TEMPLATE_SET,
    templateVersion: VERSION_1,
    revision: 1,
    status: "approved",
    updatedAt: "2026-04-08T10:05:00",
    submittedAt: "2026-04-03T15:40:00",
    approvedAt: "2026-04-08T10:05:00",
    sheets: makeSheets("all"),
    attachments: [{ id: "f-q1", name: "Xac-nhan-kho-bac-quy-I-2026.jpg", size: 2_300_000 }],
    treasuryConfirmed: true,
    history: rev1("success", "Đã phê duyệt", "Nộp ngày 03/04/2026 15:40 · Sở duyệt ngày 08/04/2026 10:05"),
  },
];
