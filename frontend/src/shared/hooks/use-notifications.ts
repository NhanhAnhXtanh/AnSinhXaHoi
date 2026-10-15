import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCan, useNotification } from "@refinedev/core";

import { NOTIFICATIONS, subscribe } from "@/shared/api/live";
import { kyInstance } from "@/shared/api/data";

/**
 * The bell's data: the newest notifications, the unread count, and the live
 * channel that keeps both current.
 *
 * Read over HTTP and kept current over the WebSocket, in that order and never
 * the other way round. The list is the authority — it comes from the rows,
 * which is what somebody offline when a notification was raised sees on their
 * next sign-in — and the socket only saves them from having to ask again.
 * Treating the socket as the source would mean anything that arrived while it
 * was reconnecting simply never existed.
 */

export type Notification = {
  id: number;
  level: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

const RECENT_KEY = ["notifications", "recent"];
const UNREAD_KEY = ["notifications", "unread"];

/**
 * Goes through the shared ky instance rather than `fetch`, so these requests
 * get the bearer token, the 401-refresh-and-retry, and the `X-Auth-Version`
 * check that every other data request gets.
 */
async function get<T>(path: string): Promise<T> {
  // Relative, and without a leading slash: the instance already carries the
  // API base as its `prefixUrl`, and ky prepends it to whatever it is given — an
  // absolute URL included. Passing one produced
  // `http://localhost:8080/api/http://localhost:8080/api/notifications/recent`,
  // which the browser refused at the CORS preflight, so the bell never loaded.
  return kyInstance.get(`notifications/${path}`).json<T>();
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { open } = useNotification();

  // The bell is hidden outright for an account without the permission, rather
  // than rendered empty. `notifications:read` is granted to every system role,
  // so this only bites on a custom role that leaves it out — but an empty bell
  // would look like a bug rather than a decision.
  const { data: canRead } = useCan({ resource: "notifications", action: "list" });
  const enabled = canRead?.can ?? false;

  const recent = useQuery({
    queryKey: RECENT_KEY,
    queryFn: () => get<Notification[]>("recent"),
    enabled,
  });

  const unread = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () => get<{ unread: number }>("unread-count"),
    enabled,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  useEffect(() => {
    if (!enabled) return;

    return subscribe(NOTIFICATIONS, (body) => {
      const arrived = body as Notification;

      // Prepended rather than refetched. The row is already in hand, so asking
      // the server for a list that is about to say the same thing would put a
      // request in the path of every notification — which is the cost this
      // channel exists to avoid.
      queryClient.setQueryData<Notification[]>(RECENT_KEY, (current) => {
        const rest = (current ?? []).filter((n) => n.id !== arrived.id);
        return [arrived, ...rest].slice(0, 20);
      });
      queryClient.setQueryData<{ unread: number }>(UNREAD_KEY, (current) => ({
        unread: (current?.unread ?? 0) + 1,
      }));

      // The same toast the rest of the app uses, so a notification looks like
      // everything else that has ever appeared in that corner.
      open?.({
        type: arrived.level === "ERROR" || arrived.level === "WARNING" ? "error" : "success",
        message: arrived.title,
        description: arrived.body ?? undefined,
        key: `notification-${arrived.id}`,
      });
    });
  }, [enabled, queryClient, open]);

  const markRead = useCallback(
    async (id: number) => {
      await kyInstance.post(`notifications/${id}/read`);
      refresh();
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    await kyInstance.post(`notifications/read-all`);
    refresh();
  }, [refresh]);

  return {
    enabled,
    notifications: recent.data ?? [],
    unreadCount: unread.data?.unread ?? 0,
    isLoading: recent.isLoading,
    markRead,
    markAllRead,
    refresh,
  };
}
