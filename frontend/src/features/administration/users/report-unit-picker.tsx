import { useEffect, useMemo, useState } from "react";
import { useCan, useList } from "@refinedev/core";
import { Check, ChevronsUpDown } from "lucide-react";

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
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
} from "@/shared/ui/form";
import { cn } from "@/shared/lib/utils";
import type { ReportUnitSummary } from "@/domains/user/types";

/**
 * Ô "Đơn vị công tác" của form người dùng (Figma 310:26715 / 310:36846): ô chọn có ô gõ để
 * tìm đơn vị báo cáo, tìm phía máy chủ qua `q` của `/api/report_units`.
 *
 * Giá trị theo đúng quy ước ba trạng thái của API: `{ id: n }` gắn đơn vị, `{ id: null }`
 * bỏ gắn (tài khoản Sở / UBND). Đơn vị đang ngừng hoạt động hiện mờ và không chọn được — máy
 * chủ cũng từ chối để tài khoản hoạt động trong đơn vị đó (UC-02 3b).
 *
 * Chỉ dùng trong feature này: màn Đơn vị mở form tạo người dùng qua đường dẫn
 * `/users/create?reportUnit={id}` chứ không nhúng ô chọn này.
 */

export type ReportUnitRef = { id: number | null };

/** Dòng `/api/report_units` — chỉ những trường ô chọn đọc (khai cục bộ, không nhập feature khác). */
type ReportUnitOption = {
  id: number;
  budgetCode: string;
  name: string;
  parent: { id: number; name: string } | null;
  active: boolean;
};

const NONE = "__none__";

type ReportUnitPickerProps = {
  value: ReportUnitRef | null | undefined;
  onChange: (value: ReportUnitRef) => void;
  /**
   * Đơn vị đang lưu của bản ghi (form Sửa) hoặc đơn vị điền sẵn (Cấp tài khoản từ màn Đơn
   * vị) — để ô hiện đúng tên ngay cả trước khi danh sách về, và cả khi không có quyền đọc
   * danh sách đơn vị.
   */
  current?: Pick<ReportUnitSummary, "id" | "name"> | null;
  /** Khoá ô (UC-70: cấp tài khoản từ màn Đơn vị thì đơn vị đã điền sẵn và khoá). */
  locked?: boolean;
  className?: string;
};

export function ReportUnitPicker({
  value,
  onChange,
  current,
  locked = false,
  className,
}: ReportUnitPickerProps) {
  const { data: canReadUnits } = useCan({ resource: "report_units", action: "list" });
  const mayRead = canReadUnits?.can ?? false;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  // Tên của lựa chọn vừa bấm — danh sách đổi theo ô tìm, nên không trông vào nó để hiện tên.
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);

  // Gõ liền tay chỉ gửi một yêu cầu, sau khi dừng gõ.
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(input.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [input]);

  const {
    result,
    query: { isFetching },
  } = useList<ReportUnitOption>({
    resource: "report_units",
    pagination: { pageSize: 30 },
    sorters: [{ field: "name", order: "asc" }],
    filters: term ? [{ field: "q", operator: "eq", value: term }] : [],
    queryOptions: { enabled: mayRead && open },
    errorNotification: false,
  });

  const options = result?.data ?? [];
  const selectedId = value?.id ?? null;

  const selectedName = useMemo(() => {
    if (selectedId == null) return null;
    if (picked?.id === selectedId) return picked.name;
    if (current?.id === selectedId) return current.name;
    return options.find((option) => option.id === selectedId)?.name ?? null;
  }, [selectedId, picked, current, options]);

  const choose = (option: { id: number; name: string } | null) => {
    setPicked(option);
    onChange({ id: option?.id ?? null });
    setOpen(false);
    setInput("");
  };

  const disabled = locked || !mayRead;

  return (
    <FormItem className={className}>
      <FormLabel>Đơn vị công tác</FormLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="w-full justify-between font-normal"
            >
              <span
                className={cn(
                  "truncate",
                  selectedName == null && "text-muted-foreground"
                )}
              >
                {selectedName ??
                  (selectedId != null ? "Đang tải..." : "Gõ tên đơn vị để tìm")}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-72 p-0"
        >
          {/* Lọc phía máy chủ, nên tắt bộ lọc của cmdk để nó không ẩn kết quả lần nữa. */}
          <Command shouldFilter={false}>
            <CommandInput
              value={input}
              onValueChange={setInput}
              placeholder="Gõ tên hoặc mã đơn vị..."
            />
            <CommandList>
              <CommandEmpty>
                {isFetching ? "Đang tìm..." : "Không có đơn vị nào khớp."}
              </CommandEmpty>
              <CommandGroup>
                <CommandItem value={NONE} onSelect={() => choose(null)}>
                  <span className="flex min-w-0 flex-col">
                    <span>Không gắn đơn vị</span>
                    <span className="text-muted-foreground text-xs">
                      Tài khoản của Sở hoặc UBND
                    </span>
                  </span>
                  <Check
                    className={cn(
                      "ms-auto size-4",
                      selectedId == null ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={String(option.id)}
                    disabled={!option.active}
                    onSelect={() => choose({ id: option.id, name: option.name })}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{option.name}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {!option.active
                          ? "Đang ngừng hoạt động"
                          : option.parent
                            ? `Thuộc ${option.parent.name}`
                            : "Đơn vị cấp cao nhất"}
                      </span>
                    </span>
                    <Check
                      className={cn(
                        "ms-auto size-4",
                        selectedId === option.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FormDescription>
        {locked
          ? "Tài khoản được cấp cho đơn vị này; muốn đổi đơn vị hãy sửa sau khi tạo."
          : mayRead
            ? "Để trống nếu là tài khoản của Sở hoặc UBND. Mỗi đơn vị chỉ có một tài khoản."
            : "Bạn chưa có quyền xem danh sách đơn vị nên không đổi được ô này."}
      </FormDescription>
    </FormItem>
  );
}
