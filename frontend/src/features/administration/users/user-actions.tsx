import { useState } from "react";
import { useEditButton, useUpdate, type BaseKey } from "@refinedev/core";
import { KeyRound, Lock, LockOpen } from "lucide-react";

import type { User } from "@/domains/user/types";
import { errorDescription } from "../labels";
import {
  ConfirmActionDialog,
  RecordActionsMenu,
  RecordHeaderActions,
  type DeleteConfig,
  type MenuAction,
} from "../record-actions";
import { ResetPasswordDialog } from "./reset-password-card";

/**
 * Các việc riêng của một tài khoản: đặt lại mật khẩu, khoá / mở khoá.
 *
 * Cả hai cần quyền sửa người dùng (`users:write`), nên chúng ẩn theo đúng nút
 * Sửa. Khoá là `PATCH /users/{id}` với `status` — cùng điểm cuối form sửa đang
 * dùng; mở khoá đưa tài khoản về "Đang hoạt động".
 */
function useUserExtraActions(user: Pick<User, "id" | "fullName" | "username" | "status">) {
  const edit = useEditButton({ resource: "users", id: user.id });
  const { mutate: update, mutation } = useUpdate();
  const [resetOpen, setResetOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);

  const locked = user.status === "locked";
  const name = user.fullName || user.username;

  const items: MenuAction[] = [
    {
      key: "reset-password",
      label: "Đặt lại mật khẩu",
      icon: KeyRound,
      hidden: edit.hidden,
      disabled: edit.disabled,
      onSelect: () => setResetOpen(true),
    },
    {
      key: "lock",
      label: locked ? "Mở khoá tài khoản" : "Khoá tài khoản",
      icon: locked ? LockOpen : Lock,
      hidden: edit.hidden,
      disabled: edit.disabled || mutation.isPending,
      onSelect: () => setLockOpen(true),
    },
  ];

  const dialogs = (
    <>
      <ResetPasswordDialog
        userId={user.id}
        userName={name}
        open={resetOpen}
        onOpenChange={setResetOpen}
      />
      <ConfirmActionDialog
        open={lockOpen}
        onOpenChange={setLockOpen}
        title={locked ? `Mở khoá tài khoản của ${name}?` : `Khoá tài khoản của ${name}?`}
        description={
          locked
            ? "Cán bộ đăng nhập lại được ngay sau khi mở khoá."
            : "Cán bộ sẽ không đăng nhập được nữa. Số liệu đã nhập vẫn được giữ nguyên. Bạn có thể mở khoá lại bất cứ lúc nào."
        }
        confirmLabel={locked ? "Mở khoá" : "Khoá tài khoản"}
        onConfirm={() => {
          setLockOpen(false);
          update({
            resource: "users",
            id: user.id,
            values: { status: locked ? "active" : "locked" },
            successNotification: {
              type: "success",
              message: locked
                ? `Đã mở khoá tài khoản của ${name}`
                : `Đã khoá tài khoản của ${name}`,
            },
            errorNotification: (error) => ({
              type: "error",
              message: locked ? "Không mở khoá được" : "Không khoá được",
              description: errorDescription(error),
            }),
          });
        }}
      />
    </>
  );

  return { items, dialogs, name };
}

function deleteConfig(user: Pick<User, "username">, name: string): DeleteConfig {
  return {
    label: "Xoá người dùng",
    title: `Xoá người dùng ${name}?`,
    description: `Tài khoản ${user.username} sẽ bị xoá và không lấy lại được. Số liệu cán bộ đã nhập trước đó vẫn được giữ.`,
    successMessage: `Đã xoá người dùng ${name}`,
  };
}

/** Nút ⋯ trên dòng của danh sách người dùng. */
export function UserRowActions({ user }: { user: User }) {
  const { items, dialogs, name } = useUserExtraActions(user);

  return (
    <>
      <RecordActionsMenu
        resource="users"
        id={user.id as BaseKey}
        editLabel="Sửa tài khoản"
        items={items}
        remove={deleteConfig(user, name)}
      />
      {dialogs}
    </>
  );
}

/** Cụm nút đầu trang chi tiết / sửa của một người dùng. */
export function UserHeaderActions({
  user,
  editing,
}: {
  user: User;
  /** Đang ở màn sửa: bỏ nút Sửa, bỏ mục Đặt lại mật khẩu (thẻ ngay dưới form). */
  editing?: boolean;
}) {
  const { items, dialogs, name } = useUserExtraActions(user);

  return (
    <>
      <RecordHeaderActions
        resource="users"
        id={user.id}
        editLabel={editing ? false : "Sửa tài khoản"}
        showLabel={editing ? "Xem chi tiết" : false}
        items={editing ? items.filter((item) => item.key !== "reset-password") : items}
        remove={deleteConfig(user, name)}
      />
      {dialogs}
    </>
  );
}
