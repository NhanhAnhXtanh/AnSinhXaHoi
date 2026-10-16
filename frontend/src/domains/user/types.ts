/**
 * The `users` resource as the API reports it — `UserResponse` on the backend.
 *
 * Nothing generates this from the Java record, so the two are kept in step by
 * hand; that is the same bargain the rest of the API contract is on.
 */
export type User = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  status: UserStatus;
  roles: RoleSummary[];
  /** Null for an account that has not been placed. */
  organization: OrganizationSummary | null;
  /** Null for an account in no department, placed or otherwise. */
  department: DepartmentSummary | null;
  /**
   * Đơn vị báo cáo ASXH. Có đơn vị ⇒ tài khoản cấp Đơn vị (chỉ thấy phiếu của đơn vị mình);
   * null ⇒ tài khoản Sở / UBND.
   */
  reportUnit: ReportUnitSummary | null;
  createdAt: string;
  updatedAt: string | null;
  lastLoginAt: string | null;
};

/** The role as a user row reports it — no permission list at this depth. */
export type RoleSummary = {
  id: number;
  code: string;
  name: string;
};

/** The organization as a user row reports it. */
export type OrganizationSummary = {
  id: number;
  code: string;
  name: string;
};

/**
 * The department as a user row reports it.
 *
 * <p>No nested organization, unlike the departments resource's own payload: the
 * user row already reports one beside this, and the composite foreign key on
 * `users` means the two cannot differ.
 */
export type DepartmentSummary = {
  id: number;
  code: string;
  name: string;
};

/** Đơn vị báo cáo ASXH như dòng người dùng báo — `UserResponse.ReportUnitSummary`. */
export type ReportUnitSummary = {
  id: number;
  budgetCode: string;
  name: string;
  active: boolean;
};

/**
 * Cấp tài khoản (BR-69.1), suy ra chứ không lưu: có đơn vị ⇒ Đơn vị; không có đơn vị ⇒ UBND
 * nếu giữ vai trò `UBND_APPROVER`, còn lại Sở. Giá trị `don_vi` / `so_ubnd` cũng là ô lọc
 * `accountLevel` của API (API không tách Sở với UBND vì đó là chuyện vai trò).
 */
export type AccountLevel = "don_vi" | "ubnd" | "so";

export const ACCOUNT_LEVEL_LABELS: Record<AccountLevel, string> = {
  don_vi: "Đơn vị",
  ubnd: "UBND",
  so: "Sở",
};

/** Mã vai trò lãnh đạo UBND (seed 165) — tài khoản không gắn đơn vị giữ vai trò này là cấp UBND. */
export const UBND_ROLE_CODE = "UBND_APPROVER";

/** Mã vai trò cán bộ đơn vị nhập liệu (seed 165) — chọn sẵn khi cấp tài khoản cho đơn vị. */
export const UNIT_REPORTER_ROLE_CODE = "ORGANIZATION_REPORTER";

export function accountLevelOf(user: {
  reportUnit: { id: number } | null | undefined;
  roles?: { code: string }[] | null;
}): AccountLevel {
  if (user.reportUnit) return "don_vi";
  return (user.roles ?? []).some((role) => role.code === UBND_ROLE_CODE) ? "ubnd" : "so";
}

/** Mirrors `UserStatus`; these are the lower-case wire values, not the constants. */
export type UserStatus = "active" | "inactive" | "locked";

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  locked: "Locked",
};

export const STATUS_OPTIONS: { label: string; value: UserStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Locked", value: "locked" },
];
