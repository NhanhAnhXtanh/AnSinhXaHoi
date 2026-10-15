import { useState } from "react";
import {
  useCustomMutation,
  useGetIdentity,
  useNotification,
} from "@refinedev/core";

import { API_URL } from "@/shared/api/constants";
import {
  getAuthorities,
  saveSession,
  type Identity,
  type TokenPair,
} from "@/shared/api/session";
import { Breadcrumb } from "@/shared/components/layout/breadcrumb";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { InputPassword } from "@/shared/components/form/input-password";
import { Separator } from "@/shared/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";

/**
 * The signed-in user's own account.
 *
 * Not a Refine resource: there is no list of "my accounts" and no id in the
 * URL. It reads the identity from the auth provider and posts to
 * `/auth/change-password`, which is the one password endpoint that does not
 * need a permission — every account may change its own.
 */
export const Profile = () => {
  const { data: identity } = useGetIdentity<Identity>();
  // Roles and permissions are not part of the identity: they come from
  // `/auth/permissions`, which `authProvider.check` has already fetched and
  // cached by the time any route inside the shell renders.
  const authorities = getAuthorities();
  const { open } = useNotification();
  const { mutate, mutation } = useCustomMutation<TokenPair>();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= 8 && !mismatch;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    mutate(
      {
        url: `${API_URL}/auth/change-password`,
        method: "post",
        values: { currentPassword, newPassword },
        // The rest provider sends a custom-call body as a plain string, so
        // without this the request arrives with no content type and Spring
        // answers 415 before the handler is reached.
        config: { headers: { "Content-Type": "application/json" } },
        successNotification: false,
      },
      {
        onSuccess: ({ data }) => {
          // The server ends every other session and hands back a fresh pair for
          // this one. Storing it is what keeps the person who just changed
          // their password from being signed out by their own action.
          if (data?.accessToken) {
            saveSession(data);
          }
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          open?.({
            type: "success",
            message: "Password changed",
            description: "Your other sessions have been signed out.",
          });
        },
      }
    );
  };

  return (
    <div className={cn("flex flex-col gap-4", "screen-enter screen-enter-stagger")}>
      <Breadcrumb />

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        <p className="text-muted-foreground text-sm">
          Details of the account you are signed in as.
        </p>
      </div>

      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>
              Ask an administrator to change any of this.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Full name
              </span>
              <span className="text-sm">{identity?.fullName ?? "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Username
              </span>
              <span className="text-sm">{identity?.username ?? "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Email
              </span>
              <span className="text-sm">{identity?.email ?? "—"}</span>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Roles
              </span>
              <div className="flex flex-wrap gap-1">
                {authorities?.roles.length ? (
                  authorities.roles.map((role) => (
                    <Badge key={role} variant="outline">
                      {role}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">None</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Permissions ({authorities?.permissions.length ?? 0})
              </span>
              <div className="flex flex-wrap gap-1">
                {authorities?.permissions.map((permission) => (
                  <Badge
                    key={permission}
                    variant="secondary"
                    className="font-mono text-[11px]"
                  >
                    {permission}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
            <CardDescription>
              Your other sessions are signed out; this one stays open.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="current-password">Current password</Label>
                <InputPassword
                  id="current-password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">New password</Label>
                <InputPassword
                  id="new-password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <InputPassword
                  id="confirm-password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {mismatch && (
                  <p className="text-destructive text-sm">
                    The two passwords do not match.
                  </p>
                )}
              </div>

              <div>
                <Button type="submit" disabled={!canSubmit || mutation.isPending}>
                  {mutation.isPending ? "Changing..." : "Change password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
