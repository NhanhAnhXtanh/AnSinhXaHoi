import { Lock } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import type { UserStatus } from "@/domains/user/types";
import { userStatusLabel } from "../labels";

/**
 * Trạng thái tài khoản: chấm màu cho "Đang hoạt động" / "Ngừng hoạt động",
 * biểu tượng khoá cho "Đã khoá" — khoá là việc quản trị làm có chủ ý, nên nó
 * được nói bằng hình chứ không chỉ bằng màu.
 */
export function UserStatusBadge({ status }: { status: UserStatus | null | undefined }) {
  if (!status) return <span className="text-muted-foreground text-sm">—</span>;

  if (status === "locked") {
    return (
      <Badge variant="neutral" className="gap-1">
        <Lock className="size-3" />
        {userStatusLabel(status)}
      </Badge>
    );
  }

  return (
    <Badge variant={status === "active" ? "success" : "neutral"} dot>
      {userStatusLabel(status)}
    </Badge>
  );
}
