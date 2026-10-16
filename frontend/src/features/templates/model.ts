import type { SheetData, SheetRow, StatusTone } from "@/shared/components/asxh";

import {
  POLICY_ITEMS,
  SAMPLE_PLACE,
  SAMPLE_UNIT,
  type FormKind,
  type TemplateForm,
  type TemplateVersion,
  type VersionStatus,
} from "./fixtures";

/* ------------------------------------------------------------------ */
/* Nhãn                                                                */
/* ------------------------------------------------------------------ */

export const STATUS_LABEL: Record<VersionStatus, string> = {
  draft: "Nháp",
  testing: "Đang thử nghiệm",
  published: "Đã ban hành",
  locked: "Đã khoá",
  revoked: "Đã thu hồi",
  archived: "Lưu trữ",
};

export const STATUS_TONE: Record<VersionStatus, StatusTone> = {
  draft: "neutral",
  testing: "info",
  published: "success",
  locked: "locked",
  revoked: "destructive",
  archived: "outline",
};

export const KIND_LABEL: Record<FormKind, string> = {
  "chi-tiet": "Biểu chi tiết",
  "tong-hop": "Biểu tổng hợp",
};

/** "Biểu 1a", "Biểu tổng hợp năm". */
export function formLabel(form: Pick<TemplateForm, "name">): string {
  return `Biểu ${form.name}`;
}

export function versionLabel(v: Pick<TemplateVersion, "number">): string {
  return `Phiên bản ${v.number}`;
}

/** Nháp và Đang thử nghiệm còn sửa được thiết kế, quy tắc, và ban hành được. */
export function isEditable(status: VersionStatus): boolean {
  return status === "draft" || status === "testing";
}

/* ------------------------------------------------------------------ */
/* Quy tắc phiên bản                                                   */
/* ------------------------------------------------------------------ */

/** Phiên bản của một biểu, mới nhất trước. */
export function versionsOf(
  versions: TemplateVersion[],
  formId: string
): TemplateVersion[] {
  return versions
    .filter((x) => x.formId === formId)
    .sort((a, b) => b.number - a.number);
}

/**
 * Phiên bản "đang dùng" hiện ở bảng biểu: bản đã ban hành mới nhất; chưa có
 * thì bản đã khoá mới nhất; chưa có nữa thì bản mới nhất (nháp) — khi đó cột
 * phiên bản để "—".
 */
export function currentVersion(
  list: TemplateVersion[]
): TemplateVersion | undefined {
  return (
    list.find((x) => x.status === "published") ??
    list.find((x) => x.status === "locked") ??
    list[0]
  );
}

/** Bản đứng trước trong chuỗi (bỏ qua bản đã thu hồi) — để kiểm ngày áp dụng khi ban hành. */
export function previousLiveVersion(
  list: TemplateVersion[],
  version: TemplateVersion
): TemplateVersion | undefined {
  return list.find(
    (x) =>
      x.number < version.number &&
      x.status !== "revoked" &&
      x.effectiveFrom !== null
  );
}

/** Bản kế tiếp còn hiệu lực (nháp cũng tính) — có rồi thì không tạo thêm (không rẽ nhánh). */
export function successorOf(
  list: TemplateVersion[],
  version: TemplateVersion
): TemplateVersion | undefined {
  return [...list]
    .reverse()
    .find((x) => x.number > version.number && x.status !== "revoked");
}

export type Availability = { ok: true } | { ok: false; reason: string };

const yes: Availability = { ok: true };
const no = (reason: string): Availability => ({ ok: false, reason });

export function canPublish(version: TemplateVersion): Availability {
  if (isEditable(version.status)) return yes;
  if (version.status === "published") return no("Phiên bản này đã ban hành.");
  if (version.status === "locked") return no("Phiên bản này đang khoá.");
  return no("Phiên bản này không còn dùng được.");
}

export function canClone(
  list: TemplateVersion[],
  version: TemplateVersion
): Availability {
  if (isEditable(version.status))
    return no("Chỉ dùng được sau khi đã ban hành.");
  if (version.status !== "published")
    return no("Chỉ tạo từ phiên bản đang ban hành.");
  const next = successorOf(list, version);
  if (next) return no(`Đã có ${versionLabel(next).toLowerCase()} — không tạo thêm.`);
  return yes;
}

