// Xử lý JSON workbook SpreadJS thuần dữ liệu — KHÔNG import SpreadJS, nằm được
// trong bundle chính. Bê từ bản Jmix (core/report/workbookExport.ts và
// PerFormWorkbookStructureService.java phía máy chủ).

import type { ExportSheetSource, WorkbookJson } from "./types";

/** Sheet bản dùng thử SpreadJS tự chèn — từng làm hỏng việc lưu mẫu ở bản Jmix. */
export const EVALUATION_SHEET_NAME = "Evaluation Version";
/** Sheet kỹ thuật của mẫu đời cũ (bản Jmix) — không bao giờ cho người dùng thấy. */
export const LEGACY_DATA_SHEET_NAME = "_DATA_";

const TECHNICAL_SHEET_NAMES = new Set<string>([
  EVALUATION_SHEET_NAME,
  LEGACY_DATA_SHEET_NAME,
]);

export function isTechnicalSheetName(name: string): boolean {
  return TECHNICAL_SHEET_NAMES.has(name);
}

type SheetsRecord = Record<string, Record<string, unknown>>;

function sheetNameOf(key: string, sheet: unknown): string {
  if (sheet && typeof sheet === "object") {
    const name = (sheet as { name?: unknown }).name;
    if (typeof name === "string") return name;
  }
  return key;
}

/**
 * Bỏ các sheet theo tên khỏi JSON (bản sao nông ở cấp gốc + sheets) và đánh lại
 * `index`/`order`, `sheetCount`, `activeSheetIndex` — đúng như máy chủ bản Jmix làm.
 */
function removeSheets(json: WorkbookJson, names: ReadonlySet<string>): WorkbookJson {
  const sheets = json.sheets as SheetsRecord | undefined;
  if (!sheets || typeof sheets !== "object") return json;
  const removed = Object.keys(sheets).filter((key) => names.has(sheetNameOf(key, sheets[key])));
  if (removed.length === 0) return json;

  const oldActive = typeof json.activeSheetIndex === "number" ? json.activeSheetIndex : -1;
  const kept: SheetsRecord = {};
  for (const [key, sheet] of Object.entries(sheets)) {
    if (!removed.includes(key)) kept[key] = { ...sheet };
  }
  const ordered = Object.values(kept).sort(
    (a, b) =>
      (typeof a.index === "number" ? a.index : Number.MAX_SAFE_INTEGER) -
      (typeof b.index === "number" ? b.index : Number.MAX_SAFE_INTEGER)
  );
  let newActive = -1;
  ordered.forEach((sheet, newIndex) => {
    if (sheet.index === oldActive) newActive = newIndex;
    if ("index" in sheet) sheet.index = newIndex;
    if ("order" in sheet) sheet.order = newIndex;
  });
  const result: WorkbookJson = { ...json, sheets: kept };
  if (typeof json.sheetCount === "number") result.sheetCount = Object.keys(kept).length;
  if (typeof json.activeSheetIndex === "number") {
    result.activeSheetIndex = newActive >= 0 ? newActive : 0;
  }
  return result;
}

/** JSON để LƯU: bỏ sheet "Evaluation Version" của bản dùng thử. */
export function stripEvaluationSheet(json: WorkbookJson): WorkbookJson {
  return removeSheets(json, new Set([EVALUATION_SHEET_NAME]));
}

/**
 * JSON để XUẤT EXCEL một workbook: bỏ sheet kỹ thuật, mọi tab nghiệp vụ hiện ra,
 * và ÉP hiện hàng tab — màn nhập liệu ẩn hàng tab (`tabStripVisible=false`), cờ
 * đó lọt vào file thành showSheetTabs="0" và người mở tưởng chỉ có một biểu.
 */
export function prepareJsonForExport(json: WorkbookJson): WorkbookJson {
  const cleaned = removeSheets(json, TECHNICAL_SHEET_NAMES);
  const sheets = cleaned.sheets as SheetsRecord | undefined;
  const visibleSheets: SheetsRecord = {};
  if (sheets) {
    for (const [key, sheet] of Object.entries(sheets)) {
      visibleSheets[key] = { ...sheet, visible: true };
    }
  }
  return { ...cleaned, sheets: visibleSheets, tabStripVisible: true };
}

/** Excel giới hạn tên tab 31 ký tự và cấm : \ / ? * [ ] */
const INVALID_SHEET_NAME_CHARS = /[:\\/?*[\]]/g;
const MAX_SHEET_NAME_LENGTH = 31;

export function toExcelSheetName(raw: string): string {
  const cleaned = raw.replace(INVALID_SHEET_NAME_CHARS, "-").trim();
  const safe = cleaned === "" ? "Bieu" : cleaned;
  return safe.length > MAX_SHEET_NAME_LENGTH ? safe.slice(0, MAX_SHEET_NAME_LENGTH) : safe;
}

function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const tail = ` (${suffix})`;
    const candidate = base.slice(0, MAX_SHEET_NAME_LENGTH - tail.length) + tail;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  throw new Error("Không đặt được tên tab duy nhất cho file Excel.");
}

/** Key trong JSON sheet mà GIÁ TRỊ là TÊN một named style. */
const STYLE_REF_KEYS = new Set<string>(["parentName", "style"]);

function rewriteStyleRefs(node: unknown, nameMap: Map<string, string>): void {
  if (Array.isArray(node)) {
    for (const item of node) rewriteStyleRefs(item, nameMap);
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") {
      const renamed = STYLE_REF_KEYS.has(key) ? nameMap.get(value) : undefined;
      if (renamed !== undefined) record[key] = renamed;
    } else {
      rewriteStyleRefs(value, nameMap);
    }
  }
}

