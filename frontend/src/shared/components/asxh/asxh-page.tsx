import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import { Breadcrumb } from "@/shared/components/layout/breadcrumb";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

/**
 * Chiều cao còn lại của vùng nội dung khi màn không được cuộn trang:
 * cả cửa sổ trừ thanh đầu app (h-16) và đệm trên/dưới của <main>
 * (`--shell-gutter-y`, xem `layout.tsx` và `styles/theme.css`).
 *
 * Viết nguyên chuỗi để Tailwind quét được.
 */
export const ASXH_FILL_HEIGHT =
  "h-[calc(100svh_-_4rem_-_2_*_var(--shell-gutter-y))] min-h-[30rem]";

/**
 * Báo cho khối con (WorkCard, MasterDetailLayout) biết nó đang nằm trong một
 * AsxhPage `fill`: khi đó khối con chỉ cần `flex-1 min-h-0` để lấp phần còn
 * lại, thay vì tự tính chiều cao theo cửa sổ (tính hai lần là tràn).
 */
const AsxhFillContext = createContext(false);

export function useAsxhFill(): boolean {
  return useContext(AsxhFillContext);
}

export type AsxhPageProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Hiện nút mũi tên quay về đường dẫn này, trước tiêu đề. */
  backTo?: string;
  badge?: ReactNode;
  /** Cụm bên phải hàng tiêu đề: YearSelect, nút chính, nút ⋯. */
  actions?: ReactNode;
  /**
   * Màn không cuộn trang (hai panel, màn làm việc): nội dung chiếm hết chiều
   * cao còn lại. Khối nào cần lấp phần còn lại thì đặt `flex-1 min-h-0`
   * (WorkCard và MasterDetailLayout tự làm việc này).
   */
  fill?: boolean;
  /** Ẩn đường dẫn trang (mặc định hiện). */
  hideBreadcrumb?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Khung trang ASXH: đường dẫn trang, hàng tiêu đề (nút quay lại, tiêu đề,
 * badge, cụm thao tác bên phải), một dòng mô tả, rồi nội dung.
 *
 * Đầu trang trong suốt trên nền trang — không bọc thẻ.
 */
export function AsxhPage({
  title,
  description,
  backTo,
  badge,
  actions,
  fill = false,
  hideBreadcrumb = false,
  className,
  children,
}: AsxhPageProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4",
        "screen-enter",
        fill && ASXH_FILL_HEIGHT,
        className
      )}
    >
      <header className="flex shrink-0 flex-col gap-2">
        {!hideBreadcrumb && <Breadcrumb />}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {backTo && (
            <Button variant="outline" size="icon" asChild>
              <Link to={backTo} aria-label="Quay lại">
                <ArrowLeft />
              </Link>
            </Button>
          )}
          <h1 className="min-w-0 truncate text-3xl leading-9 font-bold tracking-tight">
            {title}
          </h1>
          {badge}
          {actions && (
            <div
              data-print="hide"
              className="ms-auto flex shrink-0 flex-wrap items-center gap-2"
            >
              {actions}
            </div>
          )}
        </div>
        {description && (
          <p className="text-muted-foreground max-w-3xl text-sm">
            {description}
          </p>
        )}
      </header>

      {fill ? (
        <AsxhFillContext.Provider value>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            {children}
          </div>
        </AsxhFillContext.Provider>
      ) : (
        children
      )}
    </div>
  );
}

AsxhPage.displayName = "AsxhPage";
