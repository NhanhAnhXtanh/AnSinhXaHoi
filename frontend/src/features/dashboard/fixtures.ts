// Dữ liệu mẫu — thay bằng API khi backend có.
//
// Hai chế độ của Trang chủ đọc hai bộ số độc lập:
// - "Theo phiếu": các kỳ đang nhận số liệu năm 2026, mỗi kỳ đếm phiếu theo
//   tình trạng. Tổng 308 phiếu = đã duyệt 266 + chờ duyệt 17 + bị trả lại 5
//   + đang nhập 20 (trong đó 10 phiếu thuộc kỳ đã quá hạn).
// - "Theo đơn vị": 105 đơn vị × 2 kỳ tháng, mỗi ô là tình trạng phiếu của
//   đơn vị đó trong kỳ đó. Mọi con số trên màn được đếm lại từ danh sách này.

/** Năm có dữ liệu mẫu; chọn năm khác thì màn hiện trạng thái trống. */
export const FIXTURE_YEAR = 2026;

/* -------------------------------------------------------------------------- */
/*  Theo phiếu                                                                */
/* -------------------------------------------------------------------------- */

/** Tình trạng một phiếu trong kỳ. */
export type SheetStatus = "approved" | "pending" | "returned" | "entering";

export type PeriodSummary = {
  id: string;
  name: string;
  /** Khoảng nhận số liệu, đã viết sẵn kiểu dd/MM. */
  range: string;
  /** Kỳ đã qua hạn nộp: các phiếu còn đang nhập được tính là quá hạn. */
  overdue: boolean;
  /** "Quá hạn 10 ngày" hoặc "Còn 21 ngày". */
  deadlineLabel: string;
  counts: Record<SheetStatus, number>;
};

export const PERIODS: PeriodSummary[] = [
  {
    id: "t9-2026",
    name: "Tháng 9/2026",
    range: "01/09 – 05/10/2026",
    overdue: true,
    deadlineLabel: "Quá hạn 10 ngày",
    counts: { approved: 89, pending: 6, returned: 2, entering: 8 },
  },
  {
    id: "t10-2026",
    name: "Tháng 10/2026",
    range: "01/10 – 05/11/2026",
    overdue: false,
    deadlineLabel: "Còn 21 ngày",
    counts: { approved: 84, pending: 9, returned: 2, entering: 10 },
  },
  {
    id: "q3-2026",
    name: "Quý III/2026",
    range: "01/10 – 12/10/2026",
    overdue: true,
    deadlineLabel: "Quá hạn 3 ngày",
    counts: { approved: 93, pending: 2, returned: 1, entering: 2 },
  },
];

export type TodoItem = {
  id: string;
  unit: string;
  detail: string;
  status: SheetStatus | "overdue";
};

/** Việc cần xử lý gần nhất, mới nhất ở trên. */
export const TODO_ITEMS: TodoItem[] = [
  {
    id: "todo-1",
    unit: "UBND phường Bình Lộc",
    detail: "Tháng 9/2026 · Hạn nộp 05/10/2026, quá 10 ngày",
    status: "overdue",
  },
  {
    id: "todo-2",
    unit: "UBND xã Phú Hữu",
    detail: "Tháng 9/2026 · Hạn nộp 05/10/2026, quá 10 ngày",
    status: "overdue",
  },
  {
    id: "todo-3",
    unit: "UBND xã Trảng Bom",
    detail: "Tháng 10/2026 · Nộp 14/10/2026 14:10, chờ Sở duyệt",
    status: "pending",
  },
  {
    id: "todo-4",
    unit: "UBND phường Biên Hòa",
    detail: "Tháng 10/2026 · Nộp 14/10/2026 09:30, chờ Sở duyệt",
    status: "pending",
  },
  {
    id: "todo-5",
    unit: "UBND xã Long Thọ",
    detail: "Tháng 10/2026 · Sở trả lại 12/10/2026, thiếu số liệu biểu 1b",
    status: "returned",
  },
  {
    id: "todo-6",
    unit: "UBND xã Tân An",
    detail: "Tháng 10/2026 · Hạn nộp 05/11/2026, còn 21 ngày",
    status: "entering",
  },
];

/* -------------------------------------------------------------------------- */
/*  Theo đơn vị                                                               */
/* -------------------------------------------------------------------------- */

/** Tình trạng phiếu của một đơn vị trong một kỳ. */
export type CellStatus = SheetStatus | "notStarted";

export type UnitType = "xa" | "truong" | "so";

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  xa: "Xã, phường",
  truong: "Trường học",
  so: "Sở, ban, ngành",
};

