/**
 * The permission vocabulary: how a resource name and a Refine action become the
 * code the API checks.
 *
 * It lives in `shared/` rather than beside the access control provider because
 * two layers ask the same question — `app/providers/access-control.ts` for every
 * button and route guard, and the sidebar for which menu items to offer — and a
 * component in `shared/` may not import from `app/`.
 */

/**
 * Refine's six actions, mapped onto the three the API grants.
 *
 * `clone` needs `write` rather than `read` even though it opens a form
 * pre-filled from an existing record: what it produces is a create.
 */
export const ACTION_TO_PERMISSION: Record<string, "read" | "write" | "delete"> = {
  list: "read",
  show: "read",
  create: "write",
  edit: "write",
  clone: "write",
  delete: "delete",
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
  return suffix ? `${resource}:${suffix}` : null;
}
