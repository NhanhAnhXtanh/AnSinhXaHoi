/**
 * The `roles` resource as the API reports it — `RoleResponse` on the backend.
 *
 * The permission catalogue itself lives in `domains/permission/types.ts`; what
 * is re-exported below is imported from there rather than declared twice, so
 * the role form's picker and the permissions screen cannot drift apart. What
 * stays here is `PermissionSummary`: the *nested* shape a role's payload
 * carries, which is the backend's `RoleResponse.PermissionSummary` and not the
 * permissions endpoint's own response.
 */

export type {
  Permission,
  PermissionAction,
} from "@/domains/permission/types";
export {
  PERMISSION_ACTIONS,
  humanizeResource,
  splitPermissionCode,
} from "@/domains/permission/types";

export type Role = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  /**
   * True for the roles the application itself relies on. The API refuses to
   * delete one or change its code, so the UI does not offer to.
   */
  systemRole: boolean;
  permissions: PermissionSummary[];
};

export type PermissionSummary = {
  id: number;
  code: string;
  name: string;
};
