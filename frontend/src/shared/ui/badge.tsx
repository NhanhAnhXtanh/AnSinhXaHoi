import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

/**
 * Status chip.
 *
 * The variants come in two families and they are not interchangeable:
 *
 *   - **Solid** (`default`) — a brand fill under its own foreground. One per
 *     screen at most; it reads as "this is the thing", which stops being true
 *     the moment a column is full of them.
 *   - **Subtle** (`success`, `warning`, `info`, `destructive`, `neutral`,
 *     `gold`) — a wash with a dark label of the same hue. This is the family a
 *     table column of statuses wants: legible at a glance, and quiet enough
 *     that fifty rows of them are still a table rather than a paint chart.
 *
 * A solid fill for every status is what makes a business list unreadable, so
 * the subtle family is the default answer and `default` is the exception.
 *
 * `dot` prefixes a filled circle in the chip's own colour. It is what carries
 * the status for anyone who cannot separate the hues — colour alone is never
 * the only signal, and the label is always there beside it.
 */
const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1.5",
    "rounded-full border font-medium whitespace-nowrap",
    "[&>svg]:pointer-events-none [&>svg]:size-3",
    "transition-colors overflow-hidden",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  ],
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary-hover",
        secondary:
          "border-transparent bg-neutral-subtle text-neutral-text [a&]:hover:bg-neutral-subtle/70",
        neutral:
          "border-transparent bg-neutral-subtle text-neutral-text [a&]:hover:bg-neutral-subtle/70",
        success:
          "border-transparent bg-success-subtle text-success-text [a&]:hover:bg-success-subtle/70",
        warning:
          "border-transparent bg-warning-subtle text-warning-text [a&]:hover:bg-warning-subtle/70",
        info: "border-transparent bg-info-subtle text-info-text [a&]:hover:bg-info-subtle/70",
        destructive:
          "border-transparent bg-destructive-subtle text-destructive-text [a&]:hover:bg-destructive-subtle/70",
        // The one loud red, for a count that has to be seen from across the
        // room — an unread badge on the bell, not a status in a column.
        solidDestructive:
          "border-transparent bg-destructive text-destructive-foreground",
        gold: "border-transparent bg-gold-subtle text-gold-text",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px] leading-4",
        default: "px-2.5 py-0.5 text-xs leading-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/** The dot's fill, per variant — the saturated step of the chip's own hue. */
const DOT_COLOR: Record<string, string> = {
  default: "bg-primary-foreground",
  secondary: "bg-neutral",
  neutral: "bg-neutral",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
  solidDestructive: "bg-destructive-foreground",
  gold: "bg-gold-500",
  outline: "bg-muted-foreground",
};

function Badge({
  className,
  variant,
  size,
  dot,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    /** Prefix a filled dot in this chip's colour. */
    dot?: boolean;
  }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {/* `asChild` hands the whole chip to a single element — a link, a
          button — so there is nowhere to put a sibling dot without breaking
          Slot's one-child contract. */}
      {dot && !asChild && (
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            DOT_COLOR[variant ?? "default"]
          )}
        />
      )}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