export type UnitPeriod = {
  id: string;
  name: string;
  batch: string;
  deadline: string;
};

/** Hai kỳ tháng đang nhận số liệu, dùng cho chế độ "Theo đơn vị". */
export const UNIT_PERIODS: UnitPeriod[] = [
  { id: "t9-2026", name: "Tháng 9/2026", batch: "Đợt 1", deadline: "2026-10-05" },
  { id: "t10-2026", name: "Tháng 10/2026", batch: "Đợt 1", deadline: "2026-11-05" },
];

/** Số biểu của một phiếu. */
export const SHEETS_PER_REPORT = 14;

/** Tên ngắn các biểu trong bộ biểu mẫu, đúng thứ tự trên phiếu. */
export const SHEET_NAMES = [
  "1a", "1b", "1c", "1d", "1e", "1g", "1h",
  "1i", "1k", "1l", "1n", "1o", "1q", "1s",
];

export type UnitReport = {
  periodId: string;
  status: CellStatus;
  /** Số biểu đã xong trên 14. */
  done: number;
};

export type Unit = {
  id: string;
  name: string;
  type: UnitType;
  reports: UnitReport[];
};

/** Chín đơn vị đầu bảng, viết tay cho khớp mẫu thiết kế. */
const HEAD_UNITS: { name: string; reports: [CellStatus, number][] }[] = [
  { name: "UBND phường Tân Phú", reports: [["entering", 8], ["notStarted", 0]] },
  { name: "UBND xã Cẩm Mỹ", reports: [["returned", 10], ["entering", 6]] },
  { name: "UBND xã Lộc Hưng", reports: [["pending", 14], ["notStarted", 9]] },
  { name: "UBND xã Trảng Bom", reports: [["approved", 14], ["approved", 14]] },
  { name: "UBND phường Biên Hòa", reports: [["approved", 14], ["pending", 14]] },
  { name: "UBND xã Phú Hữu", reports: [["notStarted", 3], ["notStarted", 0]] },
  { name: "UBND xã Long Thọ", reports: [["approved", 14], ["returned", 12]] },
  { name: "UBND xã Phước An", reports: [["approved", 14], ["approved", 14]] },
  { name: "UBND xã Sông Ray", reports: [["pending", 14], ["pending", 14]] },
];

/** Các xã, phường còn lại (đủ 95 cùng chín đơn vị đầu). */
const OTHER_COMMUNES = [
  "phường Trấn Biên", "phường Tam Hiệp", "phường Long Bình", "phường Long Hưng",
  "phường Phước Tân", "phường Tam Phước", "phường Hố Nai", "phường Bửu Long",
  "phường Tân Triều", "phường Long Khánh", "phường Bình Lộc", "phường Bảo Vinh",
  "phường Xuân Lập", "phường Hàng Gòn", "phường Đồng Xoài", "phường Bình Long",
  "phường An Lộc", "phường Phước Long", "phường Minh Hưng", "phường Chơn Thành",
  "xã Đại Phước", "xã Nhơn Trạch", "xã Phước Thái", "xã Long Phước",
  "xã Bình An", "xã Long Thành", "xã An Phước", "xã An Viễn",
  "xã Bình Minh", "xã Hưng Thịnh", "xã Bàu Hàm", "xã Thống Nhất",
  "xã Gia Kiệm", "xã Dầu Giây", "xã Xuân Đường", "xã Xuân Quế",
  "xã Xuân Đông", "xã Xuân Lộc", "xã Xuân Bắc", "xã Xuân Thành",
  "xã Xuân Hòa", "xã Xuân Phú", "xã Xuân Định", "xã Định Quán",
  "xã Thanh Sơn", "xã Phú Vinh", "xã Phú Hòa", "xã Tà Lài",
  "xã Nam Cát Tiên", "xã Phú Lâm", "xã Đak Lua", "xã Trị An",
  "xã Phú Lý", "xã Tân An", "xã Tân Hòa", "xã La Ngà",
  "xã Thuận Lợi", "xã Đồng Phú", "xã Tân Lợi", "xã Đồng Tâm",
  "xã Bù Đăng", "xã Thọ Sơn", "xã Đak Nhau", "xã Bom Bo",
  "xã Phú Nghĩa", "xã Đa Kia", "xã Bình Tân", "xã Long Hà",
  "xã Phú Riềng", "xã Phú Trung", "xã Lộc Ninh", "xã Lộc Thành",
  "xã Lộc Tấn", "xã Lộc Thạnh", "xã Lộc Quang", "xã Tân Tiến",
  "xã Thiện Hưng", "xã Hưng Phước", "xã Tân Quan", "xã Tân Hưng",
  "xã Tân Khai", "xã Minh Đức", "xã Nha Bích", "xã Bù Gia Mập",
  "xã Đak Ơ", "xã Phước Sơn",
];

