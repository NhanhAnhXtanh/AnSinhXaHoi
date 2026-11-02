import { parse } from "acorn";

/**
 * Chặn kịch bản của mẫu giữ trình duyệt quá lâu (vòng lặp vô hạn, vòng lặp quá nặng).
 *
 * Khi biên dịch, mỗi thân vòng lặp (for / for…in / for…of / while / do…while) được chèn một lệnh
 * gọi `LOOP_GUARD_NAME()`. Lệnh đó đo thời gian trình duyệt bị giữ LIÊN TỤC: đồng hồ bắt đầu ở
 * lần gọi đầu tiên và tự đặt lại khi trình duyệt được rảnh (một tác vụ `setTimeout(0)` chạy được),
 * nên thời gian chờ mạng (`await ctx.api.get(...)`) không bị tính. Giữ quá giới hạn thì ném
 * {@link ScriptTimeoutError}; bộ chạy hook bắt lỗi đó như mọi lỗi kịch bản.
 *
 * Giới hạn bắt đầu 5 giây; người dùng bấm "Tải lại" thì nâng lên 10 giây, tối đa 20 giây
 * ({@link raiseScriptTimeLimit}). Giới hạn dùng chung cho cả trang tới khi tải lại trang.
 *
 * Không chặn được: vòng lặp tự bắt (`try/catch` trong thân vòng lặp) lỗi dừng rồi lặp tiếp.
 */

export const LOOP_GUARD_NAME = "__asxhLoopGuard";

const TIME_LIMITS_MS = [5_000, 10_000, 20_000] as const;
let limitLevel = 0;

export function scriptTimeLimitMs(): number {
  return TIME_LIMITS_MS[limitLevel];
}

/** Còn nâng giới hạn được không (chưa tới 20 giây). */
export function canRaiseScriptTimeLimit(): boolean {
  return limitLevel < TIME_LIMITS_MS.length - 1;
}

/** Nâng giới hạn lên mức kế tiếp (5 → 10 → 20 giây). */
export function raiseScriptTimeLimit(): void {
  if (canRaiseScriptTimeLimit()) limitLevel += 1;
}

export class ScriptTimeoutError extends Error {
  constructor() {
    super(`Kịch bản chạy quá ${scriptTimeLimitMs() / 1000} giây nên đã dừng.`);
    this.name = "ScriptTimeoutError";
  }
}

let segmentStartedAt: number | null = null;

/** Lệnh chèn vào thân vòng lặp. */
export function loopGuard(): void {
  const now = performance.now();
  if (segmentStartedAt === null) {
    segmentStartedAt = now;
    // Chạy được nghĩa là trình duyệt đã rảnh: đoạn chạy liên tục kết thúc.
    setTimeout(() => {
      segmentStartedAt = null;
    }, 0);
    return;
  }
  if (now - segmentStartedAt > scriptTimeLimitMs()) throw new ScriptTimeoutError();
}

type AstNode = { type: string; start: number; end: number; [key: string]: unknown };

const LOOP_TYPES = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
]);

function isNode(value: unknown): value is AstNode {
  return (
    value != null &&
    typeof value === "object" &&
    typeof (value as AstNode).type === "string" &&
    typeof (value as AstNode).start === "number"
  );
}

/**
 * Chèn `LOOP_GUARD_NAME()` vào đầu thân mọi vòng lặp của `code`. Mã không đọc được (lỗi cú pháp)
 * trả nguyên văn để `new Function` báo đúng lỗi như trước.
 */
export function instrumentLoops(code: string): string {
  let program: unknown;
  try {
    program = parse(code, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
    });
  } catch {
    return code;
  }
  const call = `${LOOP_GUARD_NAME}();`;
  const edits: { at: number; text: string }[] = [];
  const visit = (node: AstNode) => {
    if (LOOP_TYPES.has(node.type) && isNode(node.body)) {
      const body = node.body;
      if (body.type === "BlockStatement") {
        edits.push({ at: body.start + 1, text: call });
      } else {
        edits.push({ at: body.start, text: `{${call}` });
        edits.push({ at: body.end, text: "}" });
      }
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) if (isNode(item)) visit(item);
      } else if (isNode(child)) {
        visit(child);
      }
    }
  };
  if (isNode(program)) visit(program);
  if (edits.length === 0) return code;
  // Sửa từ cuối lên để vị trí phía trước không đổi.
  edits.sort((a, b) => b.at - a.at);
  let result = code;
  for (const edit of edits) result = result.slice(0, edit.at) + edit.text + result.slice(edit.at);
  return result;
}
