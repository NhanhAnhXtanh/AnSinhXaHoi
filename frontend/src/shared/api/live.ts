import { Client, type StompSubscription } from "@stomp/stompjs";

import { API_URL } from "./constants";
import { applyAuthorities, getAccessToken, refreshSession } from "./session";

/**
 * The live channel: one STOMP connection, shared by everything that needs push.
 *
 * A module rather than React state, for the same reason `session.ts` is one:
 * the connection outlives any component, and several unrelated parts of the UI
 * subscribe to it. Opening one per component would open one per mount.
 *
 * Only the server speaks. Nothing here sends — the backend rejects a STOMP
 * `SEND` outright — so this is a push channel that happens to be built on a
 * bidirectional transport, chosen for the features on the roadmap that will
 * need the other direction and for the one thing Server-Sent Events cannot do:
 * carry an `Authorization` header.
 */

/** Derived from the REST base rather than configured twice; they are the same server. */
function socketUrl(): string {
  const url = new URL(API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  // API_URL ends in `/api`; the handshake endpoint sits at the application root.
  url.pathname = "/ws";
  return url.toString();
}

/** A destination, minus the `/user` prefix the server resolves per session. */
export const NOTIFICATIONS = "/user/queue/notifications";

/**
 * Where the server pushes this account's grants when they change.
 *
 * Under `auth` rather than a resource name because it needs no permission —
 * every account may be told what it may do, the same rule `/api/auth/*` follows.
 * Requiring a permission to receive your own permissions would be circular.
 */
export const AUTHORITIES = "/user/queue/auth";

type Handler = (body: unknown) => void;

const handlers = new Map<string, Set<Handler>>();
const subscriptions = new Map<string, StompSubscription>();

let client: Client | null = null;
let connected = false;

/**
 * Subscribes to a destination for as long as the returned function is uncalled.
 *
 * Several components may subscribe to the same destination; the STOMP
 * subscription is opened once for the first and closed after the last, so a
 * component mounting twice in React's strict mode does not open two.
 */
export function subscribe(destination: string, handler: Handler): () => void {
  const existing = handlers.get(destination) ?? new Set<Handler>();
  existing.add(handler);
  handlers.set(destination, existing);

  if (connected) {
    open(destination);
  }

  return () => {
    const set = handlers.get(destination);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      handlers.delete(destination);
      subscriptions.get(destination)?.unsubscribe();
      subscriptions.delete(destination);
    }
  };
}

/**
 * Opens the connection, or does nothing if it is already open.
 *
 * Called once the session exists — there is nothing to authenticate with
 * before that, and a socket that connects anonymously would only be refused.
 */
export function connect() {
  if (client || !getAccessToken()) {
    return;
  }

  client = new Client({
    brokerURL: socketUrl(),
    // The one thing that makes STOMP worth the extra layer over a raw
    // WebSocket: the browser cannot put a header on the handshake, but it can
    // put one on the CONNECT frame. The token stays out of the URL, and so out
    // of access logs, browser history and any `Referer`.
    //
    // Read fresh on every attempt rather than captured once, because a
    // reconnect an hour from now must not present the token this session
    // started with.
    beforeConnect: () => {
      const token = getAccessToken();
      client!.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    },
    reconnectDelay: 5_000,
    // Without these a connection dropped by a proxy or a sleeping laptop looks
    // open indefinitely: TCP alone will not notice, so nothing would trigger a
    // reconnect and the user would silently stop receiving anything.
    heartbeatIncoming: 20_000,
    heartbeatOutgoing: 20_000,

    onConnect: () => {
      connected = true;
      // Re-opened rather than assumed to survive: a reconnect is a new session
      // on the server, with no memory of what this client had subscribed to.
      handlers.forEach((_, destination) => open(destination));
    },

    onWebSocketClose: () => {
      connected = false;
      subscriptions.clear();
    },

    /**
     * A STOMP-level error, which the server sends before closing.
     *
     * The common cause is an expired access token at CONNECT: the socket lives
     * for hours, the token for fifteen minutes, so any reconnect after a break
     * presents a dead one. Refreshing here and letting the automatic retry use
     * the new token is what makes that invisible. If the refresh fails the
     * session is genuinely over, and `authProvider` will act on the next
     * request; retrying forever costs nothing but does nothing either.
     */
    onStompError: () => {
      void refreshSession(API_URL);
    },
  });

  // Subscribed here rather than from a component, because permissions have to
  // stay current whether or not anything happens to be rendering. It is
  // registered once and survives reconnects: `onConnect` re-opens every
  // destination in `handlers`, and only `disconnect` clears them.
  //
  // This closes the last gap `X-Auth-Version` leaves. That stamp reaches a
  // client on its next request, which for somebody using the app is seconds
  // away — but a tab left idle sends nothing and so hears nothing. Neither
  // mechanism replaces the other: the header is what still works while this
  // socket is reconnecting or blocked, and because both write the same version
  // stamp, whichever arrives first makes the other a no-op.
  subscribe(AUTHORITIES, (body) => {
    // No request follows. The push carries the grants themselves, not a nudge
    // to go and re-read them, so the update costs nothing beyond the frame.
    applyAuthorities(body);
  });

  client.activate();
}

/**
 * Closes the connection and forgets every subscription.
 *
 * Called on sign-out. Leaving it open would keep delivering to a page that has
 * signed out, and hand the next account a connection authenticated as the
 * previous one.
 */
export function disconnect() {
  handlers.clear();
  subscriptions.clear();
  connected = false;
  void client?.deactivate();
  client = null;
}

function open(destination: string) {
  if (!client || subscriptions.has(destination)) {
    return;
  }
  const subscription = client.subscribe(destination, (message) => {
    let body: unknown;
    try {
      body = JSON.parse(message.body);
    } catch {
      // Not something this application sent. Ignoring it beats letting a parse
      // error take down the handler for every later message.
      return;
    }
    handlers.get(destination)?.forEach((handler) => handler(body));
  });
  subscriptions.set(destination, subscription);
}
