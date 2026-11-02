import { usePermissions } from "@refinedev/core";
import { useCallback } from "react";

import { permissionFor } from "@/shared/lib/permissions";

/**
 * Màn mà Trang chủ có liên kết tới, theo đầu đường dẫn → tên resource trong `app/resources`
 * (cùng resource mà route bọc `CanAccess … action="list"`). Trang chi tiết (`/input-reports/12`)
 * nằm dưới route của danh sách nên theo cùng quyền.
 */
const SCREEN_OF_PATH: readonly (readonly [string, string])[] = [
  ["/input-reports", "input_reports"],
  ["/report-review", "report_review"],
  ["/summary", "summary"],
  ["/period-setup", "period_setup"],
  ["/templates", "templates"],
  ["/report-calendar", "report_calendar"],
  ["/report-units", "report_units"],
  ["/users", "users"],
];

/**
 * `canOpen(to)`: tài khoản mở được màn ở đường dẫn `to` không — cùng luật lọc menu bên trái
 * (`useAccessibleMenuItems`): cần quyền `list` của resource. Liên kết Trang chủ dùng để không dẫn
 * người dùng vào trang "chưa có quyền". Chưa tải xong danh sách quyền thì coi như chưa mở được;
 * đường dẫn ngoài danh sách trên thì không chặn.
 */
export function useCanOpen(): (to: string) => boolean {
  const { data: permissions } = usePermissions<string[]>({});
  return useCallback(
    (to: string) => {
      const screen = SCREEN_OF_PATH.find(([prefix]) => to === prefix || to.startsWith(`${prefix}/`) || to.startsWith(`${prefix}?`));
      if (!screen) return true;
      if (!permissions) return false;
      const required = permissionFor(screen[1], "list");
      return !required || permissions.includes(required);
    },
    [permissions]
  );
}
