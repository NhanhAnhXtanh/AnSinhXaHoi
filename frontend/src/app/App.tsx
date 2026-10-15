import { Refine } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

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
import { LayersIcon } from "lucide-react";
// The `@font-face` behind `"Inter Variable"` in `--font-sans`. Without it the
// name resolves only where Inter happens to be installed.
import "@fontsource-variable/inter";
import "@/styles/index.css";

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
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
              notificationProvider={useNotificationProvider()}
              routerProvider={routerProvider}
              resources={resources}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                projectId: "OjKL83-Rc63sQ-E2vtK1",
                // Drives the sidebar brand block and the document title.
                title: {
                  icon: <LayersIcon />,
                  text: "DTH Framework",
                },
              }}
            >
              <UnsavedChangesGuard>
                <AppRoutes />
              </UnsavedChangesGuard>

              <Toaster />
              <RefineKbar />
              <AuthoritiesSync />
              <DocumentTitleHandler />
            </Refine>
            <DevtoolsPanel />
          </DevtoolsProvider>
        </ThemeProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
