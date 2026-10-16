import { Fragment } from "react";
import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { Ellipsis, LoaderCircle } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

export type ActionItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  disabled?: boolean;
  /** Lý do không làm được — hiện thành dòng chữ nhỏ dưới tên mục khi mục bị mờ. */
  reason?: string;
  destructive?: boolean;
  separatorBefore?: boolean;
};

export type PrimaryAction = {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  /** Lý do không bấm được — hiện trong tooltip khi nút bị mờ. */
  reason?: string;
  /** Đang chạy việc: icon thành vòng xoay, nút không bấm được nữa. */
  loading?: boolean;
};

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

/** Một nút thao tác; khi bị mờ và có lý do thì bọc tooltip nói lý do. */
function ActionButton({
  action,
  variant,
  size,
  className,
  iconClassName,
}: {
  action: PrimaryAction;
  variant: ButtonVariant;
  size: ButtonSize;
  className?: string;
  iconClassName?: string;
}) {
  const Icon = action.loading ? LoaderCircle : action.icon;
  const disabled = Boolean(action.disabled || action.loading);

  const button = (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      aria-busy={action.loading || undefined}
      onClick={action.onClick}
    >
      {Icon && (
        <Icon
          aria-hidden
          className={cn(iconClassName, action.loading && "animate-spin")}
        />
      )}
      <span className="truncate">{action.label}</span>
    </Button>
  );

  if (action.disabled && action.reason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Nút bị disabled không nhận con trỏ, nên tooltip bám vào lớp bọc. */}
          <span tabIndex={0} className="inline-flex rounded-md outline-none">
            {button}
          </span>
        </TooltipTrigger>
        <TooltipContent>{action.reason}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

/**
 * Nút ⋯ mở menu thao tác. Mục bị mờ có dòng lý do 12px dưới tên; mục xoá
 * (destructive) chữ đỏ và tự có đường ngăn phía trước.
 */
export function ActionMenu({
  items,
  size = "icon-sm",
  label = "Thao tác khác",
}: {
  items: ActionItem[];
  size?: ButtonSize;
  /** Nhãn đọc cho trình đọc màn hình. */
  label?: string;
}) {
  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={size} aria-label={label}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-62">
        {items.map((item, i) => {
          const prev = items[i - 1];
          const separator =
            i > 0 &&
            (item.separatorBefore ||
              (item.destructive && !prev?.destructive));
          const Icon = item.icon;
          const showReason = Boolean(item.disabled && item.reason);

          return (
            <Fragment key={item.key}>
              {separator && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={item.disabled}
                variant={item.destructive ? "destructive" : "default"}
                className={cn(showReason && "items-start")}
                onSelect={() => item.onSelect?.()}
              >
                {Icon && (
                  <Icon aria-hidden className={cn(showReason && "mt-0.5")} />
                )}
                {showReason ? (
                  <span className="flex min-w-0 flex-col">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground text-xs leading-4">
                      {item.reason}
                    </span>
                  </span>
                ) : (
                  <span>{item.label}</span>
                )}
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

ActionMenu.displayName = "ActionMenu";

/**
 * Thao tác trên một dòng bảng: nút nghiệp vụ nền nhạt rộng cố định (để các
 * dòng thẳng cột) + nút ⋯. Không có `primary` → chỉ nút ⋯ (danh sách quản trị).
 *
 * Chặn sự kiện bấm lan lên dòng, để dòng bấm-được-để-mở không mở theo.
 */
export function RowActions({
  primary,
  items,
  className,
}: {
  primary?: PrimaryAction;
  items: ActionItem[];
  className?: string;
}) {
  return (
    <div
      data-print="hide"
      className={cn("flex items-center justify-end gap-2", className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {primary && (
        <ActionButton
          action={primary}
          variant="secondary"
          size="sm"
          className="w-32 justify-center"
          iconClassName="size-3.5"
        />
      )}
      <ActionMenu items={items} size="icon-sm" />
    </div>
  );
}

RowActions.displayName = "RowActions";

/**
 * Cụm thao tác ở đầu trang / đầu thẻ: [nút phụ viền…] [nút chính nền đặc] [⋯].
 */
export function HeaderActions({
  primary,
  secondary,
  items,
  className,
}: {
  primary?: PrimaryAction;
  secondary?: PrimaryAction[];
  items?: ActionItem[];
  className?: string;
}) {
  return (
    <div
      data-print="hide"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {secondary?.map((action) => (
        <ActionButton
          key={action.label}
          action={action}
          variant="outline"
          size="default"
        />
      ))}
      {primary && (
        <ActionButton action={primary} variant="default" size="default" />
      )}
      {items && items.length > 0 && <ActionMenu items={items} size="icon" />}
    </div>
  );
}

HeaderActions.displayName = "HeaderActions";
