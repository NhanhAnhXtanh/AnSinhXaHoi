// Dữ liệu mẫu — thay bằng API khi backend có

/**
 * Khuôn biểu báo cáo năm và cách sinh số mẫu.
 *
 * Bản sao của phần tương ứng ở màn Tổng hợp (features/summary) — hai màn không
 * được import lẫn nhau. Cùng mã đơn vị, mã biểu, mã dòng và cùng hàm băm nên số
 * trên phiếu ở đây trùng số ở Tổng hợp → Theo năm. Khi có API thì cả hai bỏ.
 */

import type { SheetData, SheetRow } from "@/shared/components/asxh";

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

// ---------------------------------------------------------------- Cây chỉ tiêu

export type FlatRow = {
  /** Mã dòng nối bằng dấu chấm: "B.I.2". */
  id: string;
  code: string;
  label: string;
  depth: number;
  isLeaf: boolean;
  rate: number;
  /** Mã các dòng lá nằm dưới dòng này (chính nó nếu là lá). */
  leafIds: string[];
};

const flatCache = new Map<string, FlatRow[]>();

export function flatten(def: SheetDef): FlatRow[] {
  const cached = flatCache.get(def.key);
  if (cached) return cached;
  const out: FlatRow[] = [];
  const walk = (nodes: Indicator[], prefix: string, depth: number): string[] => {
    const leaves: string[] = [];
    for (const node of nodes) {
      const id = prefix ? `${prefix}.${node.code}` : node.code;
      const row: FlatRow = {
        id,
        code: node.code,
        label: node.label,
        depth,
        isLeaf: !node.children?.length,
        rate: node.rate ?? 0,
        leafIds: [],
      };
      out.push(row);
      row.leafIds = node.children?.length ? walk(node.children, id, depth + 1) : [id];
      leaves.push(...row.leafIds);
    }
    return leaves;
  };
  walk(def.tree, "", 0);
  flatCache.set(def.key, out);
  return out;
}

export function leavesOf(def: SheetDef): FlatRow[] {
  return flatten(def).filter((r) => r.isLeaf);
}

// ---------------------------------------------------------------- Số của đơn vị

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Số đối tượng của một đơn vị ở một chỉ tiêu lá trong một kỳ (0 = không phát sinh). */
function unitPeople(unit: Unit, sheetKey: string, leafId: string, periodId: string): number {
  const key = `${unit.id}|${sheetKey}|${leafId}`;
  if (hash(`${key}|z`) % 9 === 0) return 0;
  const base = (20 + (hash(key) % 380)) * (unit.block === "huyen" ? 3 : 1);
  const vary = 90 + (hash(`${key}|${periodId}`) % 21);
  return Math.round((base * vary) / 100);
}

export type CellValue = { people: number; money: number };

export type SheetValues = {
  /** Số theo dòng lá. */
  cells: Record<string, CellValue>;
  /** Số đơn vị có số liệu theo từng dòng (cả dòng nhóm). */
  units: Record<string, number>;
  /** Số đơn vị có số liệu ở bất kỳ dòng nào. */
  anyUnits: number;
};

const aggCache = new Map<string, SheetValues>();

/** Cộng số của các đơn vị trong phạm vi cho một biểu của một kỳ. */
export function aggregate(
  def: SheetDef,
  periodId: string,
  months: number,
  units: Unit[]
): SheetValues {
  const cacheKey = `${def.key}|${periodId}|${months}|${units.map((u) => u.id).join(",")}`;
  const cached = aggCache.get(cacheKey);
  if (cached) return cached;

  const rows = flatten(def);
  const leaves = rows.filter((r) => r.isLeaf);
  const cells: Record<string, CellValue> = {};
  for (const leaf of leaves) cells[leaf.id] = { people: 0, money: 0 };
  const unitCounts: Record<string, number> = {};
  for (const r of rows) unitCounts[r.id] = 0;
  let anyUnits = 0;

  for (const unit of units) {
    const has = new Set<string>();
    for (const leaf of leaves) {
      const people = unitPeople(unit, def.key, leaf.id, periodId);
      if (people > 0) has.add(leaf.id);
      cells[leaf.id].people += people;
      cells[leaf.id].money += people * leaf.rate * months;
    }
    if (has.size > 0) anyUnits++;
    for (const r of rows) {
      if (r.leafIds.some((id) => has.has(id))) unitCounts[r.id]++;
    }
  }

  const result = { cells, units: unitCounts, anyUnits };
  aggCache.set(cacheKey, result);
  return result;
}

// ---------------------------------------------------------------- Dựng bảng

const PERIOD_COLUMNS: SheetData["columns"] = [
  { label: "STT", width: 56, align: "center" },
  { label: "Chỉ tiêu", width: 400 },
  { label: "Số đối tượng", width: 130, align: "right" },
  { label: "Kinh phí (nghìn đồng)", width: 170, align: "right" },
  { label: "Số đơn vị có số liệu", width: 160, align: "right" },
  { label: "Ghi chú", width: 180 },
];

