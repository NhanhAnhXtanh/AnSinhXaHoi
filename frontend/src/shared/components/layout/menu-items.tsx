import { usePermissions, type TreeMenuItem } from "@refinedev/core";
import { ListIcon } from "lucide-react";
import React from "react";

import { permissionFor } from "@/shared/lib/permissions";

/*
 * Cây menu dùng chung cho thanh bên (`sidebar.tsx`) và ô tìm kiếm Ctrl K
 * (`command-palette.tsx`). Để riêng một file vì một file chỉ nên xuất component
 * thì fast refresh mới chạy.
 */

export function getDisplayName(item: TreeMenuItem): string {
  return item.meta?.label ?? item.label ?? item.name;
}

export function getIcon(item: TreeMenuItem) {
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
 *
 * Ô tìm kiếm Ctrl K ở `header.tsx` dùng chung cây này, nên tìm được đúng những
 * màn menu đang hiện — không hơn, không kém.
 */
export function useAccessibleMenuItems(items: TreeMenuItem[]): TreeMenuItem[] {
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
