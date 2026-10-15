"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  loading?: boolean;
  children: React.ReactNode;
}

export const LoadingOverlay = React.forwardRef<
  HTMLDivElement,
  LoadingOverlayProps
>(({ className, loading = false, children, ...props }, ref) => {
  /*
    The wrapper is rendered whether or not it is loading, and only the overlay
    layer is toggled.

    Returning `children` bare while idle and a `<div>` around them while loading
    changes the element at this position, so React tears the whole subtree down
    and builds it again every time loading flips. For a form that means every
    field unmounts and re-registers the moment its record arrives — along with
    focus, scroll position and anything else uncontrolled — and it makes a
    screen behave differently depending on whether its data was already cached.
    Both cost more than an always-present wrapper.
  */
  return (
    <div className="relative" ref={ref} {...props}>
      {children}
      {loading ? (
        <div
          className={cn(
            "absolute inset-0 z-50 flex items-center justify-center",
            "bg-background/60",
            className
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      ) : null}
    </div>
  );
});

LoadingOverlay.displayName = "LoadingOverlay";
