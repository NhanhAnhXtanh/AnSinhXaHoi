import type { StatusTone } from "@/shared/components/asxh";

import type {
  ApiTemplate,
  ApiTemplateKind,
  ApiTemplateSet,
  ApiTemplateStatus,
  ApiTemplateVersion,
  ChangeLogEntry,
  FormKind,
  TemplateForm,
  TemplateSet,
  TemplateVersion,
  VersionStatus,
} from "./types";

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

/** "Biểu 1a", "Biểu TH". */
export function formLabel(form: Pick<TemplateForm, "name">): string {
  return `Biểu ${form.name}`;
}

/**
 * Giữa câu: "biểu KT2" — chữ "Biểu" viết thường nhưng TÊN biểu giữ nguyên chữ hoa (`formLabel(...)
 * .toLowerCase()` làm "kt2", "1A" thành "1a" trong thông báo).
 */
export function formLabelInline(form: Pick<TemplateForm, "name">): string {
  return `biểu ${form.name}`;
}

/**
 * Trạng thái điều hướng gửi kèm khi mở Thiết kế mẫu: tên biểu biết trước, để
 * vòng quay đầu tiên (đang tải phiên bản) đã ghi đúng tên biểu.
 */
export type DesignerNavState = { formName?: string };

/**
 * Chữ dưới vòng quay khi mở Thiết kế mẫu — một câu dùng chung từ lúc tải dữ liệu
 * tới lúc bảng tính dựng xong, để người dùng thấy một lần mở chứ không phải nhiều lần.
 */
export function openingLabel(formName: string | undefined): string {
  return formName ? `Đang mở biểu ${formName}…` : "Đang mở biểu…";
}

export function versionLabel(v: Pick<TemplateVersion, "number">): string {
  return `Phiên bản ${v.number}`;
}

/**
 * Nháp còn sửa được thiết kế, quy tắc, và ban hành được. "Đang thử nghiệm" đã bỏ (Q-22);
 * bản cũ còn ở trạng thái đó được xử lý y như nháp.
 */
export function isEditable(status: VersionStatus): boolean {
  return status === "draft" || status === "testing";
}

/* ------------------------------------------------------------------ */
/* Chuyển từ dữ liệu API                                               */
/* ------------------------------------------------------------------ */

const STATUS_FROM_API: Record<ApiTemplateStatus, VersionStatus> = {
  DRAFT: "draft",
  TESTING: "testing",
  PUBLISHED: "published",
  LOCKED: "locked",
  REVOKED: "revoked",
  ARCHIVED: "archived",
};

export const KIND_FROM_API: Record<ApiTemplateKind, FormKind> = {
  CHI_TIET: "chi-tiet",
  TONG_HOP: "tong-hop",
};

export const KIND_TO_API: Record<FormKind, ApiTemplateKind> = {
  "chi-tiet": "CHI_TIET",
  "tong-hop": "TONG_HOP",
};

export function toSet(api: ApiTemplateSet): TemplateSet {
  return {
    id: String(api.id),
    name: api.name,
    description: api.description ?? undefined,
    createdAt: api.createdAt,
    updatedAt: api.updatedAt ?? api.createdAt,
    templateCount: api.templateCount,
    inUse: api.inUse,
  };
}

export function toForm(api: ApiTemplate): TemplateForm {
  return {
    id: String(api.id),
    setId: String(api.set.id),
    name: api.shortName,
    title: api.name,
    kind: KIND_FROM_API[api.kind],
    sortOrder: api.sortOrder,
    createdAt: api.createdAt,
    latestVersionId: api.latestVersion ? String(api.latestVersion.id) : null,
    locked: api.locked,
    lockedAt: api.lockedAt,
    lockedBy: api.lockedBy,
  };
}

/** Biểu dựng từ phần "template" lồng trong một phiên bản (màn thiết kế chỉ nạp phiên bản). */
export function formOfVersion(api: ApiTemplateVersion): TemplateForm {
  return {
    id: String(api.template.id),
    setId: String(api.template.set.id),
    name: api.template.shortName,
    title: api.template.name,
    kind: KIND_FROM_API[api.template.kind],
    sortOrder: 0,
    createdAt: api.createdAt,
    latestVersionId: null,
    locked: api.template.locked,
    lockedAt: null,
    lockedBy: null,
  };
}

