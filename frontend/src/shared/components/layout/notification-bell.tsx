"use client";

import { useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangleIcon,
  BellIcon,
  CheckCheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
} from "lucide-react";

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
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
        >
          <BellIcon className="size-[18px]" />
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

      <PopoverContent align="end" className="w-90 p-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
              onClick={() => void markAllRead()}
            >
              <CheckCheckIcon className="size-3.5" />
              Mark all read
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
            Nothing to catch up on.
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
          className="block px-4 py-2.5 text-center text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          See all notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}

const LEVEL_ICON = {
  INFO: InfoIcon,
  SUCCESS: CircleCheckIcon,
  WARNING: AlertTriangleIcon,
  ERROR: CircleAlertIcon,
} as const;

// Every colour is a semantic token, so the bell follows the brand preset and
// both themes without knowing either exists.
const LEVEL_TONE = {
  INFO: "text-info",
  SUCCESS: "text-success",
  WARNING: "text-warning",
  ERROR: "text-destructive",
} as const;

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: () => void;
}) {
  const Icon = LEVEL_ICON[notification.level] ?? InfoIcon;

  const content = (
    <>
      <Icon className={cn("mt-0.5 size-4 shrink-0", LEVEL_TONE[notification.level])} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "truncate text-sm",
            notification.read ? "font-normal" : "font-semibold"
          )}
        >
          {notification.title}
        </span>
        {notification.body && (
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {notification.body}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">
          {relativeTime(notification.createdAt)}
        </span>
      </span>
      {!notification.read && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
      )}
    </>
  );

  const className = cn(
    "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-accent",
    !notification.read && "bg-primary/[0.04]"
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
 * "just now", "5m ago", "3h ago", "2d ago", then the date.
 *
 * Hand-rolled rather than pulled from `date-fns`, which is already a dependency:
 * this is four thresholds, and the library's `formatDistanceToNow` says "about
 * 1 hour ago" where a notification list wants "1h ago".
 */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
