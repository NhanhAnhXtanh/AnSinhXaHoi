"use client";

import { useState } from "react";

import { useLogin, useRefineOptions } from "@refinedev/core";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { InputPassword } from "@/shared/components/form/input-password";
import { cn } from "@/shared/lib/utils";

/**
 * The sign-in screen.
 *
 * Username *or* email, because the API accepts either and nobody should have to
 * remember which one this system keyed on.
 *
 * There is no self-registration and no password-reset link: accounts are
 * created by an administrator on the Users screen, and a forgotten password is
 * reset there too. Offering either link would send people to a page that cannot
 * help them.
 *
 * The screen sits on `gradient-hero` rather than the page background, and that
 * is the one place in the application where a surface is a picture rather than
 * a token. It is doing a job: this is the only screen somebody sees before they
 * are inside anything, so it is the only one that has to say whose system this
 * is on its own.
 */
export const SignInForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { title } = useRefineOptions();
  const { mutate: login, isPending } = useLogin();

  const handleSignIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    login({ username, password });
  };

  return (
    <div
      className={cn(
        "gradient-hero relative flex min-h-svh flex-col items-center justify-center",
        "px-6 py-10"
      )}
    >
      {/* Texture, and nothing else — it must never intercept a click meant for
          the form sitting on top of it. */}
      <div
        aria-hidden
        className="grid-pattern pointer-events-none absolute inset-0"
      />

      <div
        className={cn(
          "relative flex w-full flex-col items-center",
          "screen-enter screen-enter-stagger"
        )}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          {title.icon && (
            <div
              className={cn(
                "gradient-gold flex size-14 items-center justify-center rounded-xl",
                "shadow-e4 [&>svg]:size-7",
                // The glyph sits on gold, so it takes the dark end of the
                // brand rather than the page's foreground colour, which is
                // near-white here and would vanish.
                "text-sidebar-primary-foreground"
              )}
            >
              {title.icon}
            </div>
          )}
          {title.text && (
            <h1 className="text-xl font-bold tracking-tight text-white">
              {title.text}
            </h1>
          )}
          <p className="text-overline text-white/55">Administration</p>
        </div>

        <Card className={cn("mt-8 w-full p-8 shadow-e4", "sm:w-[420px]")}>
          <CardHeader className={cn("gap-1 px-0")}>
            <CardTitle className={cn("text-2xl font-semibold")}>
              Sign in
            </CardTitle>
            <CardDescription>
              Enter your credentials to continue.
            </CardDescription>
          </CardHeader>

          <CardContent className={cn("px-0")}>
            <form onSubmit={handleSignIn}>
              <div className={cn("flex flex-col gap-2")}>
                <Label htmlFor="username">Username or email</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className={cn("relative mt-5 flex flex-col gap-2")}>
                <Label htmlFor="password">Password</Label>
                <InputPassword
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className={cn("mt-7 w-full")}
                disabled={isPending}
              >
                {isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <p
              className={cn(
                "text-muted-foreground mt-6 border-t border-border pt-4",
                "text-center text-xs"
              )}
            >
              Accounts are created by an administrator. Contact yours if you
              cannot sign in.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

SignInForm.displayName = "SignInForm";