export function toVersion(api: ApiTemplateVersion): TemplateVersion {
  return {
    id: String(api.id),
    formId: String(api.template.id),
    number: api.versionNo,
    status: STATUS_FROM_API[api.status],
    previousId: api.previousVersionId === null ? null : String(api.previousVersionId),
    effectiveFrom: api.effectiveFrom,
    effectiveTo: api.effectiveTo,
    publishedAt: api.publishedAt,
    approver: api.publishedBy,
    revokedAt: api.revokedAt,
    revokedBy: api.revokedBy,
    createdAt: api.createdAt,
  };
}

/* ------------------------------------------------------------------ */
/* Quy tắc phiên bản — chỉ để làm mờ nút kèm lý do; máy chủ kiểm lại   */
/* và trả câu báo (409) nếu lệch.                                       */
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

/** Bản nguồn còn hiệu lực của một phiên bản — để kiểm ngày áp dụng khi ban hành. */
export function previousLiveVersion(
  list: TemplateVersion[],
  version: TemplateVersion
): TemplateVersion | undefined {
  const source = version.previousId
    ? list.find((x) => x.id === version.previousId)
    : undefined;
  if (source && source.effectiveFrom) return source;
  return undefined;
}

/** Bản kế tiếp còn hiệu lực (nháp cũng tính) — có rồi thì không tạo thêm (không rẽ nhánh). */
export function successorOf(
  list: TemplateVersion[],
  version: TemplateVersion
): TemplateVersion | undefined {
  return list.find(
    (x) => x.previousId === version.id && x.status !== "revoked"
  );
}

export type Availability = { ok: true } | { ok: false; reason: string };

const yes: Availability = { ok: true };
const no = (reason: string): Availability => ({ ok: false, reason });

export function canPublish(version: TemplateVersion): Availability {
  if (isEditable(version.status)) return yes;
  if (version.status === "published") return no("Phiên bản này đã ban hành.");
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
  const draft = list.find((x) => isEditable(x.status));
  if (draft) return no(`Đang có ${versionLabel(draft).toLowerCase()} chưa ban hành.`);
  return yes;
}

/**
 * Thu hồi (UC-17): chỉ bản đã ban hành, lần lượt từ bản mới
 * nhất xuống, không phải bản đã ban hành cuối cùng, chuỗi không còn nháp khác.
 */
export function canRevoke(
  list: TemplateVersion[],
  version: TemplateVersion
): Availability {
  if (version.status !== "published")
    return no(
      isEditable(version.status)
        ? "Bản nháp thì xoá, không cần thu hồi."
        : "Phiên bản này không còn dùng được."
    );
  if (list.some((x) => x.id !== version.id && isEditable(x.status)))
    return no("Đang có bản nháp khác — xử lý bản đó trước.");
  if (successorOf(list, version))
    return no("Thu hồi lần lượt từ bản mới nhất xuống.");
  if (
    version.status === "published" &&
    !list.some((x) => x.id !== version.id && x.status === "published")
  )
    return no("Là bản đang áp dụng cuối cùng — hãy tạo phiên bản kế tiếp để thay.");
  return yes;
}

/**
 * Xoá (UC-16): chỉ bản mới nhất của chuỗi. Bản đã được dùng để lập phiếu thì
 * máy chủ từ chối kèm câu báo — màn không biết trước điều đó.
 */
export function canDelete(
  list: TemplateVersion[],
  version: TemplateVersion
): Availability {
  if (list.some((x) => x.previousId === version.id))
    return no("Đã có phiên bản mới hơn — xoá từ bản mới nhất xuống.");
  return yes;
}

/** Xoá biểu: chỉ khi chưa từng có phiên bản rời trạng thái nháp. */
export function canDeleteForm(chain: TemplateVersion[]): Availability {
  if (chain.some((x) => !isEditable(x.status)))
    return no("Biểu đã ban hành nên không xoá được — chỉ khoá biểu được.");
  return yes;
}

/* ------------------------------------------------------------------ */
/* Lịch sử thay đổi của bộ mẫu — dựng từ mốc thời gian có thật trên dữ  */
/* liệu (tạo bộ, tạo biểu, tạo / ban hành / thu hồi phiên bản).        */
/* ------------------------------------------------------------------ */

