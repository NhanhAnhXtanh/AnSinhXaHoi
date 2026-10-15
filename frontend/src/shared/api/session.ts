/**
 * Where the signed-in session lives on the client.
 *
 * Two things have to read it and they cannot go through React state: the auth
 * provider (which runs outside the component tree) and the data provider's ky
 * hooks (which run per request). A module holding the tokens is the one place
 * both can reach.
 *
 * `localStorage` rather than a cookie, because the API is a stateless bearer-
 * token service on a different origin: a cookie would not be sent with the
 * `Authorization` header anyway, and making it work would mean re-introducing
 * CSRF as a problem the token design had already removed. The trade-off is the
 * honest one — a script that can run on this page can read the token, so the
 * access token is short-lived and the refresh token is revocable server-side.
 */

import type { API_URL } from "./constants";

/** Keys are namespaced the same way the theme's are, so one glance at devtools tells you what owns what. */
const STORAGE_KEYS = {
  accessToken: "dth-auth-access-token",
  refreshToken: "dth-auth-refresh-token",
  identity: "dth-auth-identity",
  authorities: "dth-auth-authorities",
  authVersion: "dth-auth-version",
} as const;

/**
 * The header every API response carries, stamping what the server currently
 * says this account may do.
 *
 * Stored alongside the permissions it came with, so the data provider can tell
 * from any response whether the cached copy has gone out of date — without
 * asking, and without a connection held open. See `AuthVersionAdvice` on the
 * server for the other half.
 */
export const AUTH_VERSION_HEADER = "X-Auth-Version";

/** The signed-in identity, exactly as `CurrentUserResponse` reports it. */
export type Identity = {
  id: number;
  username: string;
  email: string;
  fullName: string;
};

/**
 * What the account may do, exactly as `GET /auth/permissions` reports it.
 *
 * Kept apart from the identity because it is fetched separately and for a
 * different reason. The access token says who you are and nothing else, so this
 * is the only thing the UI has to go on when deciding what to offer — and
 * keeping it out of the token is what stops every request carrying the whole
 * permission model in a header.
 */
export type Authorities = {
  roles: string[];
  /** Every permission code from every role the user holds, flattened. */
  permissions: string[];
  /**
   * The stamp `X-Auth-Version` carries, sent in the body too.
   *
   * It travels with the codes so that whichever path delivered them — the
   * endpoint, or a push over the socket — also leaves the stored stamp current.
   * Without it a push would update the codes but not the stamp, and the very
   * next response's header would look like a further change and send the client
   * back to re-read what it had just been given.
   */
  version: string;
  /**
   * Resources whose rows are narrowed for this account by a row-level policy.
   *
   * One field, and it exists to answer one question. Somebody holding
   * `tasks:read` with a narrow data scope sees exactly what a system with no
   * data in it looks like — so without this the list says "no records" and the
   * person has no way to tell whether that is the truth or a permissions
   * problem. It is a support ticket waiting to be raised.
   *
   * Absent on a payload from an older API, which is why every read of it
   * tolerates `undefined` rather than assuming an array.
   */
  scopedResources?: string[];
};

/** The token pair as `/api/auth/login` and `/api/auth/refresh` return it. */
export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: Identity;
};

/**
 * Reads and writes are wrapped because storage throws rather than returning
 * null in a few real situations — Safari private browsing, a browser set to
 * block site data, an embedded webview. A session that cannot be persisted
 * should degrade to "signed out", not crash the shell on first paint.
 */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing useful to do: the session simply will not survive a reload.
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // As above.
  }
}

function readJson<T>(key: string): T | null {
  const raw = read(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A half-written or stale-format value is worth exactly as much as none.
    return null;
  }
}

export function getAccessToken(): string | null {
  return read(STORAGE_KEYS.accessToken);
}

export function getRefreshToken(): string | null {
  return read(STORAGE_KEYS.refreshToken);
}

/**
 * The cached identity.
 *
 * Cached so the header and the account menu can render synchronously on first
 * paint instead of flashing a skeleton while `/auth/me` is in flight. It is
 * rewritten on every login and refresh, and it is never the authority on
 * anything.
 */
export function getIdentity(): Identity | null {
  return readJson<Identity>(STORAGE_KEYS.identity);
}

/**
 * The cached roles and permissions.
 *
 * Cached for the same reason the identity is, and it matters more here: Refine
 * asks `can` for every menu item and every action button, so a table of twenty
 * rows would otherwise be dozens of requests. It is refreshed whenever the
 * token pair is, which bounds how stale it can be — and it is only ever used to
 * decide what to *offer*. The API re-checks every code it describes.
 */