export type BuiltSheet = {
  sheet: SheetData;
  /** Mã dòng lá ứng với từng hàng của bảng (null = hàng không phải lá). */
  rowLeaf: (string | null)[];
};

function sumLeaves(row: FlatRow, cells: Record<string, CellValue>): CellValue {
  return row.leafIds.reduce(
    (acc, id) => ({
      people: acc.people + (cells[id]?.people ?? 0),
      money: acc.money + (cells[id]?.money ?? 0),
    }),
    { people: 0, money: 0 }
  );
}

/** Biểu theo kỳ: STT · Chỉ tiêu · Số đối tượng · Kinh phí · Số đơn vị có số liệu · Ghi chú. */
export function buildPeriodSheet(
  def: SheetDef,
  values: SheetValues,
  subtitle: string,
  editable = false
): BuiltSheet {
  const rows = flatten(def);
  const sheetRows: SheetRow[] = [];
  const rowLeaf: (string | null)[] = [];
  const push = (row: SheetRow, leaf: string | null = null) => {
    sheetRows.push(row);
    rowLeaf.push(leaf);
  };

  push({ kind: "title", cells: [def.title] });
  push({ kind: "normal", cells: [null, subtitle] });
  push({ kind: "header", cells: PERIOD_COLUMNS.map((c) => c.label) });

  const total = rows
    .filter((r) => r.depth === 0)
    .reduce(
      (acc, r) => {
        const v = sumLeaves(r, values.cells);
        return { people: acc.people + v.people, money: acc.money + v.money };
      },
      { people: 0, money: 0 }
    );
  push({ kind: "total", cells: [null, "TỔNG SỐ", total.people, total.money, values.anyUnits, null] });

  for (const r of rows) {
    const v = sumLeaves(r, values.cells);
    const cells = [r.code, r.label, v.people, v.money, values.units[r.id] ?? 0, null];
    if (r.isLeaf) {
      push({ kind: "normal", cells, editable, editableCols: [2, 3] }, r.id);
    } else {
      push({ kind: "group", cells });
    }
  }

  return { sheet: { columns: PERIOD_COLUMNS, rows: sheetRows }, rowLeaf };
}

const YEAR_COLUMNS: SheetData["columns"] = [
  { label: "STT", width: 56, align: "center" },
  { label: "Chính sách, chế độ", width: 400 },
  { label: "6 tháng đầu năm", width: 150, align: "right" },
  { label: "6 tháng cuối năm", width: 150, align: "right" },
  { label: "Số đối tượng cả năm", width: 170, align: "right" },
  { label: "Kinh phí cả năm", width: 170, align: "right" },
];

/**
 * Biểu 01 tổng hợp năm: số đối tượng của từng nửa năm, cả năm lấy số lớn hơn
 * của hai nửa (một người hưởng cả năm chỉ tính một lần), kinh phí cộng cả năm.
 */
export function buildYearSummarySheet(year: number): SheetData {
  const def = YEAR_SHEET;
  const rows = flatten(def);
  const h1 = aggregate(def, `${year}-h1`, 6, UNITS).cells;
  const h2 = aggregate(def, `${year}-h2`, 6, UNITS).cells;

  const leafCols: Record<string, [number, number, number, number]> = {};
  for (const r of rows) {
    if (!r.isLeaf) continue;
    const a = h1[r.id];
    const b = h2[r.id];
    leafCols[r.id] = [a.people, b.people, Math.max(a.people, b.people), a.money + b.money];
  }
  const sumCols = (ids: string[]) =>
    ids.reduce<[number, number, number, number]>(
      (acc, id) => acc.map((v, i) => v + leafCols[id][i]) as [number, number, number, number],
      [0, 0, 0, 0]
    );

  const sheetRows: SheetRow[] = [
    { kind: "title", cells: [`${def.title} ${year}`] },
    {
      kind: "normal",
      cells: [
        null,
        `Toàn tỉnh Đồng Nai · Năm ${year} · Số đối tượng theo từng nửa năm, kinh phí tính cả năm · Đơn vị tính: nghìn đồng`,
      ],
    },
    { kind: "header", cells: YEAR_COLUMNS.map((c) => c.label) },
    { kind: "total", cells: [null, "TỔNG SỐ", ...sumCols(rows.flatMap((r) => (r.isLeaf ? [r.id] : [])))] },
  ];
  for (const r of rows) {
    sheetRows.push({
      kind: r.isLeaf ? "normal" : "group",
      cells: [r.code, r.label, ...sumCols(r.leafIds)],
    });
  }
  return { columns: YEAR_COLUMNS, rows: sheetRows };
}

/** Phụ lục của báo cáo năm (1a, 1b…): cùng khuôn biểu kỳ, số cả năm toàn tỉnh. */
export function buildYearAppendixSheet(def: SheetDef, year: number): SheetData {
  const values = aggregate(def, `${year}-nam`, 12, UNITS);
  return buildPeriodSheet(
    def,
    values,
    `Toàn tỉnh Đồng Nai · Năm ${year} · Đơn vị tính: nghìn đồng`
  ).sheet;
}
