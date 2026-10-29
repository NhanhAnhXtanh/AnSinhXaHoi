import { Refine, type NotificationProvider } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";

import { BrowserRouter } from "react-router";
import routerProvider, {
  DocumentTitleHandler,
} from "@refinedev/react-router";
import { dataProvider } from "@/shared/api/data";
import { authProvider } from "./providers/auth";
import { accessControlProvider } from "./providers/access-control";
import { AuthoritiesSync } from "./providers/authorities-sync";
import { useNotificationProvider } from "@/shared/components/notification/use-notification-provider";
import { Toaster } from "@/shared/components/notification/toaster";
import { ThemeProvider } from "@/shared/components/theme/theme-provider";
// Refine ships an `UnsavedChangesNotifier` too, but it asks with
// `window.confirm`. This one asks with the application's own dialog, and wraps
// the routes so a screen that dismisses itself can ask the same question.
import { UnsavedChangesGuard } from "@/shared/components/form/unsaved-changes-guard";
import { resources } from "./resources";
import { AppRoutes } from "./router/routes";
import { Landmark } from "lucide-react";
import { ReportYearProvider } from "@/shared/components/asxh";
// The `@font-face` behind `"Inter Variable"` in `--font-sans`. Without it the
// name resolves only where Inter happens to be installed.
import "@fontsource-variable/inter";
import "@/styles/index.css";

/**
 * The notification provider, minus the one toast the login screen replaces.
 *
 * `useLogin` opens a "login-error" toast on every failed sign-in, titled with
 * the error's `name`, and has no option to skip it. The login form already
 * shows the same sentence under the password field, so the toast is dropped
 * here rather than flashed and closed a frame later.
 */
function useAppNotificationProvider(): NotificationProvider {
  const base = useNotificationProvider();
  return {
    ...base,
    open: (params) => {
      if (params.key === "login-error") return;
      base.open?.(params);
    },
  };
}

/**
 * Không thử lại một yêu cầu mà máy chủ đã trả lời dứt khoát.
 *
 * react-query mặc định thử lại 3 lần (chờ tăng dần, tổng cỡ chục giây) với
 * MỌI lỗi. Với 404 (phiếu / biểu / phiên bản không còn), 403 (thiếu quyền),
 * 400 / 409 / 422 thì thử lại cũng ra đúng câu trả lời đó — người dùng chỉ
 * phải nhìn vòng quay lâu hơn rồi mới thấy "Không tìm thấy…". Lỗi mạng và 5xx
 * vẫn được thử lại như cũ.
 *
 * Để ở cấp module: Refine dựng QueryClient một lần theo object này.
 */
const NO_RETRY_STATUSES = new Set([400, 401, 403, 404, 409, 410, 422]);
const reactQueryClientConfig = {
  defaultOptions: {
    queries: {
      retry: (failureCount: number, error: unknown) => {
        const status =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : NaN;
        if (NO_RETRY_STATUSES.has(status)) return false;
        return failureCount < 3;
      },
    },
  },
};

function App() {
  const notificationProvider = useAppNotificationProvider();
  return (
    <BrowserRouter>
      <ThemeProvider>
        <DevtoolsProvider>
          <Refine
            dataProvider={dataProvider}
            // Signing in, renewing and identifying the current user. Its
            // presence is also what makes the header and sidebar render their
            // account blocks -- both check for `getIdentity` before doing so.
            authProvider={authProvider}
            // Answers every `can` from the permissions the token carries, so
            // the menu and the action buttons only offer what this account
            // can actually do. The API re-checks all of it.
            accessControlProvider={accessControlProvider}
            notificationProvider={notificationProvider}
            routerProvider={routerProvider}
            resources={resources}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              reactQuery: { clientConfig: reactQueryClientConfig },
              projectId: "OjKL83-Rc63sQ-E2vtK1",
              // Drives the sidebar brand block and the document title.
              title: {
                icon: <Landmark />,
                text: "Quyết toán ASXH",
              },
            }}
          >
            <ReportYearProvider>
              <UnsavedChangesGuard>
                <AppRoutes />
              </UnsavedChangesGuard>
            </ReportYearProvider>

            <Toaster />
            {/* Ô tìm kiếm Ctrl K nằm ở `layout/header.tsx` (`CommandPalette`). */}
            <AuthoritiesSync />
            <DocumentTitleHandler />
          </Refine>
          <DevtoolsPanel />
        </DevtoolsProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
