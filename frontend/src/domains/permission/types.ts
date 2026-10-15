/**
 * The `permissions` resource as the API reports it — `PermissionResponse` on
 * the backend.
 *
 * The catalogue lives here rather than in `domains/role/` because roles are one
 * consumer of it and not its owner: `role/types.ts` re-exports what it needs
 * from this file. The direction matters — a permission means something without
 * any role granting it, a role's grants do not exist without the catalogue.
 */

export type Permission = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  /**
   * True for a code that arrived in a migration alongside the `@PreAuthorize`
   * that checks it, as opposed to one added afterwards. The mirror of
   * `Role.systemRole` — but nothing refuses an edit on the strength of it yet,
   * because the catalogue is read-only over the API in the first place.
   */
  systemPermission: boolean;
};

/** The three actions every `resource:action` code ends in. */
export const PERMISSION_ACTIONS = ["read", "write", "delete"] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/**
 * Splits `resource:action` into its halves so the permission picker can group
 * by resource. Anything without a colon becomes its own group rather than being
 * dropped — a permission the UI cannot categorise is still one an admin needs
 * to be able to grant.
 */
export function splitPermissionCode(code: string): {
  resource: string;
  action: string;
} {
  const separator = code.indexOf(":");
  if (separator === -1) {
    return { resource: code, action: code };
  }
  return {
    resource: code.slice(0, separator),
    action: code.slice(separator + 1),
  };
}

/** `blog_posts` reads better as "Blog posts" in a group heading. */
export function humanizeResource(resource: string): string {
  const spaced = resource.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
