"use client";

import React from "react";
import {
  useMenu,
  useLink,
  useRefineOptions,
  useActiveAuthProvider,
  useGetIdentity,
  useLogout,
  usePermissions,
  type TreeMenuItem,
} from "@refinedev/core";
import {
  ChevronRight,
  ListIcon,
  LogOutIcon,
  PanelLeftIcon,
  UserRoundIcon,
} from "lucide-react";
import { Link } from "react-router";
import { permissionFor } from "@/shared/lib/permissions";

import {
  Sidebar as ShadcnSidebar,
  SidebarContent as ShadcnSidebarContent,
  SidebarFooter as ShadcnSidebarFooter,
  SidebarHeader as ShadcnSidebarHeader,
  SidebarRail as ShadcnSidebarRail,
  useSidebar as useShadcnSidebar,
} from "@/shared/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib/utils";

type Identity = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
};

/* --------------------------------------------------------------------------
   Shared class recipes. Every nav row — link, collapsible trigger, dropdown
   trigger — goes through `navRowClass` so the three stay visually identical.
   -------------------------------------------------------------------------- */

function navRowClass({
  isSelected,
  isCollapsed,
}: {
  isSelected?: boolean;
  isCollapsed?: boolean;
}) {
  return cn(
    "group/nav relative flex w-full items-center gap-3 rounded-md",
    "text-sm font-medium transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    isCollapsed ? "h-10 justify-center px-0" : "px-3 py-2",
    isSelected
      ? [
          // The active row is a solid pill in the rail's own hover colour, and
          // the *icon* carries the accent rather than the label. Tinting the
          // label instead is what makes an active row read as a link rather
          // than a position — and on the light rail there is no accent that
          // stays legible as body text on a pale surface anyway.
          "bg-sidebar-accent text-sidebar-accent-foreground",
          "[&_svg]:text-sidebar-primary",
          // The tick in the gutter. It is what survives the row being read
          // peripherally, when the fill is too quiet to register.
          "before:absolute before:inset-y-1.5 before:left-0 before:w-[3px]",
          "before:rounded-r-full before:bg-sidebar-primary",
          isCollapsed && "before:inset-y-2",
        ]
      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
  );
}

function getDisplayName(item: TreeMenuItem) {
  return item.meta?.label ?? item.label ?? item.name;
}

function getIcon(item: TreeMenuItem) {
  return item.meta?.icon ?? item.icon ?? <ListIcon />;
}

/* --------------------------------------------------------------------------
   Access control. `useMenu` does not apply it — it only drops items marked
   `meta.hide` or with neither a list route nor children — so the filtering
   happens here, against the same permission codes the access control provider
   answers `can` from.
   -------------------------------------------------------------------------- */

/**
 * The menu tree with everything this account cannot reach removed.
 *
 * A leaf survives if its list permission is held. A section header survives if
 * anything under it did, which is what makes the whole Administration group
 * disappear for an account with no admin permissions rather than leaving an
 * empty heading behind.
 *
 * With no access control provider configured, `permissions` is undefined and
 * nothing is filtered — the shell stays usable in an app that has not opted
 * into any of this.
 */
function useAccessibleMenuItems(items: TreeMenuItem[]): TreeMenuItem[] {
  const { data: permissions } = usePermissions<string[]>({});

  return React.useMemo(() => {
    if (!permissions) return items;

    const filter = (nodes: TreeMenuItem[]): TreeMenuItem[] =>
      nodes.flatMap((node) => {
        const children = filter((node.children ?? []) as TreeMenuItem[]);
        if (children.length > 0) {
          return [{ ...node, children }];
        }
        // A node with no surviving children is only kept if it is a real
        // destination in its own right and this account may open it.
        if (!node.route) return [];

        const required = permissionFor(node.name, "list");
        return !required || permissions.includes(required) ? [node] : [];
      });

    return filter(items);
  }, [items, permissions]);
}

/* --------------------------------------------------------------------------
   Sidebar
   -------------------------------------------------------------------------- */

