import { useRef } from "react";
import Editor from "@monaco-editor/react";

import { LoadingState } from "@/shared/components/asxh";
import { useTheme } from "@/shared/components/theme/theme-provider";
import { cn } from "@/shared/lib/utils";

import "./monaco-setup";
import type { ScriptEditorProps } from "./types";

/**
 * Ô soạn quy tắc nhập bằng Monaco (JavaScript, có gợi ý `ctx`). Chỉ nạp qua
 * `React.lazy` ở `./index.tsx` — đừng import file này trực tiếp.
 */
export default function ScriptEditorImpl({
  value,
  onChange,
  readOnly,
  readOnlyMessage = "Phiên bản này đã ban hành hoặc đang khoá nên chỉ xem được, không sửa được.",
  placeholder,
  ariaLabel,
  path = "asxh-script.js",
  onCursorChange,
  fontSize = 12,
  className,
}: ScriptEditorProps) {
  const { resolvedMode, sidebarTone } = useTheme();
  // Ref: Monaco chỉ gọi onMount một lần, còn hàm người gọi truyền có thể đổi mỗi lần vẽ.
  const cursorRef = useRef(onCursorChange);
  cursorRef.current = onCursorChange;
  // Vùng soạn nằm trên nền tông thanh bên: thanh bên sáng chỉ khi chọn "sáng" ở chế độ sáng.
  const theme = resolvedMode === "light" && sidebarTone === "light" ? "asxh-light" : "asxh-dark";

  return (
    <div className={cn("relative min-h-0", className)}>
      <Editor
        height="100%"
        language="javascript"
        path={path}
        theme={theme}
        value={value}
        loading={<LoadingState label="Đang mở ô soạn quy tắc…" />}
        onMount={(editor) => {
          editor.onDidChangeCursorPosition((event) =>
            cursorRef.current?.({ line: event.position.lineNumber, column: event.position.column })
          );
        }}
        onChange={(next) => {
          // Khi chỉ xem, Monaco vẫn báo đổi lúc nạp nội dung — bỏ qua để không báo "chưa lưu".
          if (readOnly) return;
          const text = next ?? "";
          if (text !== value) onChange(text);
        }}
        options={{
          readOnly,
          readOnlyMessage: { value: readOnlyMessage },
          ariaLabel,
          minimap: { enabled: false },
          fontSize,
          lineHeight: 20,
          tabSize: 2,
          insertSpaces: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "off",
          renderLineHighlight: readOnly ? "none" : "line",
          // Gợi ý / tìm kiếm / chú thích khi rê chuột vẽ ở lớp trên cùng, không bị khung bên cắt mất.
          fixedOverflowWidgets: true,
          padding: { top: 12, bottom: 12 },
        }}
      />
      {placeholder && value === "" && (
        <pre
          aria-hidden
          className="text-sidebar-foreground/50 pointer-events-none absolute top-3 left-[3.75rem] font-mono text-xs leading-5 whitespace-pre"
        >
          {placeholder}
        </pre>
      )}
    </div>
  );
}
