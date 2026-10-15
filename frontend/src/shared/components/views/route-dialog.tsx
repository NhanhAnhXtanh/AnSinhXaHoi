"use client";

import type { PropsWithChildren, ReactNode } from "react";
import { useGo, useListButton } from "@refinedev/core";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { useConfirmDiscard } from "@/shared/components/form/unsaved-changes-guard";
import { cn } from "@/shared/lib/utils";

type RouteDialogProps = PropsWithChildren<{
  /** Heading of the dialog. */
  title: ReactNode;
  /**
   * Sub-heading. Always rendered: Radix uses it to describe the dialog to
   * screen readers and warns when it is missing.
   */
  description: ReactNode;
  /** Action row pinned below the scrollable body. */
  footer?: ReactNode;
  /** Extra classes for the dialog surface (e.g. a wider `sm:max-w-*`). */
  className?: string;
  /** Extra classes for the scrollable body. */
  bodyClassName?: string;
}>;

/**
 * A dialog that *is* a route.
 *
 * The `create` / `edit` / `show` / `clone` routes of a resource are nested
 * under its `list` route (see `routes.tsx`), so the table stays mounted behind
 * the overlay and its filters, sorting and pagination survive the round trip.
 *
 * Because the dialog is the route, every way of dismissing it — the close
 * button, `Esc`, a click on the overlay, or a `<DialogClose>` inside `footer` —
 * navigates back to the list instead of flipping local state. The navigation
 * replaces the current entry, so `Back` returns to wherever the user was before
 * opening the dialog rather than re-opening it.
 *
 * That `replace` is also why the dismissal has to ask about unsaved changes
 * itself. `UnsavedChangesGuard` watches the history navigator's `push` and `go`,
 * which is every ordinary navigation, and deliberately leaves `replace` alone —
 * it is what `syncWithLocation` and the `<Navigate replace>` redirects ride on,
 * so guarding it would fire on a list syncing its own query string behind this
 * very dialog. `useConfirmDiscard` is the dismissal saying it is a dismissal.
 * With no unsaved edits it runs straight through.
 */
export function RouteDialog({
  title,
  description,
  footer,
  className,
  bodyClassName,
  children,
}: RouteDialogProps) {
  const go = useGo();
  const { to: listUrl } = useListButton({});
  const confirmDiscard = useConfirmDiscard();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          confirmDiscard(() => go({ to: listUrl, type: "replace" }));
        }
      }}
    >
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          "max-h-[85dvh] sm:max-w-2xl",
          className
        )}
      >
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className={cn("flex-1 overflow-y-auto px-6 py-5", bodyClassName)}>
          {children}
        </div>

        {footer ? (
          <DialogFooter className="border-t px-6 py-4">{footer}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

RouteDialog.displayName = "RouteDialog";
