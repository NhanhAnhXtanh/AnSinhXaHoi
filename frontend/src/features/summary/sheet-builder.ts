import type { SheetData, SheetRow } from "@/shared/components/asxh";

import {
  PERIOD_SHEETS,
  UNITS,
  YEAR_SHEET,
  type CellPatch,
  type Indicator,
  type SheetDef,
  type SummaryPeriod,
  type Unit,
} from "./fixtures";

/**
 * Dựng bảng tổng hợp từ số của từng đơn vị (dữ liệu mẫu).
 *
 * Mọi dòng nhóm và dòng TỔNG SỐ đều được CỘNG từ dòng lá, không ghi tay — sửa
 * một ô lá thì tổng tự đúng.
 */

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

export function sheetDef(key: string): SheetDef {
  return PERIOD_SHEETS.find((s) => s.key === key) ?? PERIOD_SHEETS[0];
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

/** Đơn vị được tính: các đơn vị đã được duyệt (theo thứ tự danh sách) thuộc phạm vi. */
export function unitsInScope(scope: string, approved: number): Unit[] {
  const approvedUnits = UNITS.slice(0, approved);
  if (scope === "tinh") return approvedUnits;
  if (scope === "khoi-huyen") return approvedUnits.filter((u) => u.block === "huyen");
  if (scope === "khoi-xa") return approvedUnits.filter((u) => u.block === "xa");
  return approvedUnits.filter((u) => u.id === scope);
}

export function withCells(values: SheetValues, cells: Record<string, CellValue>): SheetValues {
  return { ...values, cells };
}

function applyPatches(
  cells: Record<string, CellValue>,
  sheetKey: string,
  patches: CellPatch[]
): Record<string, CellValue> {
  const next: Record<string, CellValue> = {};
  for (const [k, v] of Object.entries(cells)) next[k] = { ...v };
  for (const p of patches) {
    if (p.sheet !== sheetKey || !next[p.leaf]) continue;
    next[p.leaf][p.col] += p.delta;
  }
  return next;
}

/** Số toàn tỉnh của một biểu ở một lần lưu (cộng dồn các ô Sở đã sửa tới lần đó). */
export function valuesAtVersion(
  def: SheetDef,
  period: SummaryPeriod,
  versionNo: number
): SheetValues {
  const base = aggregate(def, period.id, period.months, unitsInScope("tinh", period.approved));
  const patches = period.versions
    .filter((v) => v.no <= versionNo)
    .flatMap((v) => v.patches);
  return withCells(base, applyPatches(base.cells, def.key, patches));
}

/** Các ô khác nhau giữa hai bộ số (để lập lần lưu mới khi Sở hoàn tất). */
export function diffCells(
  sheetKey: string,
  from: Record<string, CellValue>,
  to: Record<string, CellValue>
): CellPatch[] {
  const out: CellPatch[] = [];
  for (const [leaf, a] of Object.entries(from)) {
    const b = to[leaf];
    if (!b) continue;
    if (b.people !== a.people) out.push({ sheet: sheetKey, leaf, col: "people", delta: b.people - a.people });
    if (b.money !== a.money) out.push({ sheet: sheetKey, leaf, col: "money", delta: b.money - a.money });
  }
  return out;
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
