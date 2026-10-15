"use client";

import { cn } from "@/shared/lib/utils";
import {
  useBack,
  useResourceParams,
  useUserFriendlyName,
} from "@refinedev/core";
import type { PropsWithChildren } from "react";
import { Breadcrumb } from "@/shared/components/layout/breadcrumb";
import { Button } from "@/shared/ui/button";
import { ArrowLeftIcon } from "lucide-react";

type CreateViewProps = PropsWithChildren<{
  className?: string;
}>;

export function CreateView({ children, className }: CreateViewProps) {
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

type CreateHeaderProps = PropsWithChildren<{
  resource?: string;
  title?: string;
  wrapperClassName?: string;
  headerClassName?: string;
}>;

export const CreateViewHeader = ({
  resource: resourceFromProps,
  title: titleFromProps,
  wrapperClassName,
  headerClassName,
}: CreateHeaderProps) => {
  const back = useBack();

  const getUserFriendlyName = useUserFriendlyName();

  const { resource, identifier } = useResourceParams({
    resource: resourceFromProps,
  });

  // Singular, like `ShowViewHeader` and unlike `ListViewHeader`: this screen is
  // about the one record being written, not about the collection. The plural it
  // used to ask for went unnoticed only because no page rendered this header.
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
          "-ml-2.5",
          headerClassName
        )}
      >
        <Button data-print="hide" variant="ghost" size="icon" onClick={back}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <h1 className="min-w-0 truncate text-3xl font-bold leading-9 tracking-tight">{title}</h1>
      </div>
    </div>
  );
};

CreateView.displayName = "CreateView";