export function Sidebar() {
  const { open, isMobile } = useShadcnSidebar();
  const { menuItems, selectedKey } = useMenu();
  const visibleItems = useAccessibleMenuItems(menuItems);
  const isCollapsed = !open && !isMobile;

  return (
    <ShadcnSidebar
      collapsible="icon"
      className="border-none"
      data-slot="app-sidebar"
    >
      <ShadcnSidebarRail />
      <SidebarBrand />

      <ShadcnSidebarContent
        className={cn(
          "scrollbar-fade gap-3 overflow-x-hidden border-r border-sidebar-border py-4",
          isCollapsed ? "px-2" : "px-3"
        )}
      >
        {visibleItems.map((item: TreeMenuItem) => (
          <SidebarItem
            key={item.key || item.name}
            item={item}
            selectedKey={selectedKey}
            isCollapsed={isCollapsed}
          />
        ))}
      </ShadcnSidebarContent>

      <SidebarUser isCollapsed={isCollapsed} />
    </ShadcnSidebar>
  );
}

/* --------------------------------------------------------------------------
   Brand block — mirrors the header height so the two rules line up.
   -------------------------------------------------------------------------- */

function SidebarBrand() {
  const { title } = useRefineOptions();
  const { open, isMobile, toggleSidebar } = useShadcnSidebar();
  const isCollapsed = !open && !isMobile;

  return (
    <ShadcnSidebarHeader
      className={cn(
        "h-16 shrink-0 flex-row items-center gap-3 overflow-hidden",
        "border-b border-r border-sidebar-border p-0",
        isCollapsed ? "justify-center px-2" : "px-4"
      )}
    >
      {/* Collapsed, the logo doubles as the way back out of the icon rail —
          otherwise only the hairline rail or Ctrl/Cmd+B can expand it. */}
      <BrandMark
        icon={title.icon}
        isCollapsed={isCollapsed}
        onExpand={toggleSidebar}
      />

      {!isCollapsed && (
        <>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
              {title.text}
            </span>
            <span className="text-overline text-sidebar-foreground/55">
              Dashboard
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            className={cn(
              "size-8 shrink-0 rounded-lg text-sidebar-foreground/60",
              "hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <PanelLeftIcon className="size-4" />
          </Button>
        </>
      )}
    </ShadcnSidebarHeader>
  );
}

function BrandMark({
  icon,
  isCollapsed,
  onExpand,
}: {
  icon: React.ReactNode;
  isCollapsed: boolean;
  onExpand: () => void;
}) {
  const mark = (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg",
        "bg-sidebar-primary text-sidebar-primary-foreground",
        "[&_svg]:size-4"
      )}
    >
      {icon}
    </div>
  );

  if (!isCollapsed) return mark;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expand sidebar"
          className="rounded-lg transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          {mark}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">Expand sidebar</TooltipContent>
    </Tooltip>
  );
}

/* --------------------------------------------------------------------------
   Menu items
   -------------------------------------------------------------------------- */

type MenuItemProps = {
  item: TreeMenuItem;
  selectedKey?: string;
  isCollapsed: boolean;
  depth?: number;
};

function SidebarItem(props: MenuItemProps) {
  const { item, isCollapsed } = props;

  // `meta.group: true` marks a section header rather than a navigable resource.
  if (item.meta?.group) {
    return <SidebarGroup {...props} />;
  }

  if (item.children && item.children.length > 0) {
    // No room to expand a subtree in the icon rail — flyout instead.
    return isCollapsed ? (
      <SidebarSubmenuFlyout {...props} />
    ) : (
      <SidebarSubmenu {...props} />
    );
  }

  return <SidebarLink {...props} />;
}

