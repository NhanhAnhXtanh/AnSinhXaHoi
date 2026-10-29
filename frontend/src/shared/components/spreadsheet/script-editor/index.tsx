import { lazy, Suspense } from "react";

import { LoadingState } from "@/shared/components/asxh";
import { cn } from "@/shared/lib/utils";

import type { ScriptEditorProps } from "./types";

export type { ScriptEditorProps } from "./types";

// Monaco nặng vài MB: chỉ tải khi ô soạn quy tắc thật sự mở. File này là ranh
// giới — nó KHÔNG import `monaco-editor` / `@monaco-editor/react`, chỉ nạp động
// `./script-editor-impl` (Vite tách thành chunk "monaco", xem vite.config.ts).
const ScriptEditorImpl = lazy(() => import("./script-editor-impl"));

/** Ô soạn quy tắc nhập (JavaScript) có tô màu, gợi ý `ctx` và báo lỗi khi gõ. */
export function ScriptEditor(props: ScriptEditorProps) {
  return (
    <Suspense
      fallback={
        <div className={cn("flex min-h-0", props.className)}>
          <LoadingState label="Đang mở ô soạn quy tắc…" />
        </div>
      }
    >
      <ScriptEditorImpl {...props} />
    </Suspense>
  );
}
