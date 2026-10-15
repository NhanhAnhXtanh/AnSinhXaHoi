"use client";

import * as React from "react";
import { useTranslate, useWarnAboutChange } from "@refinedev/core";
import {
  UNSAFE_NavigationContext,
  useLocation,
  type Navigator,
} from "react-router";
import { TriangleAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

/**
 * Something the user asked for that would lose the edits they have made, held
 * until the dialog is answered.
 *
 * `run` closes over the *original* `push` / `go` — or, for a caller that came in
 * through `useConfirmDiscard`, over whatever that caller wanted to do — so
 * letting it through is a plain call rather than a dance with the effect that
 * installed the patch.
 */
type PendingAction = {
  run: () => void;
};

/**
 * Ask before discarding, from a place the history navigator cannot see.
 *
 * `null` when the guard is not mounted above the caller, which is what makes
 * `useConfirmDiscard` degrade to running the action straight through rather
 * than throwing.
 */
const ConfirmDiscardContext = React.createContext<
  ((run: () => void) => void) | null
>(null);

/**
 * Run something, but ask first if the form on screen has unsaved edits.
 *
 * For the dismissals the guard cannot recognise on its own. It watches the
 * history navigator's `push` and `go`, which covers every ordinary navigation —
 * but not `replace`, which is deliberately left alone (see the guard below). A
 * dialog that *is* a route dismisses with `replace`, so `route-dialog.tsx` says
 * so explicitly rather than hoping to be guessed at.
 */
export function useConfirmDiscard() {
  const confirm = React.useContext(ConfirmDiscardContext);
  return React.useMemo(() => confirm ?? ((run: () => void) => run()), [confirm]);
}

type UnsavedChangesGuardProps = React.PropsWithChildren<{
  /** Overrides the heading. */
  title?: React.ReactNode;
  /**
   * Overrides the body text. Defaults to the `warnWhenUnsavedChanges`
   * translation key, so an `i18nProvider` can still supply it.
   */
  message?: React.ReactNode;
  /** Label of the button that abandons the changes. */
  discardLabel?: React.ReactNode;
  /** Label of the button that keeps the user where they are. */
  stayLabel?: React.ReactNode;
}>;

const DEFAULT_MESSAGE =
  "You have unsaved changes on this page. If you leave now, they will be lost.";

/**
 * What `@refinedev/react-router`'s `UnsavedChangesNotifier` does, asked with the
 * application's own dialog.
 *
 * Refine answers `options.warnWhenUnsavedChanges` with `window.confirm` — a
 * browser chrome dialog that carries the page's origin, ignores the theme, and
 * offers "OK" / "Cancel" for a decision about losing work.
 *
 * The mechanism has to stay the same, though. `App.tsx` mounts a
 * `<BrowserRouter>` rather than a data router, so `useBlocker` does not exist
 * here; the only place to intervene is the history `navigator`, whose `push`
 * and `go` are synchronous and expect an answer *now*. A dialog cannot answer
 * synchronously — so instead of asking, this refuses the navigation outright,
 * keeps the call in `pending`, and replays it if the user says to leave.
 *
 * **`replace` is not patched, and must not be.** It is not the user saying "go
 * somewhere else": `useTable`'s `syncWithLocation` writes filters, sorting and
 * pagination back to the URL with it from inside an effect, and every
 * `<Navigate replace>` redirect in `routes.tsx` uses it too. Patching it would
 * put this dialog in front of a session that just expired, and in front of a
 * list quietly syncing its own query string behind an open dialog. The one
 * `replace` that genuinely is the user's decision — dismissing a `RouteDialog` —
 * asks through `useConfirmDiscard` instead, which is a call somebody wrote
 * rather than a class of navigation guessed at.
 *
 * Closing the tab still gets the browser's own dialog: `beforeunload` is the one
 * prompt no page may style or replace, and browsers stopped honouring a custom
 * message years ago precisely so a page could not dress it up.
 */
export function UnsavedChangesGuard({
  children,
  title = "Discard unsaved changes?",
  message,
  discardLabel = "Discard changes",
  stayLabel = "Stay on this page",
}: UnsavedChangesGuardProps) {
  const translate = useTranslate();
  const { pathname } = useLocation();
  const { warnWhen, setWarnWhen } = useWarnAboutChange();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);

  const [pending, setPending] = React.useState<PendingAction | null>(null);

  // `useWarnAboutChange` only returns the context's own setter while Refine's
  // provider is above us; without it the hook builds a fresh no-op every render.
  // Reaching both values through refs is what keeps the effects below keyed on
  // what they are actually about, and `hold` stable enough to hand to consumers.
  const warnWhenRef = React.useRef(warnWhen);
  warnWhenRef.current = warnWhen;
  const setWarnWhenRef = React.useRef(setWarnWhen);
  setWarnWhenRef.current = setWarnWhen;

  // Raised while the held action is replayed, so the patch below lets it past
  // instead of holding it a second time and reopening the dialog.
  const replaying = React.useRef(false);

  const hold = React.useCallback((run: () => void) => {
    if (replaying.current || !warnWhenRef.current) {
      run();
      return;
    }
    // A second attempt while the dialog is up must not overwrite the first — the
    // user is answering about that one.
    setPending((current) => current ?? { run });
  }, []);

  // Refine's own notifier clears the flag whenever the route changes; a form
  // left behind must not go on warning about the page that replaced it.
  React.useEffect(() => {
    return () => setWarnWhenRef.current?.(false);
  }, [pathname]);

  // Leaving the application entirely. The browser owns this one.
  React.useEffect(() => {
    if (!warnWhen) return;

    const listener = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Assigning it is what still triggers the prompt in older browsers; the
      // string itself has been ignored by all of them for years.
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [warnWhen]);

  // Navigating inside the application.
  React.useEffect(() => {
    if (!warnWhen) return;

    const { push, go } = navigator;

    navigator.push = (...args: Parameters<Navigator["push"]>) => {
      hold(() => push(...args));
    };
    navigator.go = (...args: Parameters<Navigator["go"]>) => {
      hold(() => go(...args));
    };

    return () => {
      navigator.push = push;
      navigator.go = go;
    };
  }, [navigator, warnWhen, hold]);

  const discard = () => {
    const run = pending?.run;
    setPending(null);
    setWarnWhenRef.current?.(false);
    if (!run) return;

    // That state has not flushed yet, so the patch is still installed and `run`
    // may well go straight back through it.
    replaying.current = true;
    try {
      run();
    } finally {
      replaying.current = false;
    }
  };

  return (
    <ConfirmDiscardContext.Provider value={hold}>
      {children}

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          // `Esc` is the same answer as the cancel button: stay, and drop what
          // was being held.
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader className="flex-row items-start gap-4 space-y-0 text-left sm:text-left">
            <span
              aria-hidden
              className="bg-warning/10 text-warning flex size-10 shrink-0 items-center justify-center rounded-full"
            >
              <TriangleAlert className="size-5" />
            </span>
            <div className="flex flex-col gap-2">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>
                {message ?? translate("warnWhenUnsavedChanges", DEFAULT_MESSAGE)}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>{stayLabel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={discard}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              {discardLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmDiscardContext.Provider>
  );
}

UnsavedChangesGuard.displayName = "UnsavedChangesGuard";