const SCHOOLS = [
  "Trường THPT Ngô Quyền",
  "Trường THPT chuyên Lương Thế Vinh",
  "Trường THPT Long Khánh",
  "Trường THPT Xuân Lộc",
  "Trường Cao đẳng Y tế Đồng Nai",
];

const DEPARTMENTS = [
  "Sở Nội vụ",
  "Sở Y tế",
  "Sở Giáo dục và Đào tạo",
  "Sở Tài chính",
  "Bảo hiểm xã hội tỉnh",
];

/** Kiểu tình trạng của các đơn vị sinh tự động, xoay vòng theo thứ tự. */
const NOT_SUBMITTED: [CellStatus, CellStatus][] = [
  ["entering", "notStarted"],
  ["notStarted", "notStarted"],
  ["notStarted", "entering"],
  ["entering", "entering"],
];
const WITH_RETURNED: [CellStatus, CellStatus][] = [
  ["returned", "entering"],
  ["approved", "returned"],
  ["returned", "notStarted"],
];
const PARTIAL: [CellStatus, CellStatus][] = [
  ["pending", "notStarted"],
  ["approved", "entering"],
];
const COMPLETE: [CellStatus, CellStatus][] = [
  ["approved", "approved"],
  ["approved", "pending"],
  ["approved", "approved"],
  ["pending", "pending"],
  ["approved", "approved"],
];

/** Số biểu đã xong, đủ khác nhau giữa các đơn vị để bảng không đều tăm tắp. */
function doneFor(status: CellStatus, seed: number): number {
  switch (status) {
    case "approved":
    case "pending":
      return SHEETS_PER_REPORT;
    case "returned":
      return 10 + (seed % 3);
    case "entering":
      return 3 + ((seed * 5) % 10);
    case "notStarted":
      return (seed * 3) % 7;
  }
}

function buildUnits(): Unit[] {
  const units: Unit[] = HEAD_UNITS.map((u, i) => ({
    id: `dv-${i + 1}`,
    name: u.name,
    type: "xa",
    reports: u.reports.map(([status, done], p) => ({
      periodId: UNIT_PERIODS[p].id,
      status,
      done,
    })),
  }));

  // 86 xã, phường còn lại: 15 chưa nộp, 3 có trả lại, 2 nộp thiếu, còn lại nộp đủ.
  // Các đơn vị chưa xong rải đều (mỗi 4 dòng một đơn vị) cho bảng trông như thật.
  const special: [CellStatus, CellStatus][] = [
    ...Array.from({ length: 15 }, (_, k) => NOT_SUBMITTED[k % NOT_SUBMITTED.length]),
    ...WITH_RETURNED,
    ...PARTIAL,
  ];
  let next = 0;
  let complete = 0;

  OTHER_COMMUNES.forEach((name, i) => {
    let pair: [CellStatus, CellStatus];
    if (i % 4 === 1 && next < special.length) {
      // Xen kẽ để các loại khác nhau không dồn một chỗ.
      pair = special[(next * 7) % special.length];
      next += 1;
    } else {
      pair = COMPLETE[complete % COMPLETE.length];
      complete += 1;
    }
    units.push(makeUnit(`dv-${units.length + 1}`, `UBND ${name}`, "xa", pair, i));
  });

  SCHOOLS.forEach((name, i) =>
    units.push(makeUnit(`dv-${units.length + 1}`, name, "truong", COMPLETE[i], i))
  );
  DEPARTMENTS.forEach((name, i) =>
    units.push(makeUnit(`dv-${units.length + 1}`, name, "so", COMPLETE[(i + 2) % 5], i))
  );

  return units;
}

function makeUnit(
  id: string,
  name: string,
  type: UnitType,
  pair: [CellStatus, CellStatus],
  seed: number
): Unit {
  return {
    id,
    name,
    type,
    reports: pair.map((status, p) => ({
      periodId: UNIT_PERIODS[p].id,
      status,
      done: doneFor(status, seed + p),
    })),
  };
}

/**
 * 105 đơn vị: 95 xã, phường + 5 trường học + 5 sở, ban, ngành.
 * Theo cả hai kỳ: 80 nộp đủ, 17 chưa nộp, 3 nộp thiếu, 5 có phiếu bị trả lại.
 */
export const UNITS: Unit[] = buildUnits();