export function getAuthorities(): Authorities | null {
  return readJson<Authorities>(STORAGE_KEYS.authorities);
}

/**
 * Whether this account's view of a resource is narrowed by a data scope.
 *
 * Read by the table's empty state, and by nothing that decides access: it
 * changes what a screen *says*, never what it offers. The server has already
 * decided which rows to send.
 */
export function isScopedResource(resource: string | undefined): boolean {
  if (!resource) return false;
  return getAuthorities()?.scopedResources?.includes(resource) ?? false;
}

export function saveSession(tokens: TokenPair) {
  write(STORAGE_KEYS.accessToken, tokens.accessToken);
  write(STORAGE_KEYS.refreshToken, tokens.refreshToken);
  write(STORAGE_KEYS.identity, JSON.stringify(tokens.user));
  // A fetch already in flight belongs to whoever was signed in a moment ago.
  // Sharing it with the account signing in now would hand them somebody else's
  // permissions.
  inFlightAuthorities = null;
}

export function clearSession() {
  remove(STORAGE_KEYS.accessToken);
  remove(STORAGE_KEYS.refreshToken);
  remove(STORAGE_KEYS.identity);
  remove(STORAGE_KEYS.authorities);
  remove(STORAGE_KEYS.authVersion);
  inFlightAuthorities = null;
  // The next session must read its own authorities rather than inherit this
  // one's clean bill of health.
  revalidated = false;
}

/**
 * Notified whenever a load actually changes what this account may do.
 *
 * The cache above is read synchronously and outside React, so nothing re-renders
 * when it is rewritten. Refine caches every `can` answer and the sidebar's
 * `usePermissions` in react-query, which means a role edited mid-session would
 * otherwise sit behind stale query results until the next full page load.
 * `useAuthoritiesSync` subscribes here and invalidates them.
 */
const listeners = new Set<() => void>();

