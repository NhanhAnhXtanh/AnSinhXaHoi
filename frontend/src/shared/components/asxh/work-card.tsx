import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import {
  ASXH_FILL_HEIGHT,
  useAsxhFill,
} from "@/shared/components/asxh/asxh-page";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

/**
 * Thẻ màn làm việc (nhập / xem / duyệt phiếu), chiếm hết chiều cao vùng nội dung.
 *
 *   đầu thẻ  [←] tiêu đề + badge ............ actions
 *   dòng phụ meta (thẳng hàng với tiêu đề)
 *   thân     children — tự cuộn (SpreadsheetView lấp đầy)
 *   chân     footer (vd. SheetTabs)
 *
 * Trong AsxhPage `fill` nó lấp phần còn lại; đứng riêng thì tự lấy chiều cao
 * cửa sổ trừ đầu app. `fill={false}` để nó cao theo nội dung.
 */
export function WorkCard({
  title,
  badge,
  meta,
  actions,
  footer,
  backTo,
  fill = true,
  className,
  children,
}: {
  title: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  backTo?: string;
  /** Mặc định true: thẻ cao hết vùng nội dung, thân tự cuộn. */
  fill?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const inFill = useAsxhFill();

  return (
    <section
      className={cn(
        "bg-card text-card-foreground flex min-w-0 flex-col overflow-hidden",
        "rounded-lg border shadow-e1",
        fill && (inFill ? "min-h-0 flex-1" : ASXH_FILL_HEIGHT),
        !inFill && "screen-enter",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-4",
          meta ? "pb-1" : "pb-3"
        )}
      >
        {backTo && (
          <Button variant="outline" size="icon" asChild>
            <Link to={backTo} aria-label="Quay lại">
              <ArrowLeft />
            </Link>
          </Button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h1 className="min-w-0 truncate text-xl leading-7 font-semibold tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {actions && (
          <div
            data-print="hide"
            className="ms-auto flex shrink-0 flex-wrap items-center gap-2"
          >
            {actions}
          </div>
        )}
      </div>

      {meta && (
        <div
          className={cn(
            "text-muted-foreground px-5 pb-3 text-[13px] leading-4.25",
            backTo && "ps-17"
          )}
        >
          {meta}
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto border-t">
        {children}
      </div>

      {footer && (
        <div className="flex min-w-0 shrink-0 items-center gap-2 border-t px-4 py-2">
          {footer}
        </div>
      )}
    </section>
  );
}

WorkCard.displayName = "WorkCard";
