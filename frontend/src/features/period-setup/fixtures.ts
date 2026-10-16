// Dữ liệu mẫu — thay bằng API khi backend có
import type { Period, Template, Unit } from "./model";

/** Năm có dữ liệu mẫu; năm khác hiện màn trống. */
export const FIXTURE_YEAR = 2026;

/** Ngày "hôm nay" cố định để các trạng thái mẫu (quá hạn, còn N ngày) luôn khớp nhau. */
export const TODAY = "2026-10-16";

/** 18 biểu mẫu đang ban hành (không gồm biểu tổng hợp năm). */
export const TEMPLATES: Template[] = [
  { code: "1a", name: "Kinh phí trợ cấp xã hội hằng tháng" },
  { code: "1b", name: "Kinh phí hỗ trợ mai táng phí" },
  { code: "1c", name: "Kinh phí chăm sóc người cao tuổi" },
  { code: "1d", name: "Kinh phí hỗ trợ người khuyết tật" },
  { code: "1đ", name: "Kinh phí trợ giúp đột xuất" },
  { code: "1e", name: "Kinh phí ưu đãi người có công" },
  { code: "1g", name: "Kinh phí điều dưỡng người có công" },
  { code: "1h", name: "Kinh phí hỗ trợ nhà ở người có công" },
  { code: "1i", name: "Kinh phí mua thẻ bảo hiểm y tế đối tượng xã hội" },
  { code: "1k", name: "Kinh phí giảm nghèo bền vững" },
  { code: "1l", name: "Kinh phí hỗ trợ học nghề" },
  { code: "1m", name: "Kinh phí bảo vệ, chăm sóc trẻ em" },
  { code: "1n", name: "Kinh phí bình đẳng giới" },
  { code: "1o", name: "Kinh phí phòng, chống tệ nạn xã hội" },
  { code: "1p", name: "Kinh phí cơ sở bảo trợ xã hội" },
  { code: "1q", name: "Kinh phí chi trả qua bưu điện" },
  { code: "1r", name: "Kinh phí quản lý chi trả chế độ" },
  { code: "1s", name: "Kinh phí hỗ trợ an sinh khác" },
];

const HUYEN = "huyen" as const;
const XA = "xa" as const;

/** 40 đơn vị đang hoạt động và được nhận phiếu (15 khối huyện, 25 khối xã). */
export const UNITS: Unit[] = [
  ["UBND TP. Biên Hoà", HUYEN],
  ["UBND TP. Long Khánh", HUYEN],
  ["UBND huyện Trảng Bom", HUYEN],
  ["UBND huyện Long Thành", HUYEN],
  ["UBND huyện Nhơn Trạch", HUYEN],
  ["UBND huyện Vĩnh Cửu", HUYEN],
  ["UBND xã Phú Hữu", XA],
  ["UBND xã Long Phước", XA],
  ["UBND phường Trấn Biên", XA],
  ["UBND xã Bàu Hàm", XA],
  ["UBND huyện Xuân Lộc", HUYEN],
  ["UBND huyện Cẩm Mỹ", HUYEN],
  ["UBND huyện Thống Nhất", HUYEN],
  ["UBND huyện Định Quán", HUYEN],
  ["UBND huyện Tân Phú", HUYEN],
  ["UBND xã Phước Thiền", XA],
  ["UBND xã Long Tân", XA],
  ["UBND xã Đại Phước", XA],
  ["UBND xã Tam An", XA],
  ["UBND xã An Phước", XA],
  ["UBND xã Bình An", XA],
  ["UBND xã Xuân Đường", XA],
  ["UBND xã Sông Ray", XA],
  ["UBND phường Xuân Lập", XA],
  ["UBND phường Bảo Vinh", XA],
  ["UBND phường Hố Nai", XA],
  ["UBND xã Tân Triều", XA],
  ["UBND xã Thạnh Phú", XA],
  ["UBND xã Trị An", XA],
  ["UBND xã Hiếu Liêm", XA],
  ["UBND xã La Ngà", XA],
  ["UBND xã Phú Lý", XA],
  ["UBND xã Gia Kiệm", XA],
  ["UBND xã Dầu Giây", XA],
  ["UBND xã Xuân Bắc", XA],
  ["UBND xã Xuân Định", XA],
  ["UBND xã Xuân Hoà", XA],
  ["UBND xã Nam Cát Tiên", XA],
  ["UBND xã Phú Vinh", XA],
  ["UBND xã Thanh Sơn", XA],
].map(([name, group], i) => ({
  id: `dv-${String(i + 1).padStart(2, "0")}`,
  name: name as string,
  group: group as Unit["group"],
}));

/**
 * 12 kỳ của lịch năm 2026, sắp theo ngày bắt đầu (kỳ dài đứng trước).
 * Kỳ "Chưa thiết lập" trùng thời gian với kỳ đã mở đợt sẽ tự hiện "Đã khoá".
 */
