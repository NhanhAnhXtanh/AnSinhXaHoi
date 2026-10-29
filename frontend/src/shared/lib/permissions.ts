/**
 * The permission vocabulary: how a resource name and a Refine action become the
 * code the API checks.
 *
 * It lives in `shared/` rather than beside the access control provider because
 * two layers ask the same question — `app/providers/access-control.ts` for every
 * button and route guard, and the sidebar for which menu items to offer — and a
 * component in `shared/` may not import from `app/`.
 */

/** The suffixes the API grants: the three every resource has, plus `approve`. */
export type PermissionSuffix = "read" | "write" | "delete" | "approve";

/**
 * Refine's six actions, mapped onto the three the API grants.
 *
 * `clone` needs `write` rather than `read` even though it opens a form
 * pre-filled from an existing record: what it produces is a create.
 *
 * `approve` is not a Refine action but a custom one a screen asks about with
 * `useCan({ resource, action: "approve" })` — the ASXH workflows separate the
 * officer who submits from the one who approves (`input_reports:approve`,
 * `annual_reports:approve`). It maps onto itself.
 */
export const ACTION_TO_PERMISSION: Record<string, PermissionSuffix> = {
  list: "read",
  show: "read",
  create: "write",
  edit: "write",
  clone: "write",
  delete: "delete",
  approve: "approve",
};

/**
 * Màn ASXH mà tên resource ở frontend khác tên resource REST ở backend.
 *
 * Quy tắc chung vẫn là "suy ra, không tra bảng": `report_units:read` là đúng
 * tên resource. Bảng này chỉ dành cho các màn nghiệp vụ không phải CRUD của một
 * resource — "Duyệt phiếu nhập" là một cách nhìn khác của `input_reports`,
 * "Thiết lập & điều hành" làm việc trên `period_assignments`… Giữ bảng ngắn: màn
 * nào trùng tên resource backend thì KHÔNG thêm vào đây.
 *
 * - `resource`: nửa đầu mã quyền backend.
 * - `read`: hậu tố cần để MỞ màn (list/show), khi khác `read`. "Nhập liệu báo
 *   cáo" mở bằng `input_reports:write` để cán bộ Sở chỉ có quyền xem/duyệt
 *   không thấy mục nhập; "Duyệt phiếu nhập" mở bằng `input_reports:approve`.
 *   Các hành động còn lại (create/edit/delete/approve) vẫn theo hậu tố chuẩn.
 *
 * Mã quyền thật seed ở `backend/.../db/changelog/changes/` (101, 103, 111, 122,
 * 165, 168) và kiểm bằng `@PreAuthorize` trong `module/asxh/<slice>/security/<Tên>Permissions.java`.
 */
const SCREEN_PERMISSIONS: Record<
  string,
  { resource: string; read?: PermissionSuffix }
> = {
  input_reports: { resource: "input_reports", read: "write" },
  report_review: { resource: "input_reports", read: "approve" },
  period_setup: { resource: "period_assignments" },
  publication_history: { resource: "publications" },
  report_calendar: { resource: "report_calendars" },
  summary: { resource: "summary" },
  annual_review: { resource: "annual_reports" },
  // "Bản chất chỉ tiêu" — danh mục chỉ tiêu (gom từ số liệu đã duyệt) kèm bản chất đã khai ở
  // `indicator_measures` (seed 168).
  measure_kinds: { resource: "indicator_measures" },
};

/**
 * Resources that are declared for the sake of routing and the sidebar, and have
 * no permission code behind them.
 *
 * The dashboard is a screen, not a resource: no endpoint, no rows, nothing the
 * API guards. Deriving `dashboard:read` for it would invent a permission that
 * protects nothing — and, because that code is in no migration and in no role,
 * `useAccessibleMenuItems` would hide the item from every account including the
 * administrator. The same reasoning exempts `/user/queue/auth` on the WebSocket
 * side: requiring a grant to reach something that grants nothing is circular.
 *
 * Keep this list short. An entry here is a screen the UI offers to anyone
 * signed in, so anything it does show has to be safe for anyone signed in —
 * which in practice means it must not read a guarded resource. The moment the
 * dashboard starts pulling counts out of `blog_posts` or `users`, those reads
 * are `useList` calls that carry their own permission checks, and the tiles
 * around them need gating with `useCan` rather than an entry here.
 */
const UNGUARDED_RESOURCES = new Set(["dashboard"]);

/**
 * The permission code a resource and action need, or `null` where no code
 * applies — a route-less grouping node, an unguarded screen, or an action
 * nobody has defined one for.
 *
 * The sidebar filters the menu with it. `useMenu` does not consult access
 * control at all: it only drops items marked `meta.hide` or with neither a list
 * route nor children. Without this the Administration section would be offered
 * to everyone and the API would answer 403 on arrival.
 */
export function permissionFor(
  resource: string | undefined,
  action: string
): string | null {
  if (!resource || UNGUARDED_RESOURCES.has(resource)) return null;
  const suffix = ACTION_TO_PERMISSION[action];
  if (!suffix) return null;

  const screen = SCREEN_PERMISSIONS[resource];
  if (!screen) return `${resource}:${suffix}`;
  return `${screen.resource}:${suffix === "read" ? (screen.read ?? "read") : suffix}`;
}
