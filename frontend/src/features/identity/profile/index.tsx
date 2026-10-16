import { useMemo, useState, type ReactNode } from "react";
import {
  useCan,
  useCustomMutation,
  useGetIdentity,
  useNotification,
  useOne,
} from "@refinedev/core";

import { API_URL } from "@/shared/api/constants";
import {
  getAuthorities,
  saveSession,
  type Identity,
  type TokenPair,
} from "@/shared/api/session";
import { Breadcrumb } from "@/shared/components/layout/breadcrumb";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { InputPassword } from "@/shared/components/form/input-password";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";
import type { User } from "@/domains/user/types";
import { workLabels } from "./labels";

/**
 * Tài khoản của người đang đăng nhập (Figma 311:87428 — hai thẻ 1:1).
 *
 * Không phải một resource của Refine: không có danh sách "tài khoản của tôi"
 * và không có mã trên đường dẫn. Thông tin lấy từ auth provider; đổi mật khẩu
 * gửi tới `/auth/change-password`, điểm cuối duy nhất về mật khẩu không cần
 * quyền — tài khoản nào cũng đổi được mật khẩu của mình.
 */

function InfoItem({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-overline text-muted-foreground">{label}</span>
      <div className="min-w-0 text-sm break-words">{children}</div>
    </div>
  );
}

/** Độ mạnh mật khẩu 0–4, chỉ để gợi ý; máy chủ chỉ đòi tối thiểu 8 ký tự. */
function passwordStrength(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-zA-Z]/.test(value) && /\d/.test(value)) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/[^a-zA-Z0-9]/.test(value) || value.length >= 12) score += 1;
  return value.length < 8 ? Math.min(score, 1) : score;
}

const STRENGTH_TEXT = [
  "",
  "Độ mạnh: Yếu. Dùng ít nhất 8 ký tự, có cả chữ và số.",
  "Độ mạnh: Trung bình. Thêm chữ hoa để mạnh hơn.",
  "Độ mạnh: Khá. Thêm ký tự đặc biệt để mạnh hơn.",
  "Độ mạnh: Mạnh.",
];

function StrengthMeter({ value }: { value: string }) {
  const score = passwordStrength(value);
  if (!value) return null;
  const fill =
    score >= 3 ? "bg-success" : score === 2 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn("h-1 rounded-full", step <= score ? fill : "bg-muted")}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{STRENGTH_TEXT[score]}</p>
    </div>
  );
}

