import type { ReactNode } from "react";
import { ClockAlert, Lock } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";

export type StatusTone =
  | "neutral"
  | "outline"
  | "info"
  | "warning"
  | "success"
  | "destructive"
  | "locked"
  | "overdue";

type BadgeVariant =
  | "neutral"
  | "outline"
  | "info"
  | "warning"
  | "success"
  | "destructive";

const VARIANT: Record<StatusTone, BadgeVariant> = {
  neutral: "neutral",
  outline: "outline",
  info: "info",
  warning: "warning",
  success: "success",
  destructive: "destructive",
  locked: "neutral",
  overdue: "destructive",
};

/**
 * Badge trạng thái: bo tròn, nền nhạt, chữ cùng tông.
 *
 * Tông thường có chấm 6px ở đầu; "locked" (Đã khoá/Đã chốt) mang icon ổ khoá
 * trên nền xám, "overdue" (Quá hạn) mang icon đồng hồ trên nền đỏ nhạt — hai
 * trạng thái này cần đọc được cả khi không phân biệt được màu.
 */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  const iconTone = tone === "locked" || tone === "overdue";
  const Icon = tone === "locked" ? Lock : tone === "overdue" ? ClockAlert : null;

  return (
    <Badge
      variant={VARIANT[tone]}
      dot={!iconTone}
      className={cn(iconTone && "gap-1 ps-2", className)}
    >
      {Icon && <Icon aria-hidden />}
      {children}
    </Badge>
  );
}

StatusBadge.displayName = "StatusBadge";
