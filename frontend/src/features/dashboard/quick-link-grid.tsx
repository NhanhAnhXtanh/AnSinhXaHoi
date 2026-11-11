import { Link } from "react-router";

import { cn } from "@/shared/lib/utils";

import type { QuickLink } from "./quick-links";

export function QuickLinkGrid({ links, className }: { links: readonly QuickLink[]; className?: string }) {
  return (
    <div className={cn("scrollbar-fade grid min-h-0 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2", className)}>
      {links.map(({ label, to, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className={cn(
            "flex h-14 items-center gap-3 rounded-md border bg-surface-subtle px-3",
            "text-sm font-medium transition-colors hover:bg-accent",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 truncate">{label}</span>
        </Link>
      ))}
    </div>
  );
}
