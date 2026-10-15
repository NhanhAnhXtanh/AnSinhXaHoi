import type { AccessControlProvider } from "@refinedev/core";

import { getAuthorities } from "@/shared/api/session";
import { ACTION_TO_PERMISSION, permissionFor } from "@/shared/lib/permissions";

/**
 * Decides what the UI offers, from the permissions fetched at sign-in.
 *
 * The access token carries none: `authProvider.check` fetches them from
 * `/auth/permissions` before the shell renders and caches them in `session.ts`,
 * so every question here is answered from that cache. Refine calls `can` for
 * every menu item, every action button and every `<CanAccess>` boundary — a
 * table of twenty rows with four action buttons each would otherwise be eighty
 * authorisation requests.
 *
 * This hides things; it does not protect them. Every endpoint re-checks the
 * same permission with `@PreAuthorize`, so a hand-edited URL or a devtools
 * console gets a 403 rather than a result. That is deliberate: this layer
 * exists to keep the UI honest about what the user can do, not to enforce it.
 *
 * Two questions are answered here, in order. The permission code decides
 * whether the resource is reachable at all; the `_can` flags the API stamps on
 * each row decide whether *that row* can be edited or deleted. The second is
 * likewise only a hint — the server answers a write outside the caller's data
 * scope with a 422 regardless of which buttons were rendered.
 */

export const accessControlProvider: AccessControlProvider = {
  async can({ resource, action, params }) {
    const permissions = getAuthorities()?.permissions;

    // Nothing cached means the session is gone. `<Authenticated>` is already
    // redirecting to the login screen; answering "no" here just avoids
    // flashing a full menu on the way out.
    if (!permissions) {
      return { can: false };
    }

    // A route-less grouping node (the "Content" section header) has no resource
    // of its own to authorise. Refusing it would hide the whole section even
    // when its children are visible.
    if (!resource) {
      return { can: true };
    }

    // The permission code is the resource name and the action, joined — which
    // is why the backend's codes use the resource names verbatim. There is no
    // mapping table here to drift out of step with the seed data.
    const required = permissionFor(resource, action);
    if (!required) {
      // An action nothing has defined a permission for. Allowing it keeps a
      // custom action from silently disappearing; the API still decides.
      return { can: true };
    }

    if (!permissions.includes(required)) {
      return { can: false, reason: `You need the ${required} permission` };
    }

    // Row-level scope. Two layers, asked in order: the permission above decides
    // whether the endpoint answers at all, and this decides whether it would
    // answer for *this row*.
    //
    // Only asked when there is a record in hand — every `*Button` passes one —
    // and never for `read`, because a row the caller may not read was never in
    // the response to begin with. There is nothing here to hide.
    const record = params?.resource as
      | { _can?: Record<string, boolean> }
      | undefined;
    const rowAction = ACTION_TO_PERMISSION[action];

    if (record?._can && rowAction && rowAction !== "read") {
      // Absent rather than false means the server did not report flags for this
      // resource — it is unmanaged, or an association a policy needs was not
      // fetched. Either way the permission above is the whole answer, and
      // refusing here would hide a button that works.
      const allowed = record._can[rowAction];
      if (allowed === false) {
        return { can: false, reason: "This record is outside your data scope" };
      }
    }

    return { can: true };
  },

  options: {
    buttons: {
      // Hide rather than disable. A disabled button invites the user to work
      // out why; an action their role does not include is not something they
      // are missing a step towards.
      enableAccessControl: true,
      hideIfUnauthorized: true,
    },
  },
};
