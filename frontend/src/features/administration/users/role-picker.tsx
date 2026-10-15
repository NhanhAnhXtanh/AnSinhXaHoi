import { useList } from "@refinedev/core";

import { Checkbox } from "@/shared/ui/checkbox";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import type { RoleSummary } from "@/domains/user/types";

/**
 * The roles a user holds, as a checkbox list.
 *
 * A multi-select combobox would take less room, but roles are the thing that
 * decides what an account can do, and there are few enough of them to show at
 * once. Making every option and its description visible while the choice is
 * being made is worth the space.
 *
 * They lay out as a responsive grid rather than one column. A column of
 * full-width cards on a wide screen is a stack of banners with a checkbox on
 * the left and half a metre of nothing on the right, and it pushes whatever
 * follows off the fold; two or three to a row reads as a set of options, which
 * is what it is.
 *
 * The value is the array of `{ id }` refs the API expects, so the form field
 * can be handed straight to `onFinish` with no reshaping.
 */

export type RoleRef = { id: number };

type RolePickerProps = {
  value: RoleRef[] | undefined;
  onChange: (value: RoleRef[]) => void;
};

type Role = RoleSummary & { description: string | null };

export function RolePicker({ value, onChange }: RolePickerProps) {
  // The role list is short and fixed; asking for a large page avoids a picker
  // that silently omits the role somebody is looking for.
  const { result, query } = useList<Role>({
    resource: "roles",
    pagination: { pageSize: 100 },
    sorters: [{ field: "code", order: "asc" }],
  });

  const selected = new Set((value ?? []).map((ref) => Number(ref.id)));

  const toggle = (roleId: number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) {
      next.add(roleId);
    } else {
      next.delete(roleId);
    }
    onChange([...next].map((id) => ({ id })));
  };

  if (query.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const roles = result?.data ?? [];

  if (roles.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No roles are available. Create one on the Roles screen first.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {roles.map((role) => {
        const isSelected = selected.has(role.id);
        return (
          <label
            key={role.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
              "transition-colors",
              isSelected
                ? // A ring as well as a border, because at two or three to a row
                  // the selected card has to be findable in one sweep rather than
                  // by comparing edges with its neighbour.
                  "border-primary bg-primary/5 ring-primary/30 ring-1"
                : "border-border hover:bg-accent/40"
            )}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => toggle(role.id, checked === true)}
              className="mt-0.5"
            />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{role.name}</span>
              <span className="text-muted-foreground font-mono text-xs">
                {role.code}
              </span>
              {role.description && (
                <span className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                  {role.description}
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
