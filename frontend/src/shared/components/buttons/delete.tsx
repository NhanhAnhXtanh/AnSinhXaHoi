"use client";

import React from "react";
import {
  type BaseKey,
  type DeleteOneResponse,
  useDeleteButton,
} from "@refinedev/core";
import { Loader2, Trash } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

type DeleteButtonProps = {
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
  /**
   * Called once the row is gone.
   *
   * Needed wherever the screen the button sits on is *about* the record that
   * was just deleted — a show page has to navigate away, while a list only has
   * to refetch, which Refine already does. Without this the prop would fall
   * into `...rest` and be spread onto the DOM button, where React would warn
   * about it and nothing would call it.
   */
  onSuccess?: (value: DeleteOneResponse) => void;
} & Omit<React.ComponentProps<typeof Button>, "onSuccess">;

export const DeleteButton = React.forwardRef<
  React.ComponentRef<typeof Button>,
  DeleteButtonProps
>(({ resource, recordItemId, accessControl, meta, children, iconOnly, onSuccess, ...rest }, ref) => {
  const {
    hidden,
    disabled,
    loading,
    onConfirm,
    label,
    confirmTitle: defaultConfirmTitle,
    confirmOkLabel: defaultConfirmOkLabel,
    cancelLabel: defaultCancelLabel,
  } = useDeleteButton({
    resource,
    id: recordItemId,
    accessControl,
    meta,
    onSuccess,
  });
  const [open, setOpen] = React.useState(false);

  const isDisabled = disabled || rest.disabled || loading;
  const isHidden = hidden || rest.hidden;

  if (isHidden) return null;

  const confirmCancelText = defaultCancelLabel;
  const confirmOkText = defaultConfirmOkLabel;
  const confirmTitle = defaultConfirmTitle;

  const trigger = (
    <PopoverTrigger asChild>
      {/* The span keeps the trigger clickable while the button is disabled. */}
      <span>
        <Button
          {...rest}
          ref={ref}
          disabled={isDisabled}
          // Icon-only means a table row, where a red button on every row reads
          // as forty warnings rather than one available action — and the row a
          // pointer is actually over is the only one the warning is about. So
          // it is a ghost that goes red on hover and on focus: no less visible
          // at the moment of the click, and no louder before it.
          variant={rest.variant ?? (iconOnly ? "ghost" : "destructive")}
          className={cn(
            iconOnly &&
              !rest.variant && [
                "text-muted-foreground",
                "hover:bg-destructive hover:text-destructive-foreground",
                "focus-visible:bg-destructive focus-visible:text-destructive-foreground",
              ],
            rest.className
          )}
          size={rest.size ?? (iconOnly ? "icon" : undefined)}
          aria-label={rest["aria-label"] ?? (iconOnly ? label : undefined)}
        >
          {loading && (
            <Loader2
              className={cn("h-4 w-4 animate-spin", !iconOnly && "mr-2")}
            />
          )}
          {children ??
            (iconOnly ? (
              !loading && <Trash className="size-4" />
            ) : (
              <div className="flex items-center gap-2 font-semibold">
                <Trash className="h-4 w-4" />
                <span>{label}</span>
              </div>
            ))}
        </Button>
      </span>
    </PopoverTrigger>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {iconOnly ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <PopoverContent className="w-auto" align="start">
        <div className="flex flex-col gap-2">
          <p className="text-sm">{confirmTitle}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {confirmCancelText}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={loading}
              onClick={() => {
                if (typeof onConfirm === "function") {
                  onConfirm();
                }
                setOpen(false);
              }}
            >
              {confirmOkText}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

DeleteButton.displayName = "DeleteButton";