export const Profile = () => {
  const { data: identity } = useGetIdentity<Identity>();
  // Vai trò và quyền không nằm trong identity: chúng đến từ `/auth/permissions`,
  // đã được `authProvider.check` tải và lưu trước khi vào giao diện.
  const authorities = getAuthorities();
  const { open } = useNotification();
  const { mutate, mutation } = useCustomMutation<TokenPair>();

  // Tên vai trò và đơn vị công tác chỉ có trong bản ghi người dùng — đọc được
  // khi tài khoản có quyền xem người dùng; không thì hiện những gì phiên đăng
  // nhập có sẵn.
  const { data: canReadUsers } = useCan({ resource: "users", action: "show" });
  const { result: me } = useOne<User>({
    resource: "users",
    id: identity?.id,
    queryOptions: {
      enabled: Boolean(identity?.id) && (canReadUsers?.can ?? false),
    },
    errorNotification: false,
  });

  const work = useMemo(
    () => workLabels(authorities?.permissions ?? []),
    [authorities?.permissions]
  );

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= 8 && !mismatch;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    mutate(
      {
        url: `${API_URL}/auth/change-password`,
        method: "post",
        values: { currentPassword, newPassword },
        // Data provider gửi thân yêu cầu dạng chuỗi; thiếu dòng này thì không
        // có kiểu nội dung và máy chủ trả 415.
        config: { headers: { "Content-Type": "application/json" } },
        successNotification: false,
        errorNotification: (error) => ({
          type: "error",
          message: "Không đổi được mật khẩu",
          description:
            error && typeof error === "object" && "message" in error
              ? String((error as { message?: unknown }).message ?? "")
              : "Kiểm tra lại mật khẩu hiện tại.",
        }),
      },
      {
        onSuccess: ({ data }) => {
          // Máy chủ đăng xuất mọi phiên khác và trả cặp khoá mới cho phiên này.
          // Lưu lại để người vừa đổi mật khẩu không tự đăng xuất chính mình.
          if (data?.accessToken) {
            saveSession(data);
          }
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          open?.({
            type: "success",
            message: "Đã đổi mật khẩu",
            description: "Các máy khác đã bị đăng xuất; máy này vẫn giữ đăng nhập.",
          });
        },
      }
    );
  };

  const roleNames =
    me?.roles?.map((role) => role.name) ?? authorities?.roles ?? [];

  return (
    <div className={cn("flex flex-col gap-4", "screen-enter screen-enter-stagger")}>
      <div className="flex flex-col gap-3">
        <Breadcrumb />
        <div>
          <h1 className="text-3xl leading-9 font-bold tracking-tight">
            Tài khoản của tôi
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Thông tin của tài khoản bạn đang đăng nhập và đổi mật khẩu.
          </p>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin tài khoản</CardTitle>
            <CardDescription>
              Muốn đổi các thông tin này, hãy nhờ quản trị viên hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <InfoItem label="Họ và tên">{identity?.fullName ?? "—"}</InfoItem>
            <InfoItem label="Tên đăng nhập">{identity?.username ?? "—"}</InfoItem>
            <InfoItem label="Thư điện tử">{identity?.email ?? "—"}</InfoItem>
            <InfoItem label="Đơn vị công tác">
              {me
                ? me.organization
                  ? me.department
                    ? `${me.organization.name} · ${me.department.name}`
                    : me.organization.name
                  : "Không thuộc đơn vị nào"
                : "—"}
            </InfoItem>
            <InfoItem label="Vai trò" className="sm:col-span-2">
              {roleNames.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {roleNames.map((role) => (
                    <Badge key={role} variant="outline">
                      {role}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">Chưa có vai trò nào</span>
              )}
            </InfoItem>
            <InfoItem label="Việc được làm" className="sm:col-span-2">
              {work.length ? (
                work.join(" · ")
              ) : (
                <span className="text-muted-foreground">Chưa được cấp việc nào</span>
              )}
            </InfoItem>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Đổi mật khẩu</CardTitle>
            <CardDescription>
              Sau khi đổi, các máy khác sẽ bị đăng xuất; máy này vẫn giữ đăng
              nhập.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="current-password">
                  Mật khẩu hiện tại <span className="text-destructive">*</span>
                </Label>
                <InputPassword
                  id="current-password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Mật khẩu bạn đang dùng để đăng nhập.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">
                  Mật khẩu mới <span className="text-destructive">*</span>
                </Label>
                <InputPassword
                  id="new-password"
                  autoComplete="new-password"
                  placeholder="Tối thiểu 8 ký tự"
                  minLength={8}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  aria-invalid={tooShort || undefined}
                />
                <p
                  className={cn(
                    "text-xs",
                    tooShort ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {tooShort
                    ? "Mật khẩu mới cần ít nhất 8 ký tự."
                    : "Tối thiểu 8 ký tự, nên có cả chữ và số."}
                </p>
                <StrengthMeter value={newPassword} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-password">
                  Nhập lại mật khẩu mới <span className="text-destructive">*</span>
                </Label>
                <InputPassword
                  id="confirm-password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={mismatch || undefined}
                />
                <p
                  className={cn(
                    "text-xs",
                    mismatch ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {mismatch
                    ? "Mật khẩu nhập lại chưa giống mật khẩu mới."
                    : "Nhập lại đúng mật khẩu mới."}
                </p>
              </div>

              <div>
                <Button type="submit" disabled={!canSubmit || mutation.isPending}>
                  {mutation.isPending ? "Đang đổi..." : "Đổi mật khẩu"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
