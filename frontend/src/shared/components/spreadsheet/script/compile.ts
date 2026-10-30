import {
  SCRIPT_HOOKS,
  type CompiledScript,
  type ScriptCompileError,
  type ScriptHookName,
  type ScriptHooks,
  type ScriptRecord,
} from "./types";

/**
 * Biên dịch script Admin soạn thành bộ hook chạy được — bê từ bản Jmix
 * (core/script/compile.ts).
 *
 * Sandbox giai đoạn 1: `new Function` + strict mode + facade `ctx` — KHÔNG phải
 * sandbox cứng. Script ngang mức tin cậy với công thức của mẫu: chỉ quản trị
 * soạn được và đóng băng khi ban hành.
 *
 * Phiên bản mẫu có NHIỀU kịch bản (bảng `asxh_template_scripts`, như
 * `qt_template_script` của bản Jmix); máy chủ gửi các kịch bản đang bật trong
 * `scriptText` dạng mảng JSON (dạng 3 dưới đây) và mỗi kịch bản được biên dịch
 * riêng — một kịch bản lỗi cú pháp không kéo các kịch bản khác. `parseScriptText`
 * vẫn nhận cả ba dạng:
 *  1. Mã JS kết thúc bằng `return defineScript({...})` (đúng dạng một bản ghi cũ).
 *  2. Mã JS gọi `defineScript({...})` NHIỀU lần — mỗi lần là một khối script,
 *     chạy theo thứ tự gọi (tương đương nhiều bản ghi xếp theo displayOrder).
 *  3. Mảng JSON `[{ name, code, sheetCode?, displayOrder?, enabled? }]` — dạng
 *     chuyển nguyên các bản ghi cũ sang một cột.
 */

const DEFINE_SCRIPT_TAG = Symbol("asxh-defined-script");

interface TaggedHooks extends ScriptHooks {
  [DEFINE_SCRIPT_TAG]?: true;
}

function validateHooks(result: unknown): {
  hooks: ScriptHooks;
  declaredHooks: ScriptHookName[];
} {
  const tagged = result as TaggedHooks | null;
  if (
    tagged == null ||
    typeof tagged !== "object" ||
    tagged[DEFINE_SCRIPT_TAG] !== true
  ) {
    throw new Error("Script phải kết thúc bằng `return defineScript({...})`.");
  }
  const declaredHooks: ScriptHookName[] = [];
  const hooks: ScriptHooks = {};
  for (const name of SCRIPT_HOOKS) {
    const handler = tagged[name];
    if (handler == null) continue;
    if (typeof handler !== "function") {
      throw new Error(`Hook "${name}" phải là function.`);
    }
    (hooks as Record<string, unknown>)[name] = handler;
    declaredHooks.push(name);
  }
  const unknownKeys = Object.keys(tagged).filter(
    (key) => !(SCRIPT_HOOKS as readonly string[]).includes(key)
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `Hook không tồn tại: ${unknownKeys.join(", ")}. Hook hợp lệ: ${SCRIPT_HOOKS.join(", ")}.`
    );
  }
  if (declaredHooks.length === 0) {
    throw new Error("Script chưa đăng ký hook nào.");
  }
  return { hooks, declaredHooks };
}

export type CompileOutcome = {
  scripts: CompiledScript[];
  errors: ScriptCompileError[];
};

/**
 * Biên dịch MỘT bản ghi. Một bản ghi có thể sinh nhiều khối script nếu nó gọi
 * `defineScript` nhiều lần (dạng 2 ở trên).
 */
export function compileRecord(record: ScriptRecord): CompileOutcome {
  const registered: TaggedHooks[] = [];
  const defineScript = (hooks: ScriptHooks): TaggedHooks => {
    if (hooks == null || typeof hooks !== "object") {
      throw new Error("defineScript(...) cần một object các hook.");
    }
    const tagged: TaggedHooks = Object.assign({}, hooks, {
      [DEFINE_SCRIPT_TAG]: true as const,
    });
    registered.push(tagged);
    return tagged;
  };
  try {
    // 'use strict' chèn TRƯỚC code người dùng: chặn biến global vô tình, `with`,
    // và this = undefined ở top level.
    const factory = new Function(
      "defineScript",
      `'use strict';\n${record.code}`
    ) as (define: typeof defineScript) => unknown;
    const returned = factory(defineScript);
    const blocks: unknown[] = [...registered];
    if (
      returned != null &&
      !registered.includes(returned as TaggedHooks)
    ) {
      blocks.push(returned);
    }
    if (blocks.length === 0) {
      // Không gọi defineScript lần nào → để validateHooks báo lỗi đúng câu.
      blocks.push(returned);
    }
    const scripts: CompiledScript[] = blocks.map((block, index) => {
      const { hooks, declaredHooks } = validateHooks(block);
      const blockRecord: ScriptRecord =
        blocks.length > 1
          ? { ...record, id: `${record.id}#${index + 1}`, name: `${record.name} (khối ${index + 1})` }
          : record;
      return { record: blockRecord, hooks, declaredHooks };
    });
    return { scripts, errors: [] };
  } catch (error) {
    return {
      scripts: [],
      errors: [
        {
          record,
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

/** Đọc `scriptText` của phiên bản mẫu thành danh sách bản ghi (xem 3 dạng ở đầu file). */
export function parseScriptText(scriptText: string): ScriptRecord[] {
  const text = scriptText.trim();
  if (text === "") return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        const records: ScriptRecord[] = [];
        parsed.forEach((item, index) => {
          if (!item || typeof item !== "object") return;
          const entry = item as Record<string, unknown>;
          if (typeof entry.code !== "string") return;
          records.push({
            id: typeof entry.id === "string" ? entry.id : `script-${index + 1}`,
            name:
              typeof entry.name === "string" && entry.name.trim() !== ""
                ? entry.name
                : `Script ${index + 1}`,
            sheetCode:
              typeof entry.sheetCode === "string" && entry.sheetCode !== ""
                ? entry.sheetCode
                : null,
            code: entry.code,
            displayOrder:
              typeof entry.displayOrder === "number" ? entry.displayOrder : index,
            enabled: entry.enabled !== false,
          });
        });
        return records;
      }
    } catch {
      // Không phải JSON → coi như mã JS (dạng 1/2).
    }
  }
  return [
    {
      id: "script",
      name: "Script của mẫu",
      sheetCode: null,
      code: scriptText,
      displayOrder: 0,
      enabled: true,
    },
  ];
}

/**
 * Tên các hook một kịch bản khai (theo thứ tự `SCRIPT_HOOKS`) — màn soạn gửi kèm khi lưu để hiển
 * thị, như `declaredHooks` của bản Jmix. Mã lỗi cú pháp → `null`.
 */
export function declaredHooksOf(code: string): string | null {
  const outcome = compileRecord({
    id: "khai-bao",
    name: "khai-bao",
    sheetCode: null,
    code,
    displayOrder: 0,
    enabled: true,
  });
  if (outcome.errors.length > 0 || outcome.scripts.length === 0) return null;
  const names = new Set(outcome.scripts.flatMap((script) => script.declaredHooks));
  return SCRIPT_HOOKS.filter((name) => names.has(name)).join(",") || null;
}
