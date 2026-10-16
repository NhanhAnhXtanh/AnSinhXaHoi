import { useId, useState } from "react";
import { useCustomMutation, useNotification } from "@refinedev/core";

import { API_URL } from "@/shared/api/constants";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { InputPassword } from "@/shared/components/form/input-password";
import {
  FormSection,
  FormSectionActions,
  SectionedFormPanel,
} from "@/shared/components/form/form-section";
import { errorDescription } from "../labels";

/**
 * Đặt lại mật khẩu cho một tài khoản khác.
 *
 * Tách khỏi form sửa tài khoản có chủ ý: lưu hồ sơ và đăng xuất người ta khỏi
 * mọi máy là hai việc khác nhau, gộp lại thì sửa một chữ trong tên cũng làm
 * người đó bị đăng xuất.
 *
 * `useCustomMutation` thay vì `useUpdate`, vì điểm cuối là
 * `POST /users/{id}/password` và trả về người dùng chứ không phải bản ghi vừa
 * vá — nằm ngoài kiểu `update` của data provider.
 */
function useResetPassword(userId: number | string, onDone?: () => void) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { open } = useNotification();
  const { mutate, mutation } = useCustomMutation();

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    password.length >= 8 && confirm === password && !mutation.isPending;

  const submit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!canSubmit) return;

    mutate(
      {
        url: `${API_URL}/users/${userId}/password`,
        method: "post",
        values: { password },
        // Data provider tự tuần tự hoá thân yêu cầu thành chuỗi; thiếu dòng này
        // thì yêu cầu không có kiểu nội dung và máy chủ trả 415.
        config: { headers: { "Content-Type": "application/json" } },
        // Thông báo mặc định sẽ nói "đã tạo", không đúng việc vừa làm.
        successNotification: false,
        errorNotification: (error) => ({
          type: "error",
          message: "Không đặt lại được mật khẩu",
          description: errorDescription(error),
        }),
      },
      {
        onSuccess: () => {
          setPassword("");
          setConfirm("");
          open?.({
            type: "success",
            message: "Đã đặt mật khẩu mới",
            description:
              "Cán bộ bị đăng xuất khỏi mọi máy. Hãy báo mật khẩu mới cho cán bộ.",
          });
          onDone?.();
        },
      }
    );
  };

  return {
    password,
    setPassword,
    confirm,
    setConfirm,
    tooShort,
    mismatch,
    canSubmit,
    pending: mutation.isPending,
    submit,
  };
}

function PasswordFields({
  state,
  className,
}: {
  state: ReturnType<typeof useResetPassword>;
  className?: string;
}) {
  const id = useId();
  return (
    <>
      <div className={className}>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-new`}>
            Mật khẩu mới <span className="text-destructive">*</span>
          </Label>
          <InputPassword
            id={`${id}-new`}
            autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự"
            value={state.password}
            onChange={(e) => state.setPassword(e.target.value)}
            aria-invalid={state.tooShort || undefined}
          />
          <p
            className={
              state.tooShort
                ? "text-destructive text-xs"
                : "text-muted-foreground text-xs"
            }
          >
            {state.tooShort
              ? "Mật khẩu cần ít nhất 8 ký tự."
              : "Nhắc cán bộ đổi mật khẩu sau khi đăng nhập."}
          </p>
        </div>
      </div>
      <div className={className}>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-confirm`}>
            Nhập lại mật khẩu mới <span className="text-destructive">*</span>
          </Label>
          <InputPassword
            id={`${id}-confirm`}
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu vừa đặt"
            value={state.confirm}
            onChange={(e) => state.setConfirm(e.target.value)}
            aria-invalid={state.mismatch || undefined}
          />
          <p
            className={
              state.mismatch
                ? "text-destructive text-xs"
                : "text-muted-foreground text-xs"
            }
          >
            {state.mismatch
              ? "Mật khẩu nhập lại chưa giống mật khẩu mới."
              : "Phải giống mật khẩu mới."}
          </p>
        </div>
      </div>
    </>
  );
}

/** Thẻ "Đặt lại mật khẩu" dưới form sửa tài khoản. */
export function ResetPasswordCard({ userId }: { userId: number | string }) {
  const state = useResetPassword(userId);

  return (
    // Thẻ riêng với `<form>` riêng, nằm cạnh form tài khoản chứ không lồng bên
    // trong: Enter ở đây chỉ đặt mật khẩu, không bao giờ lưu nửa chừng hồ sơ.
    <form id="dat-lai-mat-khau" onSubmit={state.submit} className="min-w-0">
      <SectionedFormPanel>
        <FormSection
          title="Đặt lại mật khẩu"
          description="Dùng khi cán bộ quên mật khẩu. Hệ thống không tự gửi thư, nên bạn cần báo mật khẩu mới cho cán bộ. Cán bộ sẽ bị đăng xuất khỏi mọi máy."
        >
          <PasswordFields state={state} className="md:col-span-6" />
        </FormSection>
        <FormSectionActions>
          <Button type="submit" variant="secondary" disabled={!state.canSubmit}>
            {state.pending ? "Đang đặt..." : "Đặt mật khẩu mới"}
          </Button>
        </FormSectionActions>
      </SectionedFormPanel>
    </form>
  );
}

/** Hộp "Đặt lại mật khẩu" mở từ nút ⋯ trên danh sách người dùng. */
export function ResetPasswordDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: {
  userId: number | string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const state = useResetPassword(userId, () => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={state.submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu cho {userName}</DialogTitle>
            <DialogDescription>
              Cán bộ sẽ bị đăng xuất khỏi mọi máy. Hệ thống không tự gửi thư,
              nên bạn cần báo mật khẩu mới cho cán bộ.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <PasswordFields state={state} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Quay lại
            </Button>
            <Button type="submit" disabled={!state.canSubmit}>
              {state.pending ? "Đang đặt..." : "Đặt mật khẩu mới"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