export function buildChangeLog(
  set: TemplateSet,
  forms: TemplateForm[],
  versions: TemplateVersion[]
): ChangeLogEntry[] {
  const byId = new Map(forms.map((f) => [f.id, f]));
  const entries: ChangeLogEntry[] = [
    {
      id: `set-${set.id}`,
      at: set.createdAt,
      actor: null,
      content: `Tạo bộ mẫu “${set.name}”`,
    },
  ];
  for (const form of forms) {
    entries.push({
      id: `form-${form.id}`,
      at: form.createdAt,
      actor: null,
      content: `Tạo ${formLabelInline(form)}`,
    });
  }
  for (const v of versions) {
    const form = byId.get(v.formId);
    if (!form) continue;
    const of = `${versionLabel(v).toLowerCase()} của ${formLabelInline(form)}`;
    if (v.number > 1) {
      entries.push({ id: `v-${v.id}-c`, at: v.createdAt, actor: null, content: `Tạo ${of}` });
    }
    if (v.publishedAt) {
      entries.push({ id: `v-${v.id}-p`, at: v.publishedAt, actor: v.approver, content: `Ban hành ${of}` });
    }
    if (v.revokedAt) {
      entries.push({ id: `v-${v.id}-r`, at: v.revokedAt, actor: v.revokedBy, content: `Thu hồi ${of}` });
    }
  }
  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/* ------------------------------------------------------------------ */
/* Lỗi từ máy chủ                                                      */
/* ------------------------------------------------------------------ */

const HAS_VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/**
 * Câu báo cho cán bộ từ lỗi API. Máy chủ trả câu tiếng Việt ở `message` (409)
 * hoặc ở `errors` theo từng trường (422). Câu không dấu (lỗi kỹ thuật tiếng
 * Anh) thì thay bằng câu chung `fallback`.
 */
export function errorText(error: unknown, fallback: string): string {
  const e = error as {
    message?: unknown;
    statusCode?: number;
    errors?: Record<string, unknown>;
  } | null;
  if (e?.statusCode === 403) return "Bạn không có quyền làm việc này.";
  if (e?.statusCode === 413)
    return "Bảng tính quá lớn (quá 20MB). Hãy xoá bớt vùng trống, dòng hoặc cột thừa rồi lưu lại.";
  if (e?.errors) {
    for (const value of Object.values(e.errors)) {
      const text = Array.isArray(value) ? value[0] : value;
      if (typeof text === "string" && HAS_VIETNAMESE.test(text)) return text;
    }
  }
  if (typeof e?.message === "string" && HAS_VIETNAMESE.test(e.message))
    return e.message;
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Workbook                                                            */
/* ------------------------------------------------------------------ */

/** Giới hạn máy chủ nhận (UC-11 4b) — kiểm trước để báo ngay, khỏi gửi. */
export const MAX_WORKBOOK_BYTES = 20 * 1024 * 1024;

/** Chuỗi JSON đã lưu → đối tượng workbook; rỗng / "{}" / hỏng → null (bảng trống). */
export function parseWorkbook(json: string | null | undefined): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const sheets = (parsed as { sheets?: unknown }).sheets;
    if (!sheets || typeof sheets !== "object" || Object.keys(sheets).length === 0)
      return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Số byte UTF-8 của chuỗi (đúng thứ máy chủ đếm). */
export function byteLength(text: string): number {
  return new Blob([text]).size;
}

/* ------------------------------------------------------------------ */
/* Ngày                                                                 */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "2026-11-01" theo giờ máy. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

/** "2026-07-01" → "2026-07-02" (ngày hôm sau), để báo ngày sớm nhất được chọn. */
export function nextDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toIsoDate(new Date(y, m - 1, d + 1));
}

/** Ngày 1 của tháng sau — mặc định "Áp dụng từ ngày". */
export function firstOfNextMonth(today = new Date()): string {
  return toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 1));
}

/** Lý do làm mờ Ban hành / Thu hồi khi cả biểu đang khoá. */
export const FORM_LOCKED_REASON = "Biểu đang khoá để sửa — mở khoá biểu rồi mới ban hành hoặc thu hồi.";
