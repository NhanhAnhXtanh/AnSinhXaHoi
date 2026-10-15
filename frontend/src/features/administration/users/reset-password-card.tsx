import { useState } from "react";
import { useCustomMutation, useNotification } from "@refinedev/core";
import { KeyRoundIcon } from "lucide-react";

import { API_URL } from "@/shared/api/constants";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { InputPassword } from "@/shared/components/form/input-password";
import { DetailPanel } from "@/shared/components/views/record-detail";

/**
 * Setting a user's password on their behalf.
 *
 * Kept out of the edit form on purpose. Saving a profile and revoking somebody's
 * sessions are different intentions, and folding the second into the first
 * would make a corrected surname sign that person out of their laptop.
 *
 * `useCustomMutation` rather than `useUpdate`, because the endpoint is
 * `POST /users/{id}/password` and returns the user rather than a patched
 * record — outside the shape the data provider's `update` speaks.
 */
export function ResetPasswordCard({ userId }: { userId: number | string }) {
  const [password, setPassword] = useState("");
  const { open } = useNotification();
  const { mutate, mutation } = useCustomMutation();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    mutate(
      {
        url: `${API_URL}/users/${userId}/password`,
        method: "post",
        values: { password },
        // The rest provider serialises a custom-call body itself and sends it
        // as a plain string, so without this the request arrives with no
        // content type and Spring answers 415 before the handler is reached.
        config: { headers: { "Content-Type": "application/json" } },
        // The provider's own success toast would say "Successfully created",
        // which is not what happened.
        successNotification: false,
      },
      {
        onSuccess: () => {
          setPassword("");
          open?.({
            type: "success",
            message: "Password updated",
            description:
              "Every session open under this account has been signed out.",
          });
        },
      }
    );
  };

  return (
    // The same panel the facts beside it sit in, so the aside reads as one
    // column of related things rather than two cards that happen to be stacked.
    <DetailPanel
      title="Reset password"
      action={<KeyRoundIcon className="text-muted-foreground size-4" />}
      bodyClassName="p-4"
    >
      {/*
        Its own `<form>`, and that is load-bearing: it sits beside the account
        form, not inside it, so Enter here sets a password and never saves a
        half-finished profile.
      */}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Sets a new password without needing the current one, and signs out
          every session open under this account.
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">New password</Label>
          <InputPassword
            id="new-password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          className="w-full"
          disabled={mutation.isPending || password.length < 8}
        >
          {mutation.isPending ? "Updating..." : "Set password"}
        </Button>
      </form>
    </DetailPanel>
  );
}
