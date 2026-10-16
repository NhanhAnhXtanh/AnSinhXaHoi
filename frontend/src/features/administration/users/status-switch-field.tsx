import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { Switch } from "@/shared/ui/switch";
import type { UserStatus } from "@/domains/user/types";

/**
 * Ô "Trạng thái" của form người dùng: một công tắc "Cho phép đăng nhập".
 *
 * API có ba trạng thái — hoạt động, ngừng, khoá — còn công tắc chỉ có hai vị
 * trí, nên tắt công tắc giữ nguyên "Đã khoá" nếu tài khoản đang bị khoá (khoá
 * và mở khoá là việc riêng trong nút ⋯), còn lại thì thành "Ngừng hoạt động".
 * Không giá trị nào bị mất khi lưu một form không chạm vào ô này.
 *
 * Phải đặt trong `render` của `FormField`.
 */
export function StatusSwitchField({
  value,
  onChange,
  savedStatus,
  className,
}: {
  value: UserStatus | undefined;
  onChange: (next: UserStatus) => void;
  /** Trạng thái đang lưu trên máy chủ, ở màn sửa. */
  savedStatus?: UserStatus;
  className?: string;
}) {
  const allowed = (value ?? "active") === "active";

  return (
    <FormItem className={className}>
      <FormLabel>Trạng thái</FormLabel>
      <div className="flex h-9 items-center gap-2">
        <FormControl>
          <Switch
            checked={allowed}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? "active"
                  : savedStatus === "locked"
                    ? "locked"
                    : "inactive"
              )
            }
          />
        </FormControl>
        <span className="text-sm">
          {allowed
            ? "Cho phép đăng nhập"
            : value === "locked"
              ? "Đã khoá tài khoản"
              : "Không cho phép đăng nhập"}
        </span>
      </div>
      <FormDescription>
        {value === "locked"
          ? "Tài khoản đang bị khoá. Bật lại để cán bộ đăng nhập được."
          : "Tắt nếu cán bộ tạm thời không được đăng nhập."}
      </FormDescription>
      <FormMessage />
    </FormItem>
  );
}
