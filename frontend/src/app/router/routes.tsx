import { Authenticated, CanAccess } from "@refinedev/core";
import { Navigate, Outlet, Route, Routes } from "react-router";

import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

import { LoadingState } from "@/shared/components/asxh";

/**
 * Mỗi màn tải theo route (React.lazy): trang đăng nhập và khung app chỉ tải mã của
 * chính chúng, màn nào mở mới kéo chunk của feature đó. Feature chỉ xuất qua
 * `index.ts` nên nạp động cả index rồi chọn đúng component — các màn cùng một
 * feature dùng chung một chunk.
 */
function lazyNamed<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}

const loadAdministration = () => import("@/features/administration");
const loadIdentity = () => import("@/features/identity");
const loadInputReports = () => import("@/features/input-reports");
const loadReportReview = () => import("@/features/report-review");
const loadAnnualReview = () => import("@/features/annual-review");
const loadReportUnits = () => import("@/features/report-units");
const loadTemplates = () => import("@/features/templates");

const Dashboard = lazyNamed(() => import("@/features/dashboard"), "Dashboard");
const NotificationList = lazyNamed(() => import("@/features/notifications"), "NotificationList");
const UserList = lazyNamed(loadAdministration, "UserList");
const UserCreate = lazyNamed(loadAdministration, "UserCreate");
const UserEdit = lazyNamed(loadAdministration, "UserEdit");
const UserShow = lazyNamed(loadAdministration, "UserShow");
const RoleList = lazyNamed(loadAdministration, "RoleList");
const RoleCreate = lazyNamed(loadAdministration, "RoleCreate");
const RoleEdit = lazyNamed(loadAdministration, "RoleEdit");
const RoleShow = lazyNamed(loadAdministration, "RoleShow");
const RowLevelPolicyList = lazyNamed(loadAdministration, "RowLevelPolicyList");
const RowLevelPolicyCreate = lazyNamed(loadAdministration, "RowLevelPolicyCreate");
const RowLevelPolicyEdit = lazyNamed(loadAdministration, "RowLevelPolicyEdit");
const RowLevelPolicyShow = lazyNamed(loadAdministration, "RowLevelPolicyShow");
const Login = lazyNamed(loadIdentity, "Login");
const Profile = lazyNamed(loadIdentity, "Profile");
const InputReportList = lazyNamed(loadInputReports, "InputReportList");
const InputReportWork = lazyNamed(loadInputReports, "InputReportWork");
const ReviewList = lazyNamed(loadReportReview, "ReviewList");
const ReviewWork = lazyNamed(loadReportReview, "ReviewWork");
const PeriodSetup = lazyNamed(() => import("@/features/period-setup"), "PeriodSetup");
const PublicationHistoryList = lazyNamed(
  () => import("@/features/publication-history"),
  "PublicationHistoryList"
);
const MeasureKindList = lazyNamed(() => import("@/features/measure-kinds"), "MeasureKindList");
const SummaryPage = lazyNamed(() => import("@/features/summary"), "SummaryPage");
const AnnualReviewList = lazyNamed(loadAnnualReview, "AnnualReviewList");
const AnnualReviewWork = lazyNamed(loadAnnualReview, "AnnualReviewWork");
const AnnualSubmissionHistory = lazyNamed(loadAnnualReview, "AnnualSubmissionHistory");
const ReportUnitList = lazyNamed(loadReportUnits, "ReportUnitList");
const ReportUnitCreate = lazyNamed(loadReportUnits, "ReportUnitCreate");
const ReportUnitEdit = lazyNamed(loadReportUnits, "ReportUnitEdit");
const ReportCalendar = lazyNamed(() => import("@/features/report-calendar"), "ReportCalendar");
const TemplateSets = lazyNamed(loadTemplates, "TemplateSets");
const TemplateDesigner = lazyNamed(loadTemplates, "TemplateDesigner");

/** Chờ chunk của màn: khung app (sidebar, header) vẫn đứng yên, chỉ vùng nội dung hiện chờ. */
function RouteSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState variant="page" label="Đang mở màn hình…" />}>{children}</Suspense>;
}

import { ErrorComponent } from "@/shared/components/layout/error-component";
import { Forbidden } from "@/shared/components/layout/forbidden";
import { Layout } from "@/shared/components/layout/layout";

