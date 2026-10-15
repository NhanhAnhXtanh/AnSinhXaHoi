import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * The pieces a record screen is assembled from.
 *
 * Every detail and edit screen in this shell answers the same two kinds of
 * question — *what is this record*, and *what are its fields* — and each of
 * them used to be written out again per page: a local `Field` helper with
 * `text-xs font-medium uppercase tracking-wide` copied verbatim, a card of
 * read-only facts here, a definition list there. The copies drifted, which is
 * how one screen ended up with its labels a step lighter than the next.
 *
 * These are that, named once. They hold no resource knowledge, so a new screen
 * gets the house style by importing rather than by remembering it.
 */

/**
 * One fact that is not a field: a small label with its value beneath.
 *
 * `text-overline` is the shell's one small-caps style, registered with
 * `tailwind-merge` in `shared/lib/utils.ts` — which is what stops a `text-*` class
 * beside it from silently dropping it.
 */
export function MetaItem({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-overline text-muted-foreground">{label}</span>
      <div className="text-sm leading-5 font-medium">{children}</div>
    </div>
  );
}

/**
 * The strip those facts sit in, along the top of a screen.
 *
 * Divided rather than merely spaced: several values in a row with nothing
 * between them read as one sentence broken in odd places, and the hairline is
 * what makes each its own answer. It drops to a wrapped row below `sm`, where
 * a divided line would break mid-item.
 *
 * A strip is what replaced the read-only card that used to sit beside a form —
 * three short facts cost a quarter of the width and the whole of the height
 * there, and one row here.
 */
export function MetaStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-x-6 gap-y-3",
        "sm:divide-border sm:gap-x-0 sm:divide-x",
        "sm:[&>*:not(:first-child)]:pl-5 sm:[&>*:not(:last-child)]:pr-5",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * A panel of fields on a detail screen.
 *
 * The heading is a band on `--surface-subtle` rather than a `CardHeader`: it is
 * the same strip a list panel's toolbar sits on, so a screen made of several of
 * these reads as one system, and it costs a row of ~40px instead of ~70.
 */
export function DetailPanel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  /** A control that belongs to this panel, against the right edge of its band. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex min-w-0 flex-col overflow-hidden",
        "border-border rounded-lg border shadow-e1",
        className
      )}
    >
      <div className="bg-surface-subtle flex items-center gap-3 border-b px-4 py-2.5">
        <h3 className="text-overline text-muted-foreground">{title}</h3>
        {action && <div className="ms-auto">{action}</div>}
      </div>
      <div className={cn("min-w-0", bodyClassName)}>{children}</div>
    </div>
  );
}

/**
 * One labelled row inside a `DetailPanel`.
 *
 * Label in a fixed column on the left, value in the rest: read down the page,
 * the labels line up and the eye only has to travel one column to find the
 * field it wants. Stacked labels — the shape a *form* uses — cost twice the
 * height and read as inputs somebody forgot to fill in.
 *
 * The label column collapses below `sm`, where a fixed 9rem gutter would leave
 * the values in a strip too narrow to hold an email address.
 */
export function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-x-4 gap-y-1 px-4 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)]",
        className
      )}
    >
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

/** The list `DetailRow`s go in, hairlined between rows. */
export function DetailList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl className={cn("divide-border divide-y", className)}>{children}</dl>
  );
}

/** What a field with no value says, so an empty one never reads as a bug. */
export function EmptyValue({ children = "—" }: { children?: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
