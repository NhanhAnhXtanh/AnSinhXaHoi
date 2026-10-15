import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

/**
 * Button.
 *
 * Two things here are deliberate and easy to undo by reflex:
 *
 * **Hover is a colour, not an opacity.** `hover:bg-primary/90` lets whatever
 * is behind the button through, so the same button hovers to one colour on a
 * card and a different one on a table row or a tinted panel. Every solid
 * variant hovers to a real token instead.
 *
 * **The action hierarchy is the variant list.** A screen gets one `default`,
 * any number of `outline`, and `ghost` for anything that is not really an
 * action — a toolbar toggle, an icon in a row. `destructive` is a solid red
 * and belongs to the one button that actually destroys something, never to
 * the Cancel beside it.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md text-sm font-medium",
    "transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    // `outline-none` suppresses the global `:focus-visible` outline from
    // `styles/index.css` — that one is the safety net for anything with no focus
    // treatment of its own, and stacking it under this ring draws two.
    "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-e1 hover:bg-primary-hover",
        destructive:
          "bg-destructive text-destructive-foreground shadow-e1 hover:bg-destructive/90 focus-visible:ring-destructive/40",
        success:
          "bg-success text-success-foreground shadow-e1 hover:bg-success/90",
        outline:
          "border border-input bg-card text-foreground shadow-e1 hover:bg-accent hover:text-accent-foreground dark:bg-transparent",
        secondary:
          "bg-secondary text-secondary-foreground shadow-e1 hover:bg-accent",
        /** A quiet brand-tinted fill, for a repeated action inside a panel. */
        subtle:
          "bg-accent text-accent-foreground hover:bg-accent/70 dark:bg-accent/60 dark:hover:bg-accent",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/60",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        // Square counterparts of `sm` / `lg`, for icon-only buttons that have to
        // line up with text buttons of the same size in a toolbar or a row.
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
