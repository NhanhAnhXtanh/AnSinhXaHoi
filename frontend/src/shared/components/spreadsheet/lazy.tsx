import { lazy, Suspense } from "react";

import { LoadingState } from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";

import type { SpreadDesignerProps, SpreadWorkbookProps } from "./types";

// SpreadJS rất nặng (lõi vài MB, Designer + add-on còn nặng hơn): chỉ tải khi màn
// thật sự mở bảng tính. File này là ranh giới — nó KHÔNG import `@mescius/*`,
// chỉ nạp động `./impl/*` (hàm xuất Excel nằm ở `./export.ts`, cũng nạp động); Vite tách thành chunk riêng (xem manualChunks ở vite.config.ts).

const SpreadWorkbookImpl = lazy(() => import("./impl/spread-workbook"));
const SpreadDesignerImpl = lazy(() => import("./impl/spread-designer"));

function SpreadFallback({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn(
        "bg-card flex h-full min-h-[320px] w-full overflow-hidden rounded-md border",
        className
      )}
    >
      <LoadingState label={label ?? "Đang mở bảng tính…"} />
    </div>
  );
}

/**
 * Bảng tính SpreadJS (nhập, xem, duyệt, tổng hợp). Khung giãn hết chiều cao cha.
 * Xem `SpreadWorkbookProps` cho ý nghĩa từng prop.
 */
export function SpreadWorkbook(props: SpreadWorkbookProps) {
  return (
    <Suspense fallback={<SpreadFallback className={props.className} label={props.loadingLabel} />}>
      <SpreadWorkbookImpl {...props} />
    </Suspense>
  );
}

/** Thiết kế mẫu: SpreadJS Designer có ribbon (chữ tiếng Anh — MESCIUS không có gói tiếng Việt). */
export function SpreadDesigner(props: SpreadDesignerProps) {
  return (
    <Suspense
      fallback={
        <SpreadFallback
          className={cn("min-h-[480px]", props.className)}
          label={props.loadingLabel}
        />
      }
    >
      <SpreadDesignerImpl {...props} />
    </Suspense>
  );
}