export function canLock(
  list: TemplateVersion[],
  version: TemplateVersion
): Availability {
  if (version.status === "locked") return yes;
  if (version.status !== "published")
    return no("Chỉ khoá được bản đã ban hành mới nhất.");
  const newest = list.find((x) => x.status === "published");
  if (newest && newest.id !== version.id)
    return no("Chỉ khoá được bản đã ban hành mới nhất.");
  return yes;
}

export function canDelete(
  list: TemplateVersion[],
  version: TemplateVersion
): Availability {
  if (list[0] && list[0].id !== version.id)
    return no("Đã có phiên bản mới hơn — xoá từ bản mới nhất xuống.");
  if (version.usedCount > 0)
    return no(`Đã dùng cho ${version.usedCount} phiếu — chỉ khoá được.`);
  return yes;
}

/* ------------------------------------------------------------------ */
/* Ngày                                                                 */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "2026-11-01" theo giờ máy. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date → "2026-11-01T09:30:00" theo giờ máy. */
export function toIsoDateTime(d: Date): string {
  return `${toIsoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** "01/11/2026" → "2026-11-01"; sai định dạng hoặc ngày không có thật → null. */
export function parseVnDate(text: string): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  )
    return null;
  return toIsoDate(d);
}

/** "2026-07-01" → "02/07/2026" (ngày hôm sau), để báo ngày sớm nhất được chọn. */
export function nextDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toIsoDate(new Date(y, m - 1, d + 1));
}

/** Ngày 1 của tháng sau — mặc định "Áp dụng từ ngày". */
export function firstOfNextMonth(today = new Date()): string {
  return toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 1));
}

/* ------------------------------------------------------------------ */
/* Bảng thiết kế minh hoạ                                               */
/* ------------------------------------------------------------------ */

const COLUMNS: SheetData["columns"] = [
  { label: "A", width: 56, align: "center" },
  { label: "B", width: 380, align: "left" },
  { label: "C", width: 112, align: "right" },
  { label: "D", width: 112, align: "right" },
  { label: "E", width: 112, align: "right" },
  { label: "F", width: 112, align: "right" },
  { label: "G", width: 120, align: "left" },
  { label: "H", width: 96 },
  { label: "I", width: 96 },
];

const blank = (n: number): null[] => Array.from({ length: n }, () => null);

/** Dựng bảng thiết kế của một biểu: tiêu đề, hàng cột, các dòng chính sách, dòng Cộng, chỗ ký. */
export function buildSheet(form: TemplateForm, year = 2026): SheetData {
  const items = POLICY_ITEMS[form.id] ?? [];
  const title = (form.title ?? formLabel(form)).toUpperCase();

  const body: SheetRow[] = items.map(([name, people, monthly, months], i) => {
    const amount = Math.round((people * monthly * months) / 1_000_000);
    return {
      kind: "normal",
      editable: true,
      cells: [i + 1, name, people, amount, monthly || null, months || null, "—", null, null],
    };
  });

  const totalPeople = items.reduce((s, [, p]) => s + p, 0);
  const totalAmount = items.reduce(
    (s, [, p, m, t]) => s + Math.round((p * m * t) / 1_000_000),
    0
  );

  return {
    columns: COLUMNS,
    rows: [
      { kind: "title", cells: [null, `ĐƠN VỊ: ${SAMPLE_UNIT}`, ...blank(7)] },
      {
        kind: "title",
        cells: [null, `TỔNG HỢP KẾT QUẢ THỰC HIỆN ${title} NĂM ${year}`, ...blank(7)],
      },
      { kind: "normal", cells: [...blank(6), "Đơn vị tính: triệu đồng", null, null] },
      {
        kind: "header",
        cells: ["STT", "Chính sách, chế độ", "Số đối tượng", "Kinh phí", "Mức hỗ trợ", "Số tháng", "Ghi chú", null, null],
      },
      { kind: "group", cells: ["A", "B", 1, 2, 3, 4, 5, null, null] },
      ...body,
      {
        kind: "total",
        cells: [null, "Cộng", totalPeople, totalAmount, null, null, null, null, null],
      },
      { kind: "normal", cells: blank(9) },
      {
        kind: "normal",
        cells: [null, `${SAMPLE_PLACE}, ngày ... tháng ... năm ${year}`, ...blank(4), "NGƯỜI LẬP BIỂU", null, null],
      },
    ],
  };
}