/**
 * Bảng đổi tên named style của MỘT biểu. SpreadJS đặt tên style tự sinh giống
 * hệt nhau ở mọi workbook (`__builtInStyle1..N`) nhưng ĐỊNH NGHĨA khác nhau; gộp
 * theo tên thì biểu sau ăn nhầm style của biểu đầu (viền/nền/căn lề sai).
 */
function buildStyleRename(prefix: string, namedStyles: unknown): Map<string, string> {
  const nameMap = new Map<string, string>();
  if (!Array.isArray(namedStyles)) return nameMap;
  for (const style of namedStyles) {
    if (style && typeof style === "object" && typeof (style as { name?: unknown }).name === "string") {
      const name = (style as { name: string }).name;
      nameMap.set(name, prefix + name);
    }
  }
  return nameMap;
}

function renameStyles(namedStyles: unknown, nameMap: Map<string, string>): unknown[] {
  if (!Array.isArray(namedStyles)) return [];
  const result: unknown[] = [];
  for (const style of namedStyles) {
    if (!style || typeof style !== "object" || typeof (style as { name?: unknown }).name !== "string") {
      continue;
    }
    const clone = JSON.parse(JSON.stringify(style)) as Record<string, unknown>;
    clone.name = nameMap.get(clone.name as string) ?? clone.name;
    if (typeof clone.parentName === "string" && nameMap.has(clone.parentName)) {
      clone.parentName = nameMap.get(clone.parentName);
    }
    result.push(clone);
  }
  return result;
}

/**
 * Gộp workbook của TỪNG biểu thành MỘT workbook nhiều tab để xuất một file Excel
 * (bê từ bản Jmix `mergeWorkbooksIntoTabs`). Tên tab = tên biểu; named style đổi
 * tên theo từng biểu để không đè nhau; hàng tab luôn hiện.
 */
export function mergeWorkbooksIntoTabs(sources: readonly ExportSheetSource[]): WorkbookJson {
  const mergedSheets: SheetsRecord = {};
  const takenNames = new Set<string>();
  const mergedNamedStyles: unknown[] = [];
  let baseWorkbook: WorkbookJson | undefined;
  let version: unknown;
  let index = 0;
  let ordinal = 0;

  for (const source of sources) {
    const workbook = source.workbookJson as WorkbookJson | null;
    if (!workbook || typeof workbook !== "object" || !workbook.sheets) continue;
    const sheets = workbook.sheets as SheetsRecord;
    baseWorkbook = baseWorkbook ?? workbook;
    version = version ?? workbook.version;
    const styleRename = buildStyleRename(`b${ordinal}_`, workbook.namedStyles);
    ordinal += 1;
    mergedNamedStyles.push(...renameStyles(workbook.namedStyles, styleRename));
    const labelBase =
      source.sheetName && source.sheetName.trim() !== "" ? source.sheetName.trim() : source.sheetCode;
    let businessIndex = 0;
    for (const sheetKey of Object.keys(sheets)) {
      const rawSheet = sheets[sheetKey];
      if (!rawSheet || typeof rawSheet !== "object") continue;
      if (isTechnicalSheetName(sheetNameOf(sheetKey, rawSheet))) continue;
      const sheet = JSON.parse(JSON.stringify(rawSheet)) as Record<string, unknown>;
      rewriteStyleRefs(sheet, styleRename);
      const label = businessIndex === 0 ? labelBase : `${labelBase} - ${sheetNameOf(sheetKey, rawSheet)}`;
      const finalName = uniqueName(toExcelSheetName(label), takenNames);
      mergedSheets[finalName] = {
        ...sheet,
        name: finalName,
        index,
        visible: true,
        isSelected: index === 0,
      };
      index += 1;
      businessIndex += 1;
    }
  }

  const base: WorkbookJson = baseWorkbook ? { ...baseWorkbook } : {};
  return {
    ...base,
    version: version ?? "19.2.1",
    sheetCount: index,
    sheets: mergedSheets,
    namedStyles: mergedNamedStyles.length > 0 ? mergedNamedStyles : base.namedStyles,
    activeSheetIndex: 0,
    tabStripVisible: true,
  };
}

/**
 * Tên file gợi ý, không dấu: `Phieu_Xa-Long-Thanh_T5-2026.xlsx`.
 */
export function buildExportFileName(
  organizationName: string,
  periodLabel: string,
  revisionNo = 1
): string {
  const slug = (raw: string) =>
    raw
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = ["Phieu", slug(organizationName), slug(periodLabel)].filter((part) => part !== "");
  if (revisionNo > 1) parts.push(`ban-${revisionNo}`);
  return `${parts.join("_")}.xlsx`;
}

/** Thêm đuôi .xlsx nếu thiếu. */
export function ensureXlsxName(fileName: string): string {
  const name = fileName.trim() === "" ? "bang-tinh" : fileName.trim();
  return /\.xlsx$/i.test(name) ? name : `${name}.xlsx`;
}

/**
 * Chuỗi so sánh nội dung workbook. Dùng để chỉ nạp lại bảng tính khi NỘI DUNG đổi
 * (feature có thể truyền object mới mỗi lần render, vd `JSON.parse` tại chỗ).
 */
export function workbookContentKey(json: WorkbookJson | null | undefined): string {
  if (json == null) return "";
  try {
    return JSON.stringify(json);
  } catch {
    return String(Math.random());
  }
}
