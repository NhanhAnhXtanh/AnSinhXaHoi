"use client";

import type { PropsWithChildren, ReactNode } from "react";

import type { BaseRecord, HttpError } from "@refinedev/core";
import { useResourceParams, useUserFriendlyName } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import {
  DataTableColumnToggle,
  DataTableExport,
  DataTableRefresh,
} from "@/shared/components/data-table/data-table-actions";
import { Breadcrumb } from "@/shared/components/layout/breadcrumb";
import { CreateButton } from "@/shared/components/buttons/create";
import { cn } from "@/shared/lib/utils";

type ListViewProps = PropsWithChildren<{
  className?: string;
}>;

export function ListView({ children, className }: ListViewProps) {
  return (
    <div
      className={cn(
        "flex flex-col",
        "gap-4",
        // Screen entrance. Lives here rather than on a route wrapper so
        // it fires when a screen actually mounts — opening a route dialog
        // over a list leaves the list, and its animation, alone.
        "screen-enter screen-enter-stagger",
        className
      )}
    >
      {children}
    </div>
  );
}

type ListHeaderProps = PropsWithChildren<{
  resource?: string;
  title?: string;
  /**
   * One factual line about what is in the table, under the title.
   *
   * Not decoration: a list screen names a resource in one or two words, and
   * the words are the ones the schema uses rather than the ones a reader has.
   * "Data scopes" and "Permissions" are both true and neither says what a row
   * is or why the two screens are different. Optional, because a resource
   * whose name genuinely says everything gains nothing from a restatement.
   */
  description?: string;
  canCreate?: boolean;
  /** Extra controls beside Create — export, a bulk action, a view switch. */
  actions?: ReactNode;
  headerClassName?: string;
  wrapperClassName?: string;
}>;

export const ListViewHeader = ({
  canCreate,
  resource: resourceFromProps,
  title: titleFromProps,
  description,
  actions,
  wrapperClassName,
  headerClassName,
}: ListHeaderProps) => {
  const getUserFriendlyName = useUserFriendlyName();

  const { resource, identifier } = useResourceParams({
    resource: resourceFromProps,
  });
  const resourceName = identifier ?? resource?.name;

  const isCreateButtonVisible = canCreate ?? !!resource?.create;

  const title =
    titleFromProps ??
    getUserFriendlyName(
      resource?.meta?.label ?? identifier ?? resource?.name,
      "plural"
    );

  const hasActions = isCreateButtonVisible || actions;

  return (
    <div className={cn("flex flex-col", "gap-3", wrapperClassName)}>
      <Breadcrumb />
      {/*
        Title and description are one block and the actions are another, so the
        description flows under the title and stops short of the buttons rather
        than running behind them. `items-start` keeps the action cluster on the
        title's line however many lines the description wraps to.
      */}
      <div
        className={cn(
          "flex",
          "flex-wrap",
          "items-start",
          "justify-between",
          "gap-x-4 gap-y-3",
          headerClassName
        )}
      >
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold leading-9 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-1.5 max-w-3xl text-sm">
              {description}
            </p>
          )}
        </div>
        {hasActions && (
          <div data-print="hide" className="flex shrink-0 items-center gap-2">
            {actions}
            {isCreateButtonVisible && <CreateButton resource={resourceName} />}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * The row between the page header and the table.
 *
 * Three zones, and the split is the point:
 *
 *   `search`   takes the room. It is what gets typed into.
 *   `filters`  sits immediately beside it, because narrowing the table is the
 *              same job as searching it and the two belong to one another.
 *   `actions`  goes against the right edge — refresh, columns, export. These
 *              act on the table as a whole rather than on what it contains, so
 *              they are found rather than reached for, and grouping them apart
 *              is what stops a row of six controls reading as one undifferentiated
 *              strip.
 *
 * Pass `table` and the three standard actions come for free, in that order on
 * every list. `actions` is for the one-off beside them — Notifications' "Mark
 * all read" — and lands to their left.
 *
 * `basis-72` is what makes the row wrap rather than crush: below that width the
 * search takes its own line and the controls drop under it.
 */
export function ListToolbar<TData extends BaseRecord>({
  table,
  search,
  filters,
  actions,
  className,
}: {
  /** Enables the standard Refresh / Columns / Export cluster. */
  table?: UseTableReturnType<TData, HttpError>;
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const hasActions = Boolean(actions) || Boolean(table);
  if (!search && !filters && !hasActions) return null;

  return (
    <div
      data-print="hide"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {search && (
        <div className="min-w-0 flex-1 basis-72 sm:max-w-xl">{search}</div>
      )}
      {filters}
      {hasActions && (
        // Right-aligned only once the row actually holds everything on one
        // line. Wrapped, `ms-auto` would strand the controls against the right
        // edge on their own line with nothing opposite them.
        <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
          {actions}
          {table && (
            <>
              <DataTableRefresh table={table} />
              <DataTableColumnToggle table={table} />
              <DataTableExport table={table} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

ListToolbar.displayName = "ListToolbar";

ListView.displayName = "ListView";