/**
 * Route tree rendered inside `<Refine>`. Every path here must line up with the
 * action routes declared in `app/resources/index.tsx`.
 *
 * The tree has two halves. Everything under `<Authenticated>` requires a
 * session and renders inside the shell; the login screen sits outside it and
 * renders bare. `<Authenticated>` calls the auth provider's `check`, which is
 * what turns an expired access token into a silent refresh rather than a
 * bounce to the login form.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        element={
          <Authenticated key="authenticated-routes" redirectOnFail="/login">
            <Layout>
              <RouteSuspense>
                <Outlet />
              </RouteSuspense>
            </Layout>
          </Authenticated>
        }
      >
        {/*
          The application opens on the dashboard rather than on a resource's
          table. `Navigate` rather than `NavigateToResource`, because the
          dashboard is a screen and not a resource: there is no `list` action to
          resolve a path from beyond the one declared above.
        */}
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/*
          Administration — plain full-page routes, like categories, each wrapped
          in `<CanAccess>`. The sidebar already hides these, so the guard only
          matters for a typed or bookmarked URL: without it the screen would
          render and the list request would 403, leaving an empty table and a
          toast instead of an explanation.

          This is a courtesy, not the boundary. The API checks the same
          permission on every request regardless of what renders here.
        */}
        <Route
          path="/users"
          element={
            <CanAccess
              resource="users"
              action="list"
              fallback={<Forbidden />}
            >
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<UserList />} />
          <Route path="create" element={<UserCreate />} />
          <Route path="edit/:id" element={<UserEdit />} />
          <Route path="show/:id" element={<UserShow />} />
        </Route>
        <Route
          path="/roles"
          element={
            <CanAccess
              resource="roles"
              action="list"
              fallback={<Forbidden />}
            >
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<RoleList />} />
          <Route path="create" element={<RoleCreate />} />
          <Route path="edit/:id" element={<RoleEdit />} />
          <Route path="show/:id" element={<RoleShow />} />
        </Route>
        <Route
          path="/row-level-policies"
          element={
            <CanAccess
              resource="row_level_policies"
              action="list"
              fallback={<Forbidden />}
            >
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<RowLevelPolicyList />} />
          <Route path="create" element={<RowLevelPolicyCreate />} />
          <Route path="edit/:id" element={<RowLevelPolicyEdit />} />
          <Route path="show/:id" element={<RowLevelPolicyShow />} />
        </Route>
        {/*
          Notifications have a list and nothing else. No create screen, because
          the application raises a notification rather than a person writing
          one; no edit screen, because the only change a recipient may make is
          marking one read. No <CanAccess> wrapper either: every system role is
          granted notifications:read, and the rows are the caller's own, so
          there is no URL to guard against.
        */}
        <Route path="/notifications" element={<NotificationList />} />

        {/*
          Màn nghiệp vụ ASXH — gọi API thật, nên bọc <CanAccess> như các màn
          quản trị: thanh bên đã ẩn mục không có quyền, guard này lo đường dẫn
          gõ tay hoặc đánh dấu sẵn. Mã quyền của từng màn (kể cả màn mang tên
          khác tên resource backend) nằm ở `shared/lib/permissions.ts`.
        */}
        <Route
          path="/input-reports"
          element={
            <CanAccess resource="input_reports" action="list" fallback={<Forbidden />}>
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<InputReportList />} />
          <Route path=":id" element={<InputReportWork />} />
        </Route>
        <Route
          path="/report-review"
          element={
            <CanAccess resource="report_review" action="list" fallback={<Forbidden />}>
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<ReviewList />} />
          <Route path=":id" element={<ReviewWork />} />
        </Route>
        <Route
          path="/period-setup"
          element={
            <CanAccess resource="period_setup" action="list" fallback={<Forbidden />}>
              <PeriodSetup />
            </CanAccess>
          }
        />
        <Route
          path="/publication-history"
          element={
            <CanAccess resource="publication_history" action="list" fallback={<Forbidden />}>
              <PublicationHistoryList />
            </CanAccess>
          }
        />
        <Route
          path="/measure-kinds"
          element={
            <CanAccess resource="measure_kinds" action="list" fallback={<Forbidden />}>
              <MeasureKindList />
            </CanAccess>
          }
        />
        <Route
          path="/summary"
          element={
            <CanAccess resource="summary" action="list" fallback={<Forbidden />}>
              <SummaryPage />
            </CanAccess>
          }
        />
        <Route
          path="/annual-review"
          element={
            <CanAccess resource="annual_review" action="list" fallback={<Forbidden />}>
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<AnnualReviewList />} />
          {/* `history` đứng trước `:id` cho dễ đọc; react-router vẫn ưu tiên đoạn cố định. */}
          <Route path="history" element={<AnnualSubmissionHistory />} />
          <Route path=":id" element={<AnnualReviewWork />} />
        </Route>
        <Route
          path="/report-units"
          element={
            <CanAccess resource="report_units" action="list" fallback={<Forbidden />}>
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<ReportUnitList />} />
          {/* Quyền xem danh sách chưa đủ: gõ tay đường dẫn thêm / sửa cũng phải có quyền ghi. */}
          <Route
            path="create"
            element={
              <CanAccess resource="report_units" action="create" fallback={<Forbidden />}>
                <ReportUnitCreate />
              </CanAccess>
            }
          />
          <Route
            path="edit/:id"
            element={
              <CanAccess resource="report_units" action="edit" fallback={<Forbidden />}>
                <ReportUnitEdit />
              </CanAccess>
            }
          />
        </Route>
        <Route
          path="/report-calendar"
          element={
            <CanAccess resource="report_calendar" action="list" fallback={<Forbidden />}>
              <ReportCalendar />
            </CanAccess>
          }
        />
        <Route
          path="/templates"
          element={
            <CanAccess resource="templates" action="list" fallback={<Forbidden />}>
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<TemplateSets />} />
          <Route path="designer/:id" element={<TemplateDesigner />} />
        </Route>

        {/* Not a resource: no list of "my accounts", no id in the URL. */}
        <Route path="/profile" element={<Profile />} />

        <Route path="*" element={<ErrorComponent />} />
      </Route>

      {/*
        The unauthenticated half. `fallback` is what renders when there is no
        session; a signed-in visitor is sent to the dashboard instead, so the
        login URL never shows a form to someone who is already past it.
      */}
      <Route
        element={
          <Authenticated
            key="unauthenticated-routes"
            fallback={
              <RouteSuspense>
                <Outlet />
              </RouteSuspense>
            }
          >
            <Navigate to="/" replace />
          </Authenticated>
        }
      >
        <Route path="/login" element={<Login />} />
      </Route>
    </Routes>
  );
}
