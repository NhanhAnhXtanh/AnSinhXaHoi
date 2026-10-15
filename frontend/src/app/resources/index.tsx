import type { ResourceProps } from "@refinedev/core";
import {
  Bell,
  BuildingComplex,
  LayoutDashboard,
  KeyRound,
  ListChecks,
  Network,
  Newspaper,
  ShieldCheck,
  ShieldHalf,
  Tags,
  Users,
} from "lucide-react";

/**
 * Resource definitions passed to `<Refine resources={...} />`.
 *
 * A resource maps a name to its action routes. Refine infers the current
 * resource from the URL, which is what lets hooks like `useTable`, `useForm`
 * and the `*Button` components work without being told which resource they are
 * operating on.
 *
 * The resource name is load-bearing twice over. It is the path segment the data
 * provider builds every request from (`/api/{name}`), and it is the first half
 * of the permission code the access control provider asks about
 * (`{name}:read`). Renaming one here means renaming the endpoint and the seeded
 * permission with it.
 *
 * `meta` keys used here:
 *   - `label`     display name in the sidebar, breadcrumb and document title
 *   - `icon`      sidebar and breadcrumb icon (falls back to a generic list icon)
 *   - `parent`    nests this resource under another one (Refine)
 *   - `group`     renders the resource as a sidebar section header
 *                 (convention of `shared/components/layout/sidebar.tsx`,
 *                 not a Refine API)
 *   - `canDelete` declared, but **read by nothing**. It is a Refine resource
 *                 type with no runtime consumer in this UI layer: the list
 *                 action columns render a `<DeleteButton>` outright and so does
 *                 `ShowViewHeader`, both leaving the decision to access control
 *                 (`{resource}:delete`). The values below are therefore inert —
 *                 `categories` says `false` and still offers a delete, because
 *                 `categories:delete` is a seeded code. Do not start honouring
 *                 it in one view only; that would give a resource a delete on
 *                 its table and none on its detail page.
 *
 * This is one half of a declaration; the other is the `<Route>` tree in
 * `app/router/routes.tsx`. Adding a resource means touching both, and if the
 * action paths here drift from the route paths there, buttons and breadcrumbs
 * silently navigate nowhere.
 */
export const resources: ResourceProps[] = [
  // The landing screen, and the one resource here with nothing behind it: no
  // endpoint, no rows, no permission. It is declared so `useMenu` has an item
  // to render and so the breadcrumb and document title have a label; the code
  // that would otherwise be derived from this name (`dashboard:read`) is
  // suppressed in `shared/lib/permissions.ts`, or the sidebar would hide the
  // item from everybody.
  {
    name: "dashboard",
    list: "/dashboard",
    meta: {
      label: "DTH-FRAMEWORK",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
  },

  // Work. Top-level rather than in a group, like `notifications`: a group
  // header wrapping a single item is a heading that explains nothing. It gets
  // one when the rest of `module/bpm` arrives.
  {
    name: "tasks",
    list: "/tasks",
    create: "/tasks/create",
    edit: "/tasks/edit/:id",
    show: "/tasks/show/:id",
    meta: {
      label: "Tasks",
      canDelete: true,
      icon: <ListChecks className="h-4 w-4" />,
    },
  },

  // Section header. A resource with no route acts purely as a grouping node:
  // `useMenu` keeps it because it has children (it drops items that have
  // neither a `list` route nor children), and the sidebar renders it as a
  // section because of `meta.group`.
  {
    name: "content",
    meta: {
      label: "Content",
      group: true,
    },
  },
  {
    name: "blog_posts",
    list: "/blog-posts",
    create: "/blog-posts/create",
    edit: "/blog-posts/edit/:id",
    show: "/blog-posts/show/:id",
    clone: "/blog-posts/clone/:id",
    meta: {
      canDelete: false,
      icon: <Newspaper className="h-4 w-4" />,
      parent: "content",
    },
  },
  {
    name: "categories",
    list: "/categories",
    create: "/categories/create",
    edit: "/categories/edit/:id",
    show: "/categories/show/:id",
    clone: "/categories/clone/:id",
    meta: {
      canDelete: false,
      icon: <Tags className="h-4 w-4" />,
      parent: "content",
    },
  },

  // Organization structure. Two resources rather than one screen with a
  // nesting level, because they are two grants: the seed data lets MANAGER
  // maintain departments while only reading the organizations they hang off.
  {
    name: "structure",
    meta: {
      label: "Organization",
      group: true,
    },
  },
  {
    name: "organizations",
    list: "/organizations",
    create: "/organizations/create",
    edit: "/organizations/edit/:id",
    show: "/organizations/show/:id",
    meta: {
      label: "Organizations",
      canDelete: true,
      icon: <BuildingComplex className="h-4 w-4" />,
      parent: "structure",
    },
  },
  {
    name: "departments",
    list: "/departments",
    create: "/departments/create",
    edit: "/departments/edit/:id",
    show: "/departments/show/:id",
    meta: {
      label: "Departments",
      canDelete: true,
      icon: <Network className="h-4 w-4" />,
      parent: "structure",
    },
  },

  // Administration. The whole section disappears for anyone without the
  // matching permissions -- but not by itself: `useMenu` does not consult
  // access control, so `sidebar.tsx` filters the tree it returns. See
  // `useAccessibleMenuItems` there.
  {
    name: "administration",
    meta: {
      label: "Administration",
      group: true,
    },
  },
  {
    name: "users",
    list: "/users",
    create: "/users/create",
    edit: "/users/edit/:id",
    show: "/users/show/:id",
    meta: {
      label: "Users",
      canDelete: true,
      icon: <Users className="h-4 w-4" />,
      parent: "administration",
    },
  },
  {
    name: "roles",
    list: "/roles",
    create: "/roles/create",
    edit: "/roles/edit/:id",
    show: "/roles/show/:id",
    meta: {
      label: "Roles",
      canDelete: true,
      icon: <ShieldCheck className="h-4 w-4" />,
      parent: "administration",
    },
  },
  // Read-only: a list and a show, and no create, edit or delete action. The
  // absent actions are what stops the screen promising something the API will
  // not do — a permission only means something once an endpoint checks for it,
  // so the catalogue is written by migrations. Refine derives no route it was
  // not given, and `permissions:write` / `permissions:delete` are not codes any
  // migration seeds, so the buttons would be hidden even if they were.
  {
    name: "permissions",
    list: "/permissions",
    show: "/permissions/show/:id",
    meta: {
      label: "Permissions",
      canDelete: false,
      icon: <KeyRound className="h-4 w-4" />,
      parent: "administration",
    },
  },
  // Data scopes: which rows each role may reach, as opposed to which resources
  // it may open at all. Only ADMIN holds `row_level_policies:read`, so
  // `useAccessibleMenuItems` in the sidebar hides this from everybody else --
  // and hides the whole Administration group with it if nothing else survives.
  //
  // Plain full-page routes rather than dialogs, for the same reason `roles` and
  // `users` are: the condition builder needs vertical room a dialog over a list
  // does not have.
  {
    name: "row_level_policies",
    list: "/row-level-policies",
    create: "/row-level-policies/create",
    edit: "/row-level-policies/edit/:id",
    show: "/row-level-policies/show/:id",
    meta: {
      label: "Data scopes",
      canDelete: true,
      icon: <ShieldHalf className="h-4 w-4" />,
      parent: "administration",
    },
  },
  {
    name: "notifications",
    list: "/notifications",
    meta: {
      label: "Notifications",
      canDelete: true,
      icon: <Bell className="h-4 w-4" />,
    },
  },
];
