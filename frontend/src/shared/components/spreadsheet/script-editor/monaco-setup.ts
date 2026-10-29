// Monaco tự host từ node_modules, KHÔNG tải từ CDN: ứng dụng chạy mạng nội bộ nên
// bộ nạp mặc định của @monaco-editor/react (lấy từ jsdelivr) sẽ hỏng. Worker đi qua
// cú pháp `?worker` của Vite, đóng gói cùng ứng dụng.
//
// Module này CHỈ được import từ chunk nạp động `./script-editor-impl.tsx` — import
// nó ở nơi khác sẽ kéo vài MB Monaco vào trang đầu (kể cả trang đăng nhập).
//
// Chỉ nạp lõi soạn thảo + JavaScript/TypeScript, không nạp ~80 ngôn ngữ khác của
// gói `monaco-editor` (import thẳng "monaco-editor" sẽ kéo hết).
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/edcore.main";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/language/typescript/monaco.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { loader } from "@monaco-editor/react";

import { SCRIPT_API_DTS } from "./script-api-dts";

(globalThis as { MonacoEnvironment?: monaco.Environment }).MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    return label === "typescript" || label === "javascript" ? new TsWorker() : new EditorWorker();
  },
};

loader.config({ monaco });

// Script viết bằng JavaScript (lúc chạy là `new Function`) nhưng vẫn có gợi ý code:
// extraLib khai báo defineScript + ScriptContext, checkJs bật kiểm kiểu nhẹ.
// Bỏ qua mã 1108 (return ở cấp ngoài cùng) vì script là THÂN một hàm —
// `return defineScript({...})` hợp lệ lúc chạy.
const js = monaco.languages.typescript.javascriptDefaults;
js.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  allowNonTsExtensions: true,
  allowJs: true,
  checkJs: true,
  noLib: false,
});
js.setDiagnosticsOptions({ diagnosticCodesToIgnore: [1108] });
js.addExtraLib(SCRIPT_API_DTS, "ts:asxh-script-api.d.ts");

/**
 * Nền trong suốt để ô soạn ăn theo màu vùng chứa (tông thanh bên của theme),
 * thay vì màu xám cứng của "vs-dark" / trắng của "vs".
 */
monaco.editor.defineTheme("asxh-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#00000000",
    "editor.lineHighlightBackground": "#ffffff0d",
    "editorGutter.background": "#00000000",
  },
});
monaco.editor.defineTheme("asxh-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#00000000",
    "editorGutter.background": "#00000000",
  },
});

export { monaco };
