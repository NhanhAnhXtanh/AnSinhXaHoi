import { useState } from "react";
import { ChevronsUpDown, Zap } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { includesFolded } from "@/shared/lib/fold-vi";

/**
 * TẠM, CHỈ KHI PHÁT TRIỂN: ô chọn có tìm kiếm, chọn một tài khoản là đăng nhập
 * luôn, khỏi gõ mật khẩu.
 *
 * Chỉ hiện khi chạy `vite dev` (`import.meta.env.DEV`), nên bản build không có
 * khối này. Mật khẩu là mật khẩu dev của seed (`005`, `167`), đổi trên máy nào
 * người khác vào được. Gỡ: xoá file này và dòng `<DevQuickLogin …/>` ở
 * `login-form.tsx`.
 */
const DEV_ACCOUNTS = [
  { username: "so.dieuhanh", password: "User@123", name: "Phạm Minh Tuấn", role: "Sở · Điều hành đợt" },
  { username: "so.duyet", password: "User@123", name: "Nguyễn Thị Thu", role: "Sở · Duyệt phiếu" },
  { username: "so.tonghop", password: "User@123", name: "Đặng Thanh Hà", role: "Sở · Tổng hợp, nộp năm" },
  { username: "ubnd.duyet", password: "User@123", name: "Lê Quốc Bảo", role: "UBND · Duyệt báo cáo năm" },
  { username: "viewer", password: "User@123", name: "Người xem", role: "Nhiều vai Sở + UBND" },
  { username: "admin", password: "Admin@123", name: "Quản trị hệ thống", role: "Quản trị hệ thống" },
  { username: "manager", password: "Manager@123", name: "Quản lý nội dung", role: "Quản lý nội dung" },
] as const;

export function DevQuickLogin({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (username: string, password: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="flex flex-col gap-2 border-t pt-5">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-[0.06em] uppercase">
        <Zap className="size-3.5" aria-hidden />
        Đăng nhập nhanh (bản thử)
      </p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full cursor-pointer justify-between font-normal"
          >
            <span className="text-muted-foreground truncate">Chọn tài khoản để vào luôn</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          {/* Tìm không phân biệt dấu: gõ "tong hop" vẫn ra "Tổng hợp". */}
          <Command
            filter={(value, search, keywords) =>
              includesFolded(`${value} ${(keywords ?? []).join(" ")}`, search) ? 1 : 0
            }
          >
            <CommandInput placeholder="Tìm theo vai, tên hoặc tên đăng nhập..." />
            <CommandList>
              <CommandEmpty>Không có tài khoản nào khớp.</CommandEmpty>
              <CommandGroup>
                {DEV_ACCOUNTS.map((a) => (
                  <CommandItem
                    key={a.username}
                    value={a.username}
                    keywords={[a.role, a.name]}
                    className="cursor-pointer"
                    onSelect={() => {
                      setOpen(false);
                      onPick(a.username, a.password);
                    }}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{a.role}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {a.name} · {a.username}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
