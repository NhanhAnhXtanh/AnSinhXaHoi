import type { ReactNode } from "react";

import {
  ASXH_FILL_HEIGHT,
  useAsxhFill,
} from "@/shared/components/asxh/asxh-page";
import { cn } from "@/shared/lib/utils";

/**
 * Hai panel đầy chiều cao (Thiết lập, Tổng hợp): cột trái 300px + nội dung
 * phải, cách nhau 16px, mỗi bên tự cuộn.
 *
 * Trong AsxhPage `fill` nó lấp phần còn lại; đứng riêng thì tự lấy chiều cao
 * cửa sổ trừ đầu app. Một khối con duy nhất ở mỗi bên được kéo cao hết cột —
 * panel nào muốn cuộn trong thân mình thì đặt `min-h-0` + `overflow-auto` ở
 * phần thân (PeriodList đã làm sẵn).
 */
export function MasterDetailLayout({
  aside,
  children,
  className,
}: {
  aside: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const inFill = useAsxhFill();

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4 md:flex-row",
        inFill ? "min-h-0 flex-1" : ASXH_FILL_HEIGHT,
        className
      )}
    >
      <aside
        className={cn(
          "flex min-h-0 w-full shrink-0 flex-col overflow-y-auto md:w-75",
          "[&>*]:min-h-0 [&>*:only-child]:flex-1"
        )}
      >
        {aside}
      </aside>
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto",
          "[&>*]:min-h-0 [&>*:only-child]:flex-1"
        )}
      >
        {children}
      </div>
    </div>
  );
}

MasterDetailLayout.displayName = "MasterDetailLayout";