export const INITIAL_PERIODS: Period[] = [
  {
    id: "nam-2026",
    name: "Năm 2026",
    kind: "nam",
    from: "2026-01-01",
    to: "2026-12-31",
    openFrom: "2026-01-01",
    deadline: "2027-01-15",
    status: "draft",
  },
  {
    id: "6tdn-2026",
    name: "6 tháng đầu năm 2026",
    kind: "6thang",
    from: "2026-01-01",
    to: "2026-06-30",
    openFrom: "2026-01-01",
    deadline: "2026-07-15",
    status: "draft",
  },
  {
    id: "q1-2026",
    name: "Quý I/2026",
    kind: "quy",
    from: "2026-01-01",
    to: "2026-03-31",
    openFrom: "2026-01-01",
    deadline: "2026-04-15",
    status: "closed",
    closedAt: "2026-04-20",
    progress: { approved: 40, pendingReview: 0, notSubmitted: 0 },
  },
  {
    id: "q2-2026",
    name: "Quý II/2026",
    kind: "quy",
    from: "2026-04-01",
    to: "2026-06-30",
    openFrom: "2026-04-01",
    deadline: "2026-07-15",
    status: "closed",
    closedAt: "2026-07-20",
    progress: { approved: 38, pendingReview: 0, notSubmitted: 2 },
  },
  {
    id: "6tcn-2026",
    name: "6 tháng cuối năm 2026",
    kind: "6thang",
    from: "2026-07-01",
    to: "2026-12-31",
    openFrom: "2026-07-01",
    deadline: "2027-01-15",
    status: "draft",
  },
  {
    id: "q3-2026",
    name: "Quý III/2026",
    kind: "quy",
    from: "2026-07-01",
    to: "2026-09-30",
    openFrom: "2026-07-01",
    deadline: "2026-10-15",
    status: "overdue",
    progress: { approved: 26, pendingReview: 0, notSubmitted: 12 },
  },
  {
    id: "t8-2026",
    name: "Tháng 8/2026",
    kind: "thang",
    from: "2026-08-01",
    to: "2026-08-31",
    openFrom: "2026-08-01",
    deadline: "2026-09-15",
    status: "draft",
  },
  {
    id: "t9-2026",
    name: "Tháng 9/2026",
    kind: "thang",
    from: "2026-09-01",
    to: "2026-09-30",
    openFrom: "2026-09-01",
    deadline: "2026-10-15",
    status: "draft",
  },
  {
    id: "q4-2026",
    name: "Quý IV/2026",
    kind: "quy",
    from: "2026-10-01",
    to: "2026-12-31",
    openFrom: "2026-10-01",
    deadline: "2027-01-15",
    status: "ready",
  },
  {
    id: "t10-2026",
    name: "Tháng 10/2026",
    kind: "thang",
    from: "2026-10-01",
    to: "2026-10-31",
    openFrom: "2026-10-01",
    deadline: "2026-11-15",
    status: "draft",
  },
  {
    id: "t11-2026",
    name: "Tháng 11/2026",
    kind: "thang",
    from: "2026-11-01",
    to: "2026-11-30",
    openFrom: "2026-11-01",
    deadline: "2026-12-15",
    status: "ready",
  },
  {
    id: "t12-2026",
    name: "Tháng 12/2026",
    kind: "thang",
    from: "2026-12-01",
    to: "2026-12-31",
    openFrom: "2026-12-01",
    deadline: "2027-01-15",
    status: "draft",
  },
];

const ALL_CODES = TEMPLATES.map((t) => t.code);

function cellsFor(
  unitIndexes: number[],
  codesOf: (unitIndex: number) => string[]
): string[] {
  const keys: string[] = [];
  for (const i of unitIndexes) {
    const unit = UNITS[i];
    if (!unit) continue;
    for (const code of codesOf(i)) keys.push(`${unit.id}:${code}`);
  }
  return keys;
}

function range(from: number, toExclusive: number): number[] {
  return Array.from({ length: toExclusive - from }, (_, k) => from + k);
}

/** Quý IV/2026: 24/40 đơn vị đã thiết lập, mỗi đơn vị một số biểu khác nhau. */
const Q4_CELLS = cellsFor([...range(0, 7), ...range(10, 27)], (i) => {
  if (i === 2) return ALL_CODES.filter((c) => !["1m", "1n", "1o"].includes(c));
  if (i === 5) return ["1a", "1b", "1c", "1d"];
  if (i === 6) return ["1a", "1b", "1c", "1e"];
  if (i < 7) return ALL_CODES;
  return ALL_CODES.slice(0, 10 + (i % 9));
});

/** Ô (đơn vị × biểu) đã lưu của từng kỳ. Khoá ô = "mã đơn vị:mã biểu". */
export const INITIAL_ASSIGNMENTS: Record<string, string[]> = {
  "q1-2026": cellsFor(range(0, 40), () => ALL_CODES),
  "q2-2026": cellsFor(range(0, 40), () => ALL_CODES),
  "q3-2026": cellsFor(range(0, 38), (i) =>
    i % 5 === 4 ? ALL_CODES.slice(0, 12) : ALL_CODES
  ),
  "q4-2026": Q4_CELLS,
  "t11-2026": cellsFor(range(0, 10), () => ["1a", "1b", "1c", "1d"]),
};
