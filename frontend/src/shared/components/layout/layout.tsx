"use client";

import type { CSSProperties, PropsWithChildren } from "react";

import { Header } from "@/shared/components/layout/header";
import { Sidebar } from "@/shared/components/layout/sidebar";
import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar";
import { cn } from "@/shared/lib/utils";

/**
 * How wide the rail is, expanded and collapsed.
 *
 * Exported because anything rendered through a portal — a dialog, a sheet —
 * lands on `document.body`, outside the element carrying `--sidebar-width`, and
 * so cannot read the variable however it is set. Something that wants to span
 * the content column rather than the viewport has to be told, and being told
 * from here is what keeps it in step when these change.
 */
export const SHELL_SIDEBAR_WIDTH = "16rem";

/**
 * Wider than the shadcn default (3rem): the icon rail needs room to breathe
 * once the nav rows are padded like Apex's.
 */
export const SHELL_SIDEBAR_WIDTH_ICON = "4.25rem";

/**
 * Application shell: fixed rail on the left, sticky header, scrolling content.
 *
 * `ThemeProvider` deliberately does not live here — it wraps the whole app in
 * `App.tsx` so the auth screens outside this layout are themed too.
 */
export function Layout({ children }: PropsWithChildren) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": SHELL_SIDEBAR_WIDTH,
          "--sidebar-width-icon": SHELL_SIDEBAR_WIDTH_ICON,
        } as CSSProperties
      }
    >
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50",
          "focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2",
          "focus:text-sm focus:font-medium focus:text-primary-foreground"
        )}
      >
        Skip to content
      </a>

      <Sidebar />

      <SidebarInset className="min-w-0 bg-background">
        <Header />

        <main
          id="main-content"
          className={cn(
            "@container/main",
            "mx-auto flex w-full max-w-(--shell-max-w) flex-1 flex-col",
            // Gutters come from `styles/theme.css` so the header sits on the
            // same column and the spacing tracks the density setting.
            "gap-4 px-(--shell-gutter-x) py-(--shell-gutter-y)"
          )}
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

Layout.displayName = "Layout";
