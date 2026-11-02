import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";

import { USERNAME_TAKEN_MESSAGE, type UsernameAvailability } from "./use-username-availability";

/** Dòng trạng thái dưới ô Tên đăng nhập: đang kiểm (quay), dùng được (tích), đã có (x). */
export function UsernameAvailabilityHint({ state }: { state: UsernameAvailability }) {
  if (state === "checking") {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs" aria-live="polite">
        <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
        Đang kiểm tra tên đăng nhập…
      </p>
    );
  }
  if (state === "available") {
    return (
      <p className="text-success-text flex items-center gap-1.5 text-xs" aria-live="polite">
        <CircleCheck aria-hidden className="size-3.5" />
        Tên đăng nhập này dùng được.
      </p>
    );
  }
  if (state === "taken") {
    return (
      <p className="text-destructive-text flex items-center gap-1.5 text-xs" aria-live="polite">
        <CircleX aria-hidden className="size-3.5" />
        {USERNAME_TAKEN_MESSAGE}
      </p>
    );
  }
  return null;
}
