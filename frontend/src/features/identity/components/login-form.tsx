import { useState } from "react";
import { CircleAlert, Clock, Eye, EyeOff, Landmark, LoaderCircle } from "lucide-react";
import { useLogin, useNotification } from "@refinedev/core";
import { useSearchParams } from "react-router";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";
import { vietnameseOr } from "@/shared/lib/user-message";

import { DevQuickLogin } from "./dev-quick-login";

const WRONG_CREDENTIALS = "Tên đăng nhập hoặc mật khẩu không đúng.";

/**
 * Lời báo lỗi cho cán bộ đọc.
 *
 * `authProvider.login` đã trả câu tiếng Việt cho từng trường hợp (sai mật khẩu,
 * tài khoản ngừng hoạt động, mất mạng, không tải được quyền); đây chỉ là lưới
 * an toàn để một câu tiếng Anh lọt qua không bao giờ hiện ra.
 */
function toVietnamese(message: string | undefined): string {
  return vietnameseOr(message, WRONG_CREDENTIALS);
}

/**
 * Màn đăng nhập.
 *
 * `useLogin` của Refine gọi `authProvider.login` với tên đăng nhập (hoặc email)
 * và mật khẩu. Lỗi hiện ngay dưới ô mật khẩu thay cho thông báo nổi, và khi
 * đường dẫn có `?expired=1` (authProvider.onError đặt khi phiên hết hạn giữa
 * chừng) thì báo phiên trước đã hết hạn ở đầu thẻ.
 *
 * Không có đăng ký hay quên mật khẩu: tài khoản do quản trị viên cấp và đặt lại.
 */
export const LoginForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const expired = searchParams.get("expired") === "1";

  const { mutate: login, isPending } = useLogin<{ username: string; password: string }>();
  const { close } = useNotification();

  const signIn = (username: string, password: string) => {
    setError(null);
    login(
      { username, password },
      {
        onSuccess: (data) => {
          if (!data.success) {
            // `useLogin` tự mở thông báo nổi "login-error"; App.tsx đã chặn nó
            // (lỗi hiện ngay trên form), đóng thêm ở đây cho chắc.
            close?.("login-error");
            setError(toVietnamese(data.error?.message));
          }
        },
        onError: (err) => {
          close?.("login-error");
          setError(toVietnamese(err?.message));
        },
      }
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    signIn(username, password);
  };

  return (
    <div className="gradient-hero relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Lưới mờ trang trí; không được chặn cú bấm vào form phía trên. */}
      <div
        aria-hidden
        className="grid-pattern pointer-events-none absolute inset-0 [background-size:120px_120px]"
      />

      <div className="screen-enter screen-enter-stagger relative flex w-full flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="gradient-gold flex size-14 items-center justify-center rounded-xl text-sidebar-primary-foreground shadow-e4">
            <Landmark className="size-7" aria-hidden />
          </div>
          <h1 className="text-[22px] leading-7 font-bold text-white">
            Hệ thống báo cáo quyết toán An sinh xã hội
          </h1>
          <p className="text-[11px] leading-4 font-semibold tracking-[0.08em] text-white/65 uppercase">
            Sở Tài chính Đồng Nai
          </p>
        </div>

        <div className="flex w-full flex-col gap-5 rounded-lg border bg-card p-8 text-card-foreground shadow-e4 sm:w-[420px]">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl leading-8 font-semibold">Đăng nhập</h2>
            <p className="text-muted-foreground text-sm">
              Nhập tên đăng nhập và mật khẩu để tiếp tục.
            </p>
          </div>

          {expired && (
            <p role="status" className="flex items-start gap-1.5 text-sm font-medium text-warning-text">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              Phiên đăng nhập trước đã hết hạn. Bạn đăng nhập lại để tiếp tục.
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                required
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className="pe-10"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShowPassword((v) => !v)}
                  className={cn(
                    "absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm",
                    "text-muted-foreground transition-colors hover:text-foreground",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  )}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
              {error && (
                <p
                  id="login-error"
                  role="alert"
                  className="flex items-start gap-1.5 text-sm font-medium text-destructive-text"
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {error}
                </p>
              )}
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isPending}>
              {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
              {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </form>

          <DevQuickLogin
            disabled={isPending}
            onPick={(u, p) => {
              setUsername(u);
              setPassword(p);
              signIn(u, p);
            }}
          />

          <p className="text-muted-foreground border-t pt-5 text-xs">
            Tài khoản do quản trị viên cấp. Nếu chưa đăng nhập được, bạn hãy liên hệ
            quản trị viên của mình.
          </p>
        </div>
      </div>
    </div>
  );
};

LoginForm.displayName = "LoginForm";