function SidebarGroup({ item, selectedKey, isCollapsed }: MenuItemProps) {
  const children = item.children ?? [];

  // Collapsed: the label has nowhere to go, so a hairline stands in for it.
  if (isCollapsed) {
    return (
      <div className="flex flex-col gap-1 border-t border-sidebar-border pt-3 first:border-t-0 first:pt-0">
        {children.map((child) => (
          <SidebarItem
            key={child.key || child.name}
            item={child}
            selectedKey={selectedKey}
            isCollapsed
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <span className="text-overline px-3 pb-1.5 text-sidebar-foreground/60">
        {getDisplayName(item)}
      </span>
      <div className="flex flex-col gap-0.5">
        {children.map((child) => (
          <SidebarItem
            key={child.key || child.name}
            item={child}
            selectedKey={selectedKey}
            isCollapsed={false}
          />
        ))}
      </div>
    </div>
  );
}

function SidebarSubmenu({ item, selectedKey, depth = 0 }: MenuItemProps) {
  const children = item.children ?? [];
  const hasSelectedChild = children.some(
    (child) => child.key === selectedKey
  );

  return (
    <Collapsible defaultOpen={hasSelectedChild} className="group/collapsible">
      <CollapsibleTrigger className={navRowClass({ isCollapsed: false })}>
        <NavIcon item={item} />
        <span className="flex-1 truncate text-left">
          {getDisplayName(item)}
        </span>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 transition-transform duration-200",
            "group-data-[state=open]/collapsible:rotate-90"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="ms-4 mt-0.5 flex flex-col gap-0.5 border-s border-sidebar-border ps-2">
          {children.map((child) => (
            <SidebarItem
              key={child.key || child.name}
              item={child}
              selectedKey={selectedKey}
              isCollapsed={false}
              depth={depth + 1}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarSubmenuFlyout({ item, selectedKey }: MenuItemProps) {
  const Link = useLink();
  const children = item.children ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={navRowClass({ isCollapsed: true })}>
        <NavIcon item={item} />
        <span className="sr-only">{getDisplayName(item)}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="start" className="min-w-48">
        <DropdownMenuLabel>{getDisplayName(item)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children.map((child) => {
          const isSelected = child.key === selectedKey;

          return (
            <DropdownMenuItem key={child.key || child.name} asChild>
              <Link
                to={child.route || ""}
                className={cn(
                  "flex w-full items-center gap-2",
                  isSelected && "bg-accent text-accent-foreground"
                )}
              >
                <span className="[&_svg]:size-4">{getIcon(child)}</span>
                <span className="truncate">{getDisplayName(child)}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarLink({ item, selectedKey, isCollapsed }: MenuItemProps) {
  const Link = useLink();
  const { isMobile, setOpenMobile } = useShadcnSidebar();
  const isSelected = item.key === selectedKey;
  const label = getDisplayName(item);
  const badge = item.meta?.badge as React.ReactNode | undefined;

  const row = (
    <Link
      to={item.route || ""}
      aria-current={isSelected ? "page" : undefined}
      // Tapping a link on mobile should close the drawer behind it.
      onClick={() => isMobile && setOpenMobile(false)}
      className={navRowClass({ isSelected, isCollapsed })}
    >
      <NavIcon item={item} isSelected={isSelected} />
      {isCollapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge != null && (
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5",
                "bg-sidebar-primary/15 text-[10px] font-semibold text-sidebar-primary"
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (!isCollapsed) return row;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function NavIcon({
  item,
  isSelected,
}: {
  item: TreeMenuItem;
  isSelected?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center [&_svg]:size-4",
        isSelected ? "text-sidebar-primary" : "text-current"
      )}
    >
      {getIcon(item)}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Footer — only rendered when an auth provider can actually identify someone.
   -------------------------------------------------------------------------- */

function SidebarUser({ isCollapsed }: { isCollapsed: boolean }) {
  const authProvider = useActiveAuthProvider();
  const { data: user } = useGetIdentity<Identity>();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  if (!authProvider?.getIdentity) return null;

  const name = user?.fullName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const avatar = (
    <Avatar className="size-8 shrink-0">
      {user?.avatar && <AvatarImage src={user.avatar} alt={name} />}
      <AvatarFallback className="bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <ShadcnSidebarFooter className="border-r border-t border-sidebar-border p-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex w-full items-center gap-2 rounded-lg p-1.5 text-left",
            "transition-colors hover:bg-sidebar-accent/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            isCollapsed && "justify-center"
          )}
        >
          {avatar}
          {!isCollapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {name || "Account"}
              </span>
              {user?.email && (
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {user.email}
                </span>
              )}
            </div>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" className="min-w-52">
          {name && <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/profile">
              <UserRoundIcon className="size-4" />
              <span>Your account</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => logout()}
            className="text-destructive focus:text-destructive"
          >
            <LogOutIcon className="size-4" />
            <span>{isLoggingOut ? "Logging out…" : "Log out"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ShadcnSidebarFooter>
  );
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

Sidebar.displayName = "Sidebar";
