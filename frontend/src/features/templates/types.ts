// Kiểu dữ liệu của phân hệ mẫu biểu.
//
// Hai tầng: kiểu trên dây (Api*) đúng như backend trả về ở /api/template_sets,
// /api/templates, /api/template_versions, và kiểu màn hình dùng (TemplateSet,
// TemplateForm, TemplateVersion) — model.ts chuyển từ tầng này sang tầng kia.
// Ngày dạng ISO ("2026-07-01"), thời điểm dạng ISO có múi giờ; màn tự viết lại
// theo dd/MM/yyyy.

/* ------------------------------------------------------------------ */
/* Trên dây                                                            */
/* ------------------------------------------------------------------ */

export type ApiTemplateStatus =
  | "DRAFT"
  | "TESTING"
  | "PUBLISHED"
  | "LOCKED"
  | "REVOKED"
  | "ARCHIVED";

export type ApiTemplateKind = "CHI_TIET" | "TONG_HOP";

export type ApiTemplateSet = {
  id: number;
  name: string;
  description: string | null;
  templateCount: number;
  inUse: boolean;
  createdAt: string;
  updatedAt: string | null;
};

export type ApiVersionSummary = {
  id: number;
  versionNo: number;
  status: ApiTemplateStatus;
  effectiveFrom: string | null;
};

export type ApiTemplate = {
  id: number;
  /** Mã nội bộ — KHÔNG hiển thị. */
  code: string;
  shortName: string;
  name: string;
  kind: ApiTemplateKind;
  sortOrder: number;
  set: { id: number; name: string };
  versionCount: number;
  currentVersion: ApiVersionSummary | null;
  latestVersion: ApiVersionSummary | null;
  createdAt: string;
  updatedAt: string | null;
};

export type ApiTemplateVersion = {
  id: number;
  template: {
    id: number;
    code: string;
    shortName: string;
    name: string;
    kind: ApiTemplateKind;
    set: { id: number; name: string };
  };
  versionNo: number;
  previousVersionId: number | null;
  status: ApiTemplateStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  /** Chỉ có ở getOne và các thao tác; danh sách để null. */
  workbookJson: string | null;
  scriptText: string | null;
  createdAt: string;
  updatedAt: string | null;
};

/* ------------------------------------------------------------------ */
/* Màn hình                                                            */
/* ------------------------------------------------------------------ */

export type VersionStatus =
  | "draft"
  | "testing"
  | "published"
  | "locked"
  | "revoked"
  | "archived";

export type FormKind = "chi-tiet" | "tong-hop";

export type TemplateSet = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  templateCount: number;
  inUse: boolean;
};

/** Một biểu trong bộ mẫu (resource templates). */
export type TemplateForm = {
  id: string;
  setId: string;
  /** Tên ngắn hiện trên thẻ biểu: "1a", "1b"… */
  name: string;
  /** Tên đầy đủ — dòng phụ dưới tên biểu. */
  title?: string;
  kind: FormKind;
  sortOrder: number;
  createdAt: string;
  /** Phiên bản mới nhất (mọi trạng thái) — để màn thiết kế chuyển tab biểu. */
  latestVersionId: string | null;
};

export type TemplateVersion = {
  id: string;
  formId: string;
  number: number;
  status: VersionStatus;
  /** Bản nguồn khi tạo bằng "phiên bản kế tiếp"; bản đầu chuỗi để null. */
  previousId: string | null;
  /** Ngày áp dụng từ (chỉ có ngày bắt đầu, không có ngày hết hạn). */
  effectiveFrom: string | null;
  /** Hệ thống tự tính từ bản kế sau; null với bản cuối. */
  effectiveTo: string | null;
  publishedAt: string | null;
  approver: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  createdAt: string;
};

export type ChangeLogEntry = {
  id: string;
  at: string;
  actor: string | null;
  content: string;
};
