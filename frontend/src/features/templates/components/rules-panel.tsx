import { useId } from "react";
import { LoaderCircle, Play, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";

/**
 * Các bước của script chạy thử được từ màn thiết kế (bước gắn vào thao tác sửa
 * ô thì tự chạy khi gõ, không chạy riêng). Giá trị là tên bước trong script.
 */
export const RUNNABLE_HOOKS: { value: string; label: string }[] = [
  { value: "onLoad", label: "Khi mở biểu" },
  { value: "afterInject", label: "Sau khi điền số tổng hợp" },
  { value: "validate", label: "Kiểm tra trước khi nộp" },
  { value: "beforeExtract", label: "Trước khi lấy số liệu" },
  { value: "getInputData", label: "Lấy số liệu khi duyệt" },
  { value: "getSummaryData", label: "Lấy số liệu tổng hợp" },
];

/**
 * Khung "Công thức và quy tắc nhập" bên phải bảng thiết kế (khung 311:88923):
 * chọn bước chạy thử, vùng soạn nền tối (chữ đơn cách), nhật ký chạy thử.
 * Bản Jmix dùng Monaco; ở đây là ô soạn văn bản thường — không thêm gói mới.
 * Nội dung lưu cùng nút Lưu của màn (một lần với bảng tính, UC-11 / UC-12).
 */
export function RulesPanel({
  script,
  onChange,
  readOnly,
  hook,
  onHookChange,
  log,
  running,
  onRun,
  onClose,
  className,
}: {
  script: string;
  onChange: (script: string) => void;
  readOnly: boolean;
  hook: string;
  onHookChange: (hook: string) => void;
  log: { time: string; text: string; error?: boolean }[];
  running: boolean;
  onRun: () => void;
  onClose: () => void;
  className?: string;
}) {
  const hookId = useId();
  const codeId = useId();

  return (
    <aside
      aria-label="Công thức và quy tắc nhập"
      className={cn("bg-card flex min-h-0 flex-col border-l", className)}
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          Công thức và quy tắc nhập
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Đóng khung quy tắc"
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      </div>

      <div className="flex items-end gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor={hookId}>Chạy thử bước</Label>
          <Select value={hook} onValueChange={onHookChange}>
            <SelectTrigger id={hookId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RUNNABLE_HOOKS.map((h) => (
                <SelectItem key={h.value} value={h.value}>
                  {h.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={running || !script.trim()}
          onClick={onRun}
        >
          {running ? (
            <LoaderCircle aria-hidden className="animate-spin" />
          ) : (
            <Play aria-hidden />
          )}
          Chạy thử
        </Button>
      </div>

      {/* Vùng soạn nền tối: dùng tông của thanh bên để đọc tốt ở cả chế độ sáng và tối. */}
      <div className="bg-sidebar text-sidebar-foreground flex min-h-0 flex-1 flex-col">
        <label htmlFor={codeId} className="sr-only">
          Nội dung công thức và quy tắc nhập
        </label>
        <textarea
          id={codeId}
          value={script}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={
            readOnly
              ? "Phiên bản này chưa có quy tắc nhập."
              : "return defineScript({\n  onLoad(ctx) {\n    // …\n  },\n})"
          }
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Tab chèn hai dấu cách thay vì nhảy khỏi ô soạn.
            if (e.key !== "Tab" || readOnly || e.shiftKey) return;
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart, selectionEnd, value } = el;
            const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
            onChange(next);
            requestAnimationFrame(() => {
              el.selectionStart = el.selectionEnd = selectionStart + 2;
            });
          }}
          className={cn(
            "min-h-0 flex-1 resize-none bg-transparent px-4 py-3",
            "font-mono text-xs leading-5 whitespace-pre outline-none",
            "placeholder:text-sidebar-foreground/50",
            "focus-visible:ring-sidebar-ring/60 focus-visible:ring-2 focus-visible:ring-inset"
          )}
        />

        <div className="border-sidebar-border border-t px-4 py-3">
          <p className="text-overline text-sidebar-foreground/70 mb-1.5">
            Nhật ký chạy thử
          </p>
          {log.length === 0 ? (
            <p className="text-sidebar-foreground/70 text-xs leading-5">
              Bấm Chạy thử để thử quy tắc trên bảng đang thiết kế.
            </p>
          ) : (
            <ul
              aria-live="polite"
              className="max-h-28 overflow-y-auto font-mono text-xs leading-5"
            >
              {log.map((line, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-sidebar-foreground/70 shrink-0 tabular-nums">
                    {line.time}
                  </span>
                  <span className={cn("min-w-0", line.error && "text-destructive-text")}>
                    {line.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