export function subscribeToAuthorities(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Fetches the caller's roles and permissions and caches them.
 *
 * The separate request that pays for the small token. Called before the shell
 * renders on every page load, after signing in, after every token refresh, and
 * after this client writes to `users` or `roles`.
 *
 * Deliberately `fetch` rather than the shared ky instance: that instance
 * recovers from a 401 by refreshing, and a refresh calls this — routing it
 * through there would put the two in a loop.
 *
 * Returns `null` when the call fails. That is "could not ask", not "no
 * permissions": answering an empty list would render an empty shell that looks
 * exactly like a revoked account.
 */
export function loadAuthorities(
  apiUrl: typeof API_URL
): Promise<Authorities | null> {
  // De-duplicated for the same reason `refreshSession` is: a dashboard fires
  // several requests at once, so a version change arrives on several responses
  // at once, and each would otherwise start its own fetch of the same thing.
  inFlightAuthorities ??= fetchAuthorities(apiUrl).finally(() => {
    inFlightAuthorities = null;
  });
  return inFlightAuthorities;
}

let inFlightAuthorities: Promise<Authorities | null> | null = null;

async function fetchAuthorities(apiUrl: string): Promise<Authorities | null> {
  const accessToken = getAccessToken();
  if (!accessToken) return null;

  try {
    const response = await fetch(`${apiUrl}/auth/permissions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return null;
    }

    revalidated = true;
    return applyAuthorities(await response.json());
  } catch {
    return null;
  }
}

/**
 * Stores what the server says this account may do, wherever it came from.
 *
 * The one place authorities are written, so that a payload fetched from
 * `/auth/permissions` and one pushed over the socket land identically — the
 * client should not be able to tell which arrived. The stamp travels inside the
 * payload rather than being read from a response header for exactly that
 * reason: a push has no headers to read.
 *
 * Returns null for anything that is not the expected shape, which is the honest
 * answer for a message this application did not send.
 */
export function applyAuthorities(payload: unknown): Authorities | null {
  const authorities = payload as Authorities | null;
  if (!authorities || !Array.isArray(authorities.permissions)) {
    return null;
  }

  // Compared as text against what was stored last time, so the field order is
  // the server's and stable. Only a real change notifies: this runs on every
  // page load, and invalidating every `can` each time would throw away a cache
  // that is right far more often than not.
  const serialized = JSON.stringify(authorities);
  const changed = read(STORAGE_KEYS.authorities) !== serialized;

  write(STORAGE_KEYS.authorities, serialized);
  // Written together with the codes it describes. Storing them from two
  // different responses would leave a window where the stamp says "current"
  // about codes that are not.
  write(STORAGE_KEYS.authVersion, authorities.version ?? "");

  if (changed) {
    listeners.forEach((listener) => listener());
  }
  return authorities;
}

/**
 * Whether this page load has already read authorities from the server.
 *
 * Module state, so it resets on reload and only on reload — which is exactly
 * the scope wanted.
 */
let revalidated = false;

/**
 * The authorities, read from the server once per page load and from the cache
 * after that.
 *
 * `authProvider.check` is the only caller, and the distinction matters because
 * Refine runs `check` far more often than a page loads: `useIsAuthenticated`
 * has react-query's default `staleTime: 0`, so it re-runs on every window
 * focus and whenever a new observer mounts — and `routes.tsx` mounts
 * `<Authenticated>` twice under the same query key. Fetching on each of those
 * put a request on the wire for no new information.
 *
 * Once per page load is still the right floor, though. It is what makes a
 * reload show the permissions an administrator changed a moment ago, rather
 * than whatever this browser last cached — the bug that made a change need a
 * full sign-out to appear. Between reloads, `X-Auth-Version` on every response
 * is what keeps the cache honest, which is why the calls beyond the first are
 * genuinely redundant rather than merely expensive.
 */
export async function revalidateAuthorities(
  apiUrl: typeof API_URL
): Promise<Authorities | null> {
  if (revalidated) {
    // Nothing cached despite having read once — storage was cleared underneath
    // us. Read again rather than reporting no permissions, which reads as a
    // revoked account.
    return getAuthorities() ?? (await loadAuthorities(apiUrl));
  }

  // Falls back to the cache on a failed request rather than a refused one: a
  // network blip should not sign anyone out. `revalidated` stays false so the
  // next check tries again.
  return (await loadAuthorities(apiUrl)) ?? getAuthorities();
}

/**
 * Acts on the stamp a response carried.
 *
 * Called for every API response. Same stamp as the one held: nothing to do,
 * which is the case almost every time. Different: the grants moved, so re-read
 * them — that reload notifies subscribers, which is what re-renders the menu.
 *
 * A missing header means the response did not come from an authenticated
 * request (a login, or the API behind an old build), and says nothing either
 * way.
 */
export function reconcileAuthVersion(version: string | null, apiUrl: typeof API_URL) {
  if (!version || version === read(STORAGE_KEYS.authVersion)) {
    return;
  }
  // Written before the fetch so that the several responses of one page load do
  // not each queue a reload; `loadAuthorities` will overwrite it with the value
  // that actually accompanied the codes it fetched.
  write(STORAGE_KEYS.authVersion, version);
  void loadAuthorities(apiUrl);
}

/**
 * Exchanges the stored refresh token for a new pair, at most once at a time.
 *
 * The de-duplication is the point. A dashboard fires several list requests at
 * once, so an expired access token produces several simultaneous 401s. Without
 * this, each would try to refresh, and since the server rotates the refresh
 * token on use, the first would succeed and the rest would present a token that
 * had just been burned — signing the user out in the middle of a working
 * session. Sharing one in-flight promise makes that impossible.
 *
 * Returns the new access token, or `null` if the session is over.
 */
let inFlightRefresh: Promise<string | null> | null = null;

export function refreshSession(apiUrl: typeof API_URL): Promise<string | null> {
  inFlightRefresh ??= performRefresh(apiUrl).finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function performRefresh(apiUrl: string): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    // Deliberately `fetch` and not the shared ky instance: that instance is the
    // thing whose 401 handling called us, and routing this through it would put
    // a refresh inside a refresh.
    const response = await fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearSession();
      return null;
    }

    const tokens = (await response.json()) as TokenPair;
    saveSession(tokens);
    // A refresh is the one moment the client is guaranteed to be talking to the
    // server anyway, so it is where a role change catches up. Nothing waits on
    // the result: the request that triggered the refresh should not be held up
    // by a menu that will be right on the next render.
    void loadAuthorities(apiUrl);
    return tokens.accessToken;
  } catch {
    // A network failure is not proof the session ended, but there is no token
    // to carry on with either. Clearing sends the user to the login screen,
    // which is recoverable; leaving a dead token in place is not.
    clearSession();
    return null;
  }
}
