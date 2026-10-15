"use client";

import React from "react";
import { type BaseKey, useShowButton } from "@refinedev/core";
import { Eye } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

type ShowButtonProps = {
  /**
   * Resource name for API data interactions. `identifier` of the resource can be used instead of the `name` of the resource.
   * @default Inferred resource name from the route
   */
  resource?: string;
  /**
   * Data item identifier for the actions with the API
   * @default Reads `:id` from the URL
   */
  recordItemId?: BaseKey;
  /**
   * Access Control configuration for the button
   * @default `{ enabled: true, hideIfUnauthorized: false }`
   */
  accessControl?: {
    enabled?: boolean;
    hideIfUnauthorized?: boolean;
  };
  /**
   * `meta` property is used when creating the URL for the related action and path.
   */
  meta?: Record<string, unknown>;
  /**
   * Drop the text and render a square icon button. The label is not lost — it
   * moves to a tooltip and to `aria-label`, which is what keeps a row of
   * unlabelled icons usable. Defaults the size to `icon`; pass `size` to pick
   * one of the other square sizes.
   */
  iconOnly?: boolean;
} & React.ComponentProps<typeof Button>;

export const ShowButton = React.forwardRef<
  React.ComponentRef<typeof Button>,
  ShowButtonProps
>(
  (
    {
      resource,
      recordItemId,
      accessControl,
      meta,
      children,
      onClick,
      iconOnly,
      ...rest
    },
    ref
  ) => {
    const { hidden, disabled, LinkComponent, to, label } = useShowButton({
      resource,
      id: recordItemId,
      accessControl,
      meta,
    });

    const isDisabled = disabled || rest.disabled;
    const isHidden = hidden || rest.hidden;

    if (isHidden) return null;

    const button = (
      <Button
        {...rest}
        ref={ref}
        disabled={isDisabled}
        // An icon-only action lives in a table row, and a row of solid
        // buttons repeated down forty rows is a column of paint rather than a
        // set of controls — the eye has nothing left to land on. Icon-only
        // therefore defaults to `ghost`: the affordance appears on hover,
        // which is where the pointer already is when it matters. A caller
        // that wants the emphasis back passes `variant` explicitly.
        variant={rest.variant ?? (iconOnly ? "ghost" : undefined)}
        size={rest.size ?? (iconOnly ? "icon" : undefined)}
        aria-label={rest["aria-label"] ?? (iconOnly ? label : undefined)}
        asChild
      >
        <LinkComponent
          to={to}
          replace={false}
          onClick={(e: React.PointerEvent<HTMLButtonElement>) => {
            if (isDisabled) {
              e.preventDefault();
              return;
            }
            if (onClick) {
              e.preventDefault();
              onClick(e);
            }
          }}
        >
          {children ??
            (iconOnly ? (
              <Eye className="size-4" />
            ) : (
              <div className="flex items-center gap-2 font-semibold">
                <Eye className="h-4 w-4" />
                <span>{label}</span>
              </div>
            ))}
        </LinkComponent>
      </Button>
    );

    if (!iconOnly) return button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }
);

ShowButton.displayName = "ShowButton";
