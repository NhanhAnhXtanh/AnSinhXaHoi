import type { ResourceProps } from "@refinedev/core";
import {
  Bell,
  BuildingComplex,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  FileSpreadsheet,
  House,
  ListTodo,
  RotateCcwClock,
  Scale,
  ShieldCheck,
  ShieldHalf,
  SquareCheckBig,
  SquarePen,
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
  {
    name: "dashboard",
    list: "/dashboard",
    meta: { label: "Trang chủ", icon: <House className="h-4 w-4" /> },
  },

  // Màn nghiệp vụ ASXH. Mã quyền mở từng màn:
  //   input_reports       → input_reports:write     (cán bộ đơn vị nhập, nộp)
  //   report_review       → input_reports:approve   (cán bộ Sở duyệt, trả lại)
  //   period_setup        → period_assignments:read
  //   summary             → summary:read
  //   annual_review       → annual_reports:read
  //   templates           → templates:read          (trùng tên, suy ra thẳng)
  //   report_calendar     → report_calendars:read
  //   publication_history → publications:read
  //   report_units        → report_units:read       (trùng tên, suy ra thẳng)
  // Màn nào mang tên khác resource backend thì khai trong SCREEN_PERMISSIONS ở
  // `shared/lib/permissions.ts` — đổi một bên phải đổi bên kia.
  { name: "bao_cao", meta: { label: "Báo cáo", group: true } },
  {
    name: "input_reports",
    list: "/input-reports",
    show: "/input-reports/:id",
    meta: { label: "Nhập liệu báo cáo", icon: <SquarePen className="h-4 w-4" />, parent: "bao_cao" },
  },
  {
    name: "report_review",
    list: "/report-review",
    show: "/report-review/:id",
    meta: { label: "Duyệt phiếu nhập", icon: <ClipboardCheck className="h-4 w-4" />, parent: "bao_cao" },
  },
  {
    name: "period_setup",
    list: "/period-setup",
    meta: { label: "Thiết lập & điều hành", icon: <ListTodo className="h-4 w-4" />, parent: "bao_cao" },
  },
  {
    name: "summary",
    list: "/summary",
    meta: { label: "Tổng hợp báo cáo", icon: <ChartColumn className="h-4 w-4" />, parent: "bao_cao" },
  },
  {
    name: "annual_review",
    list: "/annual-review",
    show: "/annual-review/:id",
    meta: { label: "Duyệt báo cáo năm", icon: <SquareCheckBig className="h-4 w-4" />, parent: "bao_cao" },
  },

  { name: "bieu_mau", meta: { label: "Biểu mẫu", group: true } },
  {
    name: "templates",
    list: "/templates",
    meta: { label: "Bộ biểu mẫu", icon: <FileSpreadsheet className="h-4 w-4" />, parent: "bieu_mau" },
  },
  {
    name: "report_calendar",
    list: "/report-calendar",
    meta: { label: "Lịch và kỳ báo cáo", icon: <CalendarDays className="h-4 w-4" />, parent: "bieu_mau" },
  },
  {
    name: "publication_history",
    list: "/publication-history",
    meta: { label: "Lịch sử mở đợt", icon: <RotateCcwClock className="h-4 w-4" />, parent: "bieu_mau" },
  },
  {
    name: "measure_kinds",
    list: "/measure-kinds",
    meta: { label: "Bản chất chỉ tiêu", icon: <Scale className="h-4 w-4" />, parent: "bieu_mau" },
  },

  // Administration. The whole section disappears for anyone without the
  // matching permissions -- but not by itself: `useMenu` does not consult
  // access control, so `sidebar.tsx` filters the tree it returns. See
  // `useAccessibleMenuItems` there.
  { name: "administration", meta: { label: "Danh mục & quản trị", group: true } },
  {
    name: "report_units",
    list: "/report-units",
    create: "/report-units/create",
    edit: "/report-units/edit/:id",
    meta: { label: "Danh sách đơn vị", icon: <BuildingComplex className="h-4 w-4" />, parent: "administration" },
  },
  {
    name: "users",
    list: "/users",
    create: "/users/create",
    edit: "/users/edit/:id",
    show: "/users/show/:id",
    meta: { label: "Người dùng", canDelete: true, icon: <Users className="h-4 w-4" />, parent: "administration" },
  },
  {
    name: "roles",
    list: "/roles",
    create: "/roles/create",
    edit: "/roles/edit/:id",
    show: "/roles/show/:id",
    meta: { label: "Vai trò", canDelete: true, icon: <ShieldCheck className="h-4 w-4" />, parent: "administration" },
  },
  {
    name: "row_level_policies",
    list: "/row-level-policies",
    create: "/row-level-policies/create",
    edit: "/row-level-policies/edit/:id",
    show: "/row-level-policies/show/:id",
    meta: { label: "Phạm vi dữ liệu", canDelete: true, icon: <ShieldHalf className="h-4 w-4" />, parent: "administration" },
  },

  // Thông báo không có mục menu nhưng chuông trên thanh đầu mở tới đây
  // ("Xem tất cả"), nên giữ route và ẩn khỏi menu (`meta.hide`).
  //
  // Các màn mẫu của base dth-framework (tasks, blog_posts, categories,
  // organizations, departments, permissions) đã gỡ khỏi đây và khỏi
  // `routes.tsx`: màn không có trên menu ASXH thì cũng không mở được bằng gõ
  // đường dẫn. API của chúng vẫn còn — màn vai trò và màn người dùng đọc
  // `permissions`, `organizations`, `departments` qua data provider, việc đó
  // không cần resource khai ở đây.
  {
    name: "notifications",
    list: "/notifications",
    meta: { label: "Thông báo", canDelete: true, hide: true, icon: <Bell className="h-4 w-4" /> },
  },
];
