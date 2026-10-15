import type { AuthProvider } from "@refinedev/core";

import { API_URL } from "@/shared/api/constants";
import { connect, disconnect } from "@/shared/api/live";
import {
  clearSession,
  getAccessToken,
  getAuthorities,
  getIdentity,
  getRefreshToken,
  loadAuthorities,
  refreshSession,
  revalidateAuthorities,
  saveSession,
  type Identity,
  type TokenPair,
} from "@/shared/api/session";

/**
 * Wires the `/api/auth` endpoints to the hooks Refine calls.
 *
 * This provider is the only place that talks to those endpoints; the token it
 * stores is picked up from `session.ts` by the data provider's request hooks,
 * so no page or resource ever handles a token itself.
 *
 * These calls deliberately use `fetch` rather than the shared ky instance.
 * That instance exists to attach an access token and to recover from a 401 by
 * refreshing — neither of which makes sense for the requests that produce the
 * token in the first place.
 */

/** The error shape `ApiExceptionHandler` produces for every non-2xx response. */
type ApiError = {
  status?: number;
  message?: string;
  errors?: Record<string, string>;
};

async function readError(response: Response, fallback: string): Promise<ApiError> {
  try {
    return (await response.json()) as ApiError;
  } catch {
    // The API always sends a body, so this only happens when something between
    // here and it did not — a proxy, or the server being down.
    return { status: response.status, message: fallback };
  }
}

export const authProvider: AuthProvider = {
  async login({ username, password }) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await readError(response, "Sign in failed");
        return {
          success: false,
          error: {
            name: "LoginError",
            // The API answers every failed sign-in with the same message on
            // purpose; showing it verbatim keeps that property intact.
            message: error.message ?? "Incorrect username or password",
          },
        };
      }

      saveSession((await response.json()) as TokenPair);

      // The token says who you are and nothing more, so what this account may
      // do is a second call. Awaited rather than fired off, because the shell
      // renders its menu the moment this returns success — starting it and not
      // waiting would show every user an empty sidebar for a frame.
      if (!(await loadAuthorities(API_URL))) {
        clearSession();
        return {
          success: false,
          error: {
            name: "LoginError",
            message: "Signed in, but could not load your permissions. Try again.",
          },
        };
      }

      // The live channel needs a token, so it cannot open before now. Opening
      // it here rather than from a component keeps it one connection for the
      // session instead of one per mount.
      connect();
      return { success: true, redirectTo: "/" };
    } catch {
      return {
        success: false,
        error: {
          name: "LoginError",
          message: "Could not reach the server. Check your connection and try again.",
        },
      };
    }
  },

  /**
   * Ends the session on the server, then locally.
   *
   * The local half runs whatever the server said. A logout that reports failure
   * would leave the user looking at a dashboard they believe they have left,
   * which is worse than a refresh token that outlives its use by a few days.
   */
  async logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Offline, or the server is down. Nothing here can fix that, and the
        // token expires on its own.
      }
    }

    // Before clearing the session, because the socket is authenticated as the
    // account that is leaving: left open, it would go on delivering to a page
    // that has signed out, and hand the next account somebody else's channel.
    disconnect();
    clearSession();
    return { success: true, redirectTo: "/login" };
  },

  /**
   * Answers whether the app may render.
   *
   * An expired access token with a live refresh token counts as authenticated:
   * reloading the page after a coffee break should restore the session, not
   * demand the password again. Only a failed refresh signs the user out.
   *
   * This is also where the permissions are guaranteed to be present and
   * current. `<Authenticated>` calls it before rendering anything inside the
   * shell, so by the time the sidebar and the access control provider read
   * their cache it is populated — which is what keeps `can` a synchronous local
   * answer rather than a request per button.
   */
  async check() {
    const signedIn =
      Boolean(getAccessToken()) ||
      (Boolean(getRefreshToken()) && Boolean(await refreshSession(API_URL)));

    if (signedIn) {
      // Reads from the server once per page load and from the cache after
      // that — Refine runs `check` on every window focus, and a request per
      // focus would buy nothing that `X-Auth-Version` has not already
      // delivered. See `revalidateAuthorities` for why the first one still
      // matters.
      //
      // What this must never do is settle for an empty list, because every
      // menu item and every button would then be hidden, which looks exactly
      // like a revoked account.
      const authorities = await revalidateAuthorities(API_URL);
      if (authorities) {
        // Idempotent, and this is the one hook that runs on every page load,
        // so it is where a reloaded tab gets its connection back.
        connect();
        return { authenticated: true };
      }
    }

    clearSession();
    return {
      authenticated: false,
      redirectTo: "/login",
      logout: true,
    };
  },

  /**
   * What to do about an error raised by a data request.
   *
   * A 401 is not handled here: by the time Refine sees one, the ky hook in
   * `data.ts` has already tried to refresh and retry, so a 401 arriving at this
   * point means the refresh failed and the session really is over.
   *
   * A 403 is deliberately *not* a logout. The user is signed in correctly and
   * simply asked for something their role does not cover; signing them out
   * would turn a missing permission into a mysterious ejection.
   */
  async onError(error) {
    if (error?.statusCode === 401 || error?.status === 401) {
      disconnect();
      clearSession();
      return { logout: true, redirectTo: "/login", error };
    }
    return {};
  },

  /**
   * The signed-in identity, served from the cached copy.
   *
   * Cached rather than fetched because it is read on every render of the header
   * and the sidebar, and it is rewritten on every login and token refresh — so
   * it is never more than one access token lifetime stale.
   */
  async getIdentity(): Promise<Identity | null> {
    return getIdentity();
  },

  /**
   * The permission codes the access control provider answers `can` from.
   *
   * Served from the cache `check` filled, so this is a local read even though
   * the codes originally came from `/auth/permissions`.
   *
   * Roles are not returned: nothing in this app authorises on a role name, and
   * offering them here would invite a check that the API would not honour.
   */
  async getPermissions(): Promise<string[]> {
    return getAuthorities()?.permissions ?? [];
  },
};
