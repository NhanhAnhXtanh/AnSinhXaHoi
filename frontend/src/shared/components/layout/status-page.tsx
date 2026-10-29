import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * Trang trạng thái nằm trong khung ứng dụng (sidebar và thanh đầu vẫn còn):
 * không có quyền, không tìm thấy trang, lỗi hệ thống.
 *
 * Số đo theo khung Figma "tt/trang-trang-thai" (310:37920): vòng tròn 64px nền
 * `muted` với icon 32px, tiêu đề 24px đậm vừa, mô tả 14px rộng tối đa 448px,
 * hàng nút cách mô tả thêm 8px. Không có mã lỗi, không có số "404" to.
 */
export function StatusPage({
  icon: Icon,
  title,
  description,
  actions,
  footnote,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Một nút chính (viền) và tối đa một liên kết phụ. */
  actions?: ReactNode;
  /** Dòng chữ nhỏ dưới cùng, ví dụ "Mã báo lỗi: …". */
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        "min-h-[60vh] px-6 text-center",
        "screen-enter",
        className
      )}
    >
      <div className="bg-muted text-muted-foreground rounded-full p-4">
        <Icon className="size-8" aria-hidden />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="text-muted-foreground max-w-md text-sm">{description}</p>
      )}

      {actions && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {actions}
        </div>
      )}

      {footnote && (
        <p className="text-muted-foreground pt-12 text-xs">{footnote}</p>
      )}
    </div>
  );
}

StatusPage.displayName = "StatusPage";
