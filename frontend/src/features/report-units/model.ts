/**
 * Đơn vị báo cáo — hình dạng dữ liệu của `/api/report_units` và các hàm thuần
 * dựng cây. Khớp `ReportUnitResponse` / `ReportUnitRequest` / `ReportUnitPatchRequest`
 * ở backend (`module/asxh/unit/api/dto`).
 */

/** Loại đơn vị (UC-01). Giá trị dây chữ thường, không hiện lên giao diện — nhãn ở UNIT_TYPE_LABELS. */
export type UnitType = "tinh" | "so" | "ubnd_huyen" | "ubnd_xa" | "truong" | "khac";

export const UNIT_TYPES: UnitType[] = ["tinh", "so", "ubnd_huyen", "ubnd_xa", "truong", "khac"];

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  tinh: "Tỉnh",
  so: "Sở, ngành",
  ubnd_huyen: "UBND huyện",
  ubnd_xa: "UBND xã",
  truong: "Trường",
  khac: "Khác",
};

/** Khối — cấp ngân sách mà số liệu của đơn vị được gộp vào khi tổng hợp. */
export type UnitBlock = "tinh" | "huyen" | "xa";

export const BLOCKS: UnitBlock[] = ["tinh", "huyen", "xa"];

export const BLOCK_LABELS: Record<UnitBlock, string> = {
  tinh: "Khối tỉnh",
  huyen: "Khối huyện",
  xa: "Khối xã",
};

/** Nhãn trong ô lọc "Khối: …". */
export const BLOCK_SHORT: Record<UnitBlock, string> = { tinh: "Tỉnh", huyen: "Huyện", xa: "Xã" };

/** "Đơn vị cấp xã" ở dòng phụ trang Sửa. */
export const BLOCK_LEVEL_LABELS: Record<UnitBlock, string> = {
  tinh: "Đơn vị cấp tỉnh",
  huyen: "Đơn vị cấp huyện",
  xa: "Đơn vị cấp xã",
};

export type ReportUnit = {
  id: number;
  /** Mã quan hệ ngân sách — nhập tay, không đổi sau khi lưu. Chỉ hiện ở form. */
  budgetCode: string;
  name: string;
  parent: { id: number; budgetCode: string; name: string } | null;
  unitType: UnitType;
  block: UnitBlock;
  active: boolean;
  receivesReports: boolean;
  createdAt: string;
  updatedAt: string | null;
};

/** Thân `POST /report_units` và `PATCH /report_units/{id}`. */
export type ReportUnitPayload = {
  /** Chỉ gửi khi tạo — mã bất biến (BR-01.1). */
  budgetCode?: string;
  name: string;
  /** `{ id: null }` = đơn vị cao nhất. */
  parent: { id: number | null };
  unitType: UnitType;
  active: boolean;
  receivesReports: boolean;
};

export const UNIT_RESOURCE = "report_units";

/** Đủ lớn để tải cả cây một lần (máy chủ trả tối đa 1.000 dòng mỗi trang). */
export const TREE_PAGE_SIZE = 1000;

/* ------------------------------------------------------------------ */
/* Cây đơn vị                                                          */
/* ------------------------------------------------------------------ */

export function parentIdOf(unit: ReportUnit): number | null {
  return unit.parent?.id ?? null;
}

/** Chỉ mục cấp trên → các đơn vị cấp dưới trực tiếp, giữ thứ tự máy chủ trả (theo mã). */
export function childIndex(list: ReportUnit[]): Map<number | null, ReportUnit[]> {
  const index = new Map<number | null, ReportUnit[]>();
  const ids = new Set(list.map((u) => u.id));
  for (const unit of list) {
    // Cấp trên không có trong danh sách (không được xem) thì coi như gốc, để đơn vị
    // vẫn hiện ra thay vì biến mất khỏi cây.
    const parentId = parentIdOf(unit);
    const key = parentId !== null && ids.has(parentId) ? parentId : null;
    const bucket = index.get(key);
    if (bucket) bucket.push(unit);
    else index.set(key, [unit]);
  }
  return index;
}

/** Mọi đơn vị cấp dưới (mọi tầng) của một đơn vị. */
export function descendantIds(
  index: Map<number | null, ReportUnit[]>,
  id: number
): Set<number> {
  const out = new Set<number>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    for (const child of index.get(current) ?? []) {
      if (!out.has(child.id)) {
        out.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return out;
}

export function findUnit(list: ReportUnit[], id: number | null | undefined) {
  return id === null || id === undefined ? undefined : list.find((u) => u.id === id);
}

/** Khối mặc định theo loại (BR-01.4) — cùng quy tắc `ReportUnitType.defaultBlock()` ở backend. */
export function defaultBlock(type: UnitType): UnitBlock {
  if (type === "ubnd_xa") return "xa";
  if (type === "ubnd_huyen") return "huyen";
  return "tinh";
}

/* ------------------------------------------------------------------ */
/* Lỗi từ máy chủ                                                      */
/* ------------------------------------------------------------------ */

/** Lỗi data provider ném ra (`shared/api/data.ts`): `{ message, statusCode, errors }`. */
export type ApiError = {
  message?: string;
  statusCode?: number;
  errors?: Record<string, string>;
};

const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/**
 * Câu báo lỗi cho người dùng. Chỉ dùng câu máy chủ trả về khi đó là câu tiếng Việt
 * (các lỗi nghiệp vụ); câu tiếng Anh chung của nền tảng thì thay bằng `fallback`.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const e = error as ApiError;
    if (e.statusCode === 403) {
      return "Bạn chưa được cấp quyền làm việc này. Hãy liên hệ quản trị hệ thống.";
    }
    const fieldMessage = e.errors
      ? Object.values(e.errors).find((v) => typeof v === "string" && VIETNAMESE.test(v))
      : undefined;
    if (fieldMessage) return fieldMessage;
    if (typeof e.message === "string" && VIETNAMESE.test(e.message)) return e.message;
  }
  return fallback;
}

/** Lỗi theo từng ô của form (422), chỉ những câu tiếng Việt. */
export function apiFieldErrors(error: unknown): Record<string, string> {
  if (!error || typeof error !== "object") return {};
  const errors = (error as ApiError).errors;
  if (!errors) return {};
  return Object.fromEntries(
    Object.entries(errors).filter(([, v]) => typeof v === "string" && VIETNAMESE.test(v))
  );
}
