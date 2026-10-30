import { useCan, useList } from "@refinedev/core";
import { useNavigate } from "react-router";
import { Eye, Pencil, TriangleAlert, UserPlus, Users } from "lucide-react";

import {
  EmptyState,
  HeaderActions,
  LoadingState,
  RowActions,
  StatusBadge,
  type StatusTone,
} from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import type { User, UserStatus } from "@/domains/user/types";

import type { ReportUnit } from "./model";

const STATUS: Record<UserStatus, { tone: StatusTone; label: string }> = {
  active: { tone: "success", label: "Đang hoạt động" },
  inactive: { tone: "neutral", label: "Ngừng hoạt động" },
  locked: { tone: "locked", label: "Đã khoá" },
};

/**
 * Panel "Tài khoản của đơn vị" ở trang Sửa (Figma 310:35692) — UC-70.
 *
 * Danh sách là người dùng thật gắn với đơn vị (`/api/users?reportUnit.id=`). "Cấp tài
 * khoản" mở form Thêm người dùng với đơn vị điền sẵn và khoá, vai trò cán bộ đơn vị chọn sẵn;
 * lưu xong quay lại đúng trang này. Mỗi đơn vị một tài khoản (BR-69.2) nên nút tắt khi đơn
 * vị đã có tài khoản; đơn vị ngừng hoạt động cũng không cấp được (UC-70 2a). Ngừng hoạt động
 * đơn vị thì máy chủ ngừng luôn tài khoản của đơn vị và đơn vị con (BR-02.1).
 */
export function UnitAccountsPanel({ unit }: { unit: ReportUnit }) {
  const navigate = useNavigate();

  const { data: canReadUsers, isLoading: checkingRead } = useCan({
    resource: "users",
    action: "list",
  });
  const { data: canCreateUsers } = useCan({ resource: "users", action: "create" });
  const mayRead = canReadUsers?.can ?? false;
  const mayCreate = canCreateUsers?.can ?? false;

  const {
    result,
    query: { isLoading, isError, refetch },
  } = useList<User>({
    resource: "users",
    pagination: { pageSize: 50 },
    sorters: [{ field: "username", order: "asc" }],
    filters: [{ field: "reportUnit.id", operator: "eq", value: unit.id }],
    queryOptions: { enabled: mayRead },
    errorNotification: false,
  });

  const accounts = result?.data ?? [];
  const hasAccount = accounts.length > 0;

  const createReason = !mayCreate
    ? "Bạn chưa được cấp quyền tạo tài khoản."
    : !unit.active
      ? "Đơn vị đang ngừng hoạt động nên chưa cấp được tài khoản."
      : hasAccount
        ? "Đơn vị đã có tài khoản. Mỗi đơn vị chỉ có một tài khoản."
        : undefined;

  const openCreate = () => {
    const params = new URLSearchParams({
      reportUnit: String(unit.id),
      reportUnitName: unit.name,
    });
    navigate(`/users/create?${params.toString()}`);
  };

  return (
    <section className="bg-card text-card-foreground border-border flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-e1">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base leading-6 font-semibold">Tài khoản của đơn vị</h2>
        </div>
        <HeaderActions
          secondary={[
            {
              label: "Cấp tài khoản",
              icon: UserPlus,
              onClick: openCreate,
              disabled: createReason !== undefined,
              reason: createReason,
            },
          ]}
        />
      </header>

      {checkingRead ? (
        <LoadingState label="Đang tải tài khoản…" />
      ) : !mayRead ? (
        <EmptyState
          icon={Users}
          title="Bạn chưa được xem danh sách tài khoản"
          description="Việc cấp và quản lý tài khoản do quản trị viên hệ thống thực hiện."
        />
      ) : isLoading ? (
        <LoadingState label="Đang tải tài khoản…" />
      ) : isError ? (
        <EmptyState
          icon={TriangleAlert}
          title="Chưa tải được danh sách tài khoản"
          description="Bạn kiểm tra kết nối rồi thử lại."
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Thử lại
            </Button>
          }
        />
      ) : !hasAccount ? (
        <EmptyState
          icon={Users}
          title="Chưa có tài khoản nào gắn với đơn vị"
          description={
            unit.active
              ? "Bấm “Cấp tài khoản” để tạo tài khoản đăng nhập cho cán bộ của đơn vị."
              : "Đơn vị đang ngừng hoạt động nên chưa cấp được tài khoản."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-6">Tên đăng nhập</TableHead>
              <TableHead>Họ và tên</TableHead>
              <TableHead>Thư điện tử</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-16 pe-6">
                <span className="sr-only">Thao tác</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const status = STATUS[account.status] ?? STATUS.inactive;
              return (
                <TableRow key={account.id}>
                  <TableCell className="px-6">{account.username}</TableCell>
                  <TableCell>{account.fullName || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {account.email || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </TableCell>
                  <TableCell className="pe-6">
                    <RowActions
                      items={[
                        {
                          key: "edit",
                          label: "Sửa tài khoản",
                          icon: Pencil,
                          onSelect: () => navigate(`/users/edit/${account.id}`),
                        },
                        {
                          key: "show",
                          label: "Xem chi tiết",
                          icon: Eye,
                          onSelect: () => navigate(`/users/show/${account.id}`),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
