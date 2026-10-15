import type { ComponentProps } from "react";

import type { DepartmentStatus } from "@/domains/department/types";
import type { OrganizationStatus } from "@/domains/organization/types";
import type { TaskPriority, TaskStatus } from "@/domains/task/types";
import type { UserStatus } from "@/domains/user/types";
import type { Badge } from "@/shared/ui/badge";

/**
 * Which badge every status is drawn in, for every resource, in one place.
 *
 * Out of `domains/`, where the statuses themselves are declared, because a
 * badge variant is a word from the screen's vocabulary rather than the data's:
 * the domain says an account may be `locked`, the UI decides that `locked` is
 * red. Together rather than one table per feature, because one screen regularly
 * shows another resource's status — an organization lists its departments — and
 * a feature may not import another feature.
 */
type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

/**
 * Only "active" is a working state, so it is the only green one. Locked is
 * destructive rather than merely muted because it means somebody decided this
 * account was a risk, which is worth noticing in a list; inactive is neutral,
 * because it means nothing more than "not in use".
 */
export const USER_STATUS_VARIANTS: Record<UserStatus, BadgeVariant> = {
  active: "success",
  inactive: "neutral",
  locked: "destructive",
};

/**
 * Blocked is the only status that reads as a problem, so it is the only
 * destructive one. Done is a success rather than a neutral end; cancelled is
 * neutral, because an abandoned task is not a failure worth colouring.
 *
 * Every one of these is a *subtle* variant, and that is the rule for a status
 * column rather than a preference: a solid fill claims the eye, and a column
 * where every row claims the eye tells you nothing about which row to look at.
 */
export const TASK_STATUS_VARIANTS: Record<TaskStatus, BadgeVariant> = {
  todo: "outline",
  in_progress: "info",
  blocked: "destructive",
  done: "success",
  cancelled: "neutral",
};

/**
 * The ramp climbs; it does not change subject. Low and medium are quiet,
 * high is amber, urgent is red — so a list sorted by nothing in particular
 * still shows where the pressure is.
 */
export const TASK_PRIORITY_VARIANTS: Record<TaskPriority, BadgeVariant> = {
  low: "outline",
  medium: "neutral",
  high: "warning",
  urgent: "destructive",
};

/**
 * Only "active" is a live state, so it is the only one that reads as neutral.
 * Inactive is muted rather than destructive: retiring an organization is an
 * ordinary administrative decision, not a warning.
 */
export const ORGANIZATION_STATUS_VARIANTS: Record<
  OrganizationStatus,
  BadgeVariant
> = {
  active: "success",
  inactive: "neutral",
};

export const DEPARTMENT_STATUS_VARIANTS: Record<DepartmentStatus, BadgeVariant> =
  {
    active: "success",
    inactive: "neutral",
  };

/**
 * How each action of a `resource:action` code reads in a badge. `delete` is the
 * only destructive one and the only one coloured as such; `read` stays quiet
 * because most codes are reads and colouring them all would be noise.
 *
 * Keyed by string rather than `PermissionAction`, because the action is split
 * out of a code the catalogue returned and nothing guarantees it is one of the
 * three.
 */
export const PERMISSION_ACTION_VARIANTS: Record<string, BadgeVariant> = {
  read: "outline",
  write: "secondary",
  delete: "destructive",
};
