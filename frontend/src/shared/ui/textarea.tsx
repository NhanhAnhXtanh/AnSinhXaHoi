import * as React from "react";

import { cn } from "@/shared/lib/utils";

/**
 * `field-sizing-content` cho ô tự cao theo nội dung; `[overflow-wrap:anywhere]` + `max-w-full` giữ
 * bề ngang: không có hai lớp này, một chuỗi dài không dấu cách (đường dẫn, mã) làm ô giãn ngang ra
 * ngoài hộp thoại và đẩy các nút ra khỏi màn hình.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-card flex field-sizing-content min-h-16 w-full max-w-full [overflow-wrap:anywhere] rounded-md border px-3 py-2 text-base shadow-e1 transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
