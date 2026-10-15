"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { Tabs, TabsContent } from "@/shared/ui/tabs";
import { cn } from "@/shared/lib/utils";

/**
 * A segmented control whose selected tab is obvious.
 *
 * The stock primitive separates the two states by a single signal — the active
 * trigger swaps `bg-muted` for `bg-background` — and those two tokens are one
 * step apart on the neutral ramp, so the whole control reads as one flat block.
 * Worse, both states resolve to `text-foreground` in light mode, so the label
 * carries no information either.
 *
 * Four signals here instead of one, which is what makes it legible without any
 * of them having to be loud, and what keeps it legible in both modes:
 *
 *   surface   the active tab is a card, the inactive ones are the track
 *   text      inactive is `muted-foreground`, active is full `foreground`
 *   weight    the active label is semibold
 *   edge      the active tab carries a real border and an elevation
 *
 * The border matters most in dark mode, where the card is *darker* than the
 * track rather than lighter — a raised pill and a recessed one are equally
 * readable as long as the boundary itself is drawn.
 */
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground border-border inline-flex h-9 w-fit items-center justify-center rounded-lg border p-[3px]",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow] outline-none",
        "hover:text-foreground",
        "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:border-border data-[state=active]:font-semibold data-[state=active]:shadow-e2",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:outline-1",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
