"use client";

import type { PropsWithChildren } from "react";

import { ArrowLeftIcon } from "lucide-react";
import {
  useBack,
  useNavigation,
  useResourceParams,
  useUserFriendlyName,
} from "@refinedev/core";
import { Breadcrumb } from "@/shared/components/layout/breadcrumb";
import { Button } from "@/shared/ui/button";
import { RefreshButton } from "@/shared/components/buttons/refresh";
import { cn } from "@/shared/lib/utils";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";

type ShowViewProps = PropsWithChildren<{
  className?: string;
}>;

export function ShowView({ children, className }: ShowViewProps) {
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

type ShowViewHeaderProps = PropsWithChildren<{
  resource?: string;
  title?: string;
  wrapperClassName?: string;
  headerClassName?: string;
}>;

export const ShowViewHeader = ({
  resource: resourceFromProps,
  title: titleFromProps,
  wrapperClassName,
  headerClassName,
}: ShowViewHeaderProps) => {
  const back = useBack();
  const { list } = useNavigation();

  const getUserFriendlyName = useUserFriendlyName();

  const { resource, identifier } = useResourceParams({
    resource: resourceFromProps,
  });
  const { id: recordItemId } = useResourceParams();

  const resourceName = resource?.name ?? identifier;

  const title =
    titleFromProps ??
    getUserFriendlyName(
      resource?.meta?.label ?? identifier ?? resource?.name,
      "singular"
    );

  return (
    <div className={cn("flex flex-col", "gap-4", wrapperClassName)}>
      <Breadcrumb />
      <div
        className={cn(
          "flex",
          "gap-1",
          "items-center",
          "justify-between",
          "-ml-2.5",
          headerClassName
        )}
      >
        <div className="flex min-w-0 items-center gap-1">
          <Button data-print="hide" variant="ghost" size="icon" onClick={back}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <h1 className="min-w-0 truncate text-3xl font-bold leading-9 tracking-tight">{title}</h1>
        </div>

        {/*
          Every button here hides itself when the account lacks the permission
          behind it, through `options.buttons.hideIfUnauthorized`. That is the
          same mechanism the list's action column relies on, and it is why this
          header needs no per-resource configuration: a read-only resource such
          as `permissions` seeds no `permissions:write` or `permissions:delete`
          code, so Edit and Delete simply do not appear on it.

          `meta.canDelete` in `app/resources` is deliberately *not* consulted. It
          is a Refine type with no runtime consumer in this UI layer, and the
          list views already ignore it — honouring it only here would give the
          same resource a Delete on its table and none on its detail page.
        */}
        <div data-print="hide" className="flex shrink-0 items-center gap-2">
          <RefreshButton
            variant="outline"
            recordItemId={recordItemId}
            resource={resourceName}
          />
          {/*
            Edit is the page's primary action and carries the only solid fill
            in the cluster. Before this, Refresh and Edit were both outlines
            and Delete was a solid red — which made the loudest control on a
            detail screen the one that destroys the record being read.
          */}
          <EditButton recordItemId={recordItemId} resource={resourceName} />
          {/*
            Unlike the one in a list row, this delete has to navigate. The
            screen it sits on is *about* the record it just removed, so staying
            put would leave the detail of a row that no longer exists — and the
            refetch that follows the invalidation would turn it into a 404.
          */}
          <DeleteButton
            variant="outline"
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            recordItemId={recordItemId}
            resource={resourceName}
            onSuccess={() => {
              if (resourceName) list(resourceName);
            }}
          />
        </div>
      </div>
    </div>
  );
};

ShowView.displayName = "ShowView";
