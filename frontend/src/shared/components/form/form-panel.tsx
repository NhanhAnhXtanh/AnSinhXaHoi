"use client";

import type { PropsWithChildren } from "react";

import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";

/**
 * The panel a full-page form lives in.
 *
 * Every create and edit screen used to put its fields straight onto the page
 * background, which is the one place in this shell where nothing else does:
 * a list is in a panel, a detail record is in a panel, and the form — the only
 * screen where somebody is actually *doing* something — was loose text and
 * inputs floating on a tinted ground with no edge to say where the work began
 * or ended.
 *
 * The panel is not decoration. It is what makes the field column and the save
 * bar read as one object, so the answer to "what happens when I press this"
 * is bounded by something visible.
 *
 * The dialog forms (`blog_posts`) deliberately do not use it: a dialog is
 * already a panel, and putting one inside another draws two edges around the
 * same fields.
 */
export function FormPanel({
  children,
  className,
  contentClassName,
}: PropsWithChildren<{
  className?: string;
  contentClassName?: string;
}>) {
  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <div className={cn("space-y-8 p-6", contentClassName)}>{children}</div>
    </Card>
  );
}

/**
 * The save bar, flush with the bottom of its panel.
 *
 * `-mx-6 -mb-6` pulls it back out of the content padding so its top border and
 * its fill run the full width of the card — a footer inset from the edges
 * reads as another field group rather than as the end of the form.
 *
 * The submit button is always first in the DOM, which is also the reading
 * order and the tab order: the action somebody came here to take should not be
 * something they arrive at after Cancel.
 */
export function FormActions({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "-mx-6 -mb-6 mt-8 flex flex-wrap items-center gap-2",
        "border-t border-border bg-surface-subtle px-6 py-4",
        className
      )}
    >
      {children}
    </div>
  );
}

FormPanel.displayName = "FormPanel";
FormActions.displayName = "FormActions";
