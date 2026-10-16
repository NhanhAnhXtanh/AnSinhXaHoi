import { useGo } from "@refinedev/core";
import { House, ShieldAlertIcon } from "lucide-react";

import { StatusPage } from "@/shared/components/layout/status-page";
import { Button } from "@/shared/ui/button";

/**
 * What a signed-in user sees when they reach a screen their roles do not cover.
 *
 * Distinct from the "not found" page in `error-component.tsx` on purpose. The
 * page exists and the address is right; what is missing is a permission, and
 * saying so is the difference between "you mistyped" and "ask an administrator".
 *
 * Reached by typing or bookmarking a URL — the sidebar already hides what it
 * leads to. The API refuses the same request independently, so this is a
 * courtesy, not the boundary.
 *
 * `resource` is still accepted so the routes keep compiling, but it is no
 * longer printed: it is an internal data name (`blog_posts`), and the page is
 * read by people who should never have to see one (`trang-thai-chung.md` §7).
 */
export function Forbidden(_props: { resource?: string }) {
  const go = useGo();

  return (
    <StatusPage
      icon={ShieldAlertIcon}
      title="Bạn chưa có quyền xem trang này"
      description={
        <>
          Tài khoản của bạn chưa được cấp quyền mở trang này.
          <br />
          Nếu công việc cần, hãy liên hệ người quản trị của Sở Tài chính.
        </>
      }
      actions={
        <Button variant="outline" onClick={() => go({ to: "/" })}>
          <House />
          Về trang chủ
        </Button>
      }
    />
  );
}

Forbidden.displayName = "Forbidden";
