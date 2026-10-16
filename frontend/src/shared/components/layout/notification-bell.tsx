"use client";

import { useState } from "react";
import { Link } from "react-router";
import { BellIcon, CheckCheckIcon } from "lucide-react";

import { useNotifications, type Notification } from "@/shared/hooks/use-notifications";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Separator } from "@/shared/ui/separator";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";

/**
 * The bell in the header: unread count, and the newest notifications behind it.
 *
 * Renders nothing at all for an account without `notifications:read`, rather
 * than an empty dropdown — the same reasoning as the sidebar filtering itself.
 * An empty control reads as a broken feature; an absent one reads as a feature
 * this account does not have.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { enabled, notifications, unreadCount, isLoading, markRead, markAllRead } =
    useNotifications();

  if (!enabled) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label={
            unreadCount > 0
              ? `Thông báo, ${unreadCount} chưa đọc`
              : "Thông báo"
          }
        >
          <BellIcon className="size-4" />
          {unreadCount > 0 && (
            <Badge
              className={cn(
                "absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center",
                "rounded-full px-1 text-[10px] font-semibold tabular-nums",
                "bg-destructive text-destructive-foreground"
              )}
            >
              {/* Past a point the exact number stops being useful and only
                  makes the badge wider than the icon it sits on. */}
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-90 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <span className="text-sm font-semibold">Thông báo</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="-me-2 h-7 gap-1.5 px-2 text-xs font-medium text-primary hover:text-primary"
              onClick={() => void markAllRead()}
            >
              <CheckCheckIcon className="size-3.5" />
              Đánh dấu đã đọc tất cả
            </Button>
          )}
        </div>
        <Separator />

        {isLoading ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Chưa có thông báo nào.
          </p>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="flex flex-col">
              {notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpen={() => {
                    if (!notification.read) void markRead(notification.id);
                    setOpen(false);
                  }}
                />
              ))}
            </ul>
          </ScrollArea>
        )}

        <Separator />
        <Link
          to="/notifications"
          onClick={() => setOpen(false)}
          className="block px-4 py-3 text-center text-[13px] font-medium text-primary hover:underline"
        >
          Xem tất cả thông báo
        </Link>
      </PopoverContent>
    </Popover>
  );
}

// Every colour is a semantic token, so the bell follows the brand preset and
// both themes without knowing either exists. The level rides on the unread dot
// (Figma "Chấm chưa đọc"), so a row keeps its meaning without an icon column.
const LEVEL_DOT = {
  INFO: "bg-info",
  SUCCESS: "bg-success",
  WARNING: "bg-warning",
  ERROR: "bg-destructive",
} as const;

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: () => void;
}) {
  const content = (
    <>
      {/* The dot keeps its slot when read, so every row's text starts on the
          same line whether or not it still has something to say. */}
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          notification.read
            ? "bg-transparent"
            : (LEVEL_DOT[notification.level] ?? "bg-info")
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "truncate text-sm text-foreground",
            notification.read ? "font-normal" : "font-medium"
          )}
        >
          {!notification.read && <span className="sr-only">Chưa đọc: </span>}
          {notification.title}
        </span>
        {notification.body && (
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {notification.body}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {relativeTime(notification.createdAt)}
        </span>
      </span>
    </>
  );

  const className = cn(
    "flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-accent",
    !notification.read && "bg-surface-subtle"
  );

  return (
    <li className="border-b border-border last:border-b-0">
      {/* A notification with somewhere to go is a link; one without is a button
          that only marks it read. Rendering both as a link would leave dead
          navigations in the list. */}
      {notification.link ? (
        <Link to={notification.link} onClick={onOpen} className={className}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} className={className}>
          {content}
        </button>
      )}
    </li>
  );
}

/**
 * "Vừa xong", "5 phút trước", "3 giờ trước", then the date and time as
 * dd/MM/yyyy HH:mm.
 *
 * Past a day the exact moment is what somebody checks a notification against
 * ("was this before or after I submitted?"), so the row stops counting and
 * states it — in the house shape, not the browser locale's.
 */
function relativeTime(iso: string): string {
  const date = new Date(iso);
  const then = date.getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));

  if (seconds < 60) return "Vừa xong";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} giờ trước`;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
