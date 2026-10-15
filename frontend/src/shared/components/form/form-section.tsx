import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * One group of fields inside a form panel.
 *
 * A form of eight inputs in one column is a list of things to fill in; the same
 * eight under two or three headings is a description of the record being
 * written, and somebody scanning it can skip the part they did not come to
 * change. The headings are the same `text-overline` a table's column headers
 * and a detail panel's band use, so a screen made of these reads as one system.
 *
 * The zone is hairlined from the next rather than merely spaced, because a
 * boundary you can see is what makes "these belong together" a statement rather
 * than an inference from the size of a gap. `last:border-b-0` leaves the panel
 * to draw its own bottom edge — or the save bar to.
 *
 * Fields go in a 12-column grid, so a field's width can say something about
 * what it holds: a status is a word, an email is not.
 */
export function FormSection({
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "border-b border-border px-6 py-5 last:border-b-0",
        className
      )}
    >
      <div className="mb-4 flex flex-col gap-0.5">
        <h3 className="text-overline text-muted-foreground">{title}</h3>
        {description && (
          <p className="text-muted-foreground text-xs leading-5">
            {description}
          </p>
        )}
      </div>
      <div
        className={cn(
          "grid gap-4 md:grid-cols-12 md:gap-x-6",
          contentClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * The panel a sectioned form lives in.
 *
 * `FormPanel` next door is the single-zone version — one padded block of fields
 * — and stays right for a short form. This one draws no padding of its own
 * because every zone inside it carries its own, which is what lets the section
 * hairlines run the full width of the card instead of stopping short of it.
 */
export function SectionedFormPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex min-w-0 flex-col overflow-hidden",
        "border-border rounded-lg border shadow-e1",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * The save bar at the foot of a sectioned panel.
 *
 * On the tinted step rather than on the card, so the end of the form is
 * visible without a second border, and the submit button is first in the DOM —
 * which is the reading order and the tab order both. The action somebody came
 * to take should not be something they arrive at after Cancel.
 *
 * **It draws no top border of its own.** The section above it is not
 * `:last-child` while this is here, so it keeps the bottom border it uses to
 * separate itself from the next section — and a `border-t` here would land
 * directly beneath it as a second hairline.
 */
export function FormSectionActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface-subtle flex flex-wrap items-center gap-3 px-6 py-4",
        className
      )}
    >
      {children}
    </div>
  );
}
