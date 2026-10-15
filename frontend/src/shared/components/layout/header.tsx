"use client";

import {
  useActiveAuthProvider,
  useGetIdentity,
  useLogout,
  useRefineOptions,
} from "@refinedev/core";
import { useKBar } from "@refinedev/kbar";
import { LogOutIcon, SearchIcon, UserRoundIcon } from "lucide-react";
import { Link } from "react-router";

import { NotificationBell } from "@/shared/components/layout/notification-bell";
import { ThemeCustomizer } from "@/shared/components/theme/theme-customizer";
import { ThemeToggle } from "@/shared/components/theme/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { SidebarTrigger, useSidebar } from "@/shared/ui/sidebar";
import { cn } from "@/shared/lib/utils";

type Identity = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
};

/**
 * Sticky application bar.
 *
 * Frosted rather than opaque, so content scrolling underneath stays faintly
 * visible — the detail that gives the Apex shell its depth.
 */
export function Header() {
  const { isMobile } = useSidebar();
  const { title } = useRefineOptions();

  return (
    <header
      data-slot="app-header"
      className={cn(
        "sticky top-0 z-30 flex h-16 shrink-0",
        "border-b border-border surface-blur"
      )}
    >
      {/*
        The bar itself is full-bleed so its bottom border runs the width of the
        viewport; its contents ride the same column as the page below, which is
        what keeps the search field lined up with the breadcrumb and the table.
      */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-(--shell-max-w) items-center",
          "justify-between gap-3 px-(--shell-gutter-x)"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger
            aria-label="Open menu"
            className="size-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          />

          {/* On mobile the sidebar brand is off-canvas, so restate it here. */}
          {isMobile && (
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground [&_svg]:size-4">
                {title.icon}
              </div>
              <span className="truncate text-sm font-bold tracking-tight">
                {title.text}
              </span>
            </div>
          )}

          <CommandSearch />
        </div>

        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
          <ThemeCustomizer />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

/**
 * Opens the refine command palette (`<RefineKbar />`), the same thing ⌘K does.
 */
function CommandSearch() {
  const { query } = useKBar();

  return (
    <button
      type="button"
      onClick={() => query.toggle()}
      className={cn(
        "relative hidden h-9 w-56 items-center gap-2 rounded-lg lg:w-72",
        "border border-input bg-muted/40 ps-3 pe-3 text-start text-sm",
        "text-muted-foreground transition-colors hover:bg-muted/70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "sm:flex"
      )}
    >
      <SearchIcon className="size-4 shrink-0" />
      <span className="flex-1 truncate">Search anything…</span>
      <kbd
        className={cn(
          "pointer-events-none hidden shrink-0 rounded border border-border bg-muted",
          "px-1.5 py-0.5 font-mono text-[10px] font-medium lg:inline-block"
        )}
      >
        ⌘K
      </kbd>
    </button>
  );
}

function UserMenu() {
  const authProvider = useActiveAuthProvider();
  const { data: user } = useGetIdentity<Identity>();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  if (!authProvider?.getIdentity) return null;

  const name =
    user?.fullName ??
    [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="User menu"
        className={cn(
          "ms-1 rounded-full transition-opacity hover:opacity-80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        <Avatar className="size-9">
          {user?.avatar && <AvatarImage src={user.avatar} alt={name} />}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-52">
        {(name || user?.email) && (
          <>
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{name}</span>
              {user?.email && (
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserRoundIcon className="size-4" />
            <span>Your account</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout()}
          className="text-destructive focus:text-destructive"
        >
          <LogOutIcon className="size-4" />
          <span>{isLoggingOut ? "Logging out…" : "Log out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

Header.displayName = "Header";
