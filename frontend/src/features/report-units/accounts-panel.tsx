import { UserPlus, Users } from "lucide-react";

import { EmptyState, HeaderActions } from "@/shared/components/asxh";

import type { ReportUnit } from "./model";

/**
 * Panel "Tài khoản của đơn vị" ở trang Sửa (Figma 310:35692).
 *
 * Chưa có dữ liệu thật: bảng tài khoản (`users`) chưa có liên kết tới đơn vị báo cáo
 * (xem TODO BR-02.2 trong `ReportUnitService`), nên panel giữ đúng bố cục Figma nhưng
 * chỉ báo trạng thái rỗng và khoá nút Cấp tài khoản cho tới khi máy chủ có liên kết đó.
 */
export function UnitAccountsPanel({ unit }: { unit: ReportUnit }) {
  return (
    <section className="bg-card text-card-foreground border-border flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-e1">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base leading-6 font-semibold">Tài khoản của đơn vị</h2>
          <p className="text-muted-foreground text-xs leading-4">
            Những người dùng được gắn với đơn vị này và đăng nhập để báo cáo.
          </p>
        </div>
        <HeaderActions
          secondary={[
            {
              label: "Cấp tài khoản",
              icon: UserPlus,
              disabled: true,
              reason: unit.active
                ? "Việc cấp tài khoản cho đơn vị sẽ có ở bản cập nhật sau. Hiện tài khoản được cấp ở màn Người dùng."
                : "Đơn vị đang ngừng hoạt động nên chưa làm được việc này.",
            },
          ]}
        />
      </header>

      <EmptyState
        icon={Users}
        title="Chưa có tài khoản nào gắn với đơn vị"
        description="Tài khoản đăng nhập hiện được cấp ở màn Người dùng. Việc gắn tài khoản với từng đơn vị sẽ có ở bản cập nhật sau."
      />
    </section>
  );
}
