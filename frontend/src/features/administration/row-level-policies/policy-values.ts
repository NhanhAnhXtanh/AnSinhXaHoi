import type { PolicyFormValues } from "./policy-form";
import { EMPTY_SCOPE, NULLARY_OPERATORS, type ScopeNode } from "@/domains/row-level-policy/types";
import { fieldLabel } from "./labels";

/**
 * Annotated rather than inferred, so `scope` widens to a `ScopeNode` instead of
 * being pinned to the shape of the empty tree — and so `role.id` accepts an id
 * rather than being fixed at `null`.
 *
 * It is also what types the form: refine's `useForm` takes the query data type
 * as its first parameter, so naming the form's own type at the call site would
 * pin the wrong one and leave every field as `FieldValues`. `defaultValues`
 * infers it correctly.
 */
export const DEFAULT_POLICY: PolicyFormValues = {
  kind: "SCOPE",
  role: { id: null },
  resource: "",
  action: "read",
  name: "",
  policyGroup: "",
  description: "",
  // The full scope. A new policy starts by restricting nothing, so a
  // half-finished one widens rather than narrows — and the API compiles it
  // before storing it either way.
  scope: EMPTY_SCOPE,
  // Null, not an empty tree: the two mean opposite things. Null is "check the
  // saved state with the same condition", which is the safe default; an empty
  // tree would be "allow the save to leave the row in any state at all".
  checkScope: null,
  enabled: true,
};

/**
 * The form's values, with the role settled.
 *
 * The form is the payload here, as everywhere else in this UI — there is no
 * separate wire shape to convert to. The one thing that has to be decided
 * before sending is the role: a filter sends an explicit `null` rather than
 * whatever the picker was left holding. That matters rather than being tidy — a
 * filter that named a role would be escapable by not holding that role, and the
 * API refuses one outright, so clearing it here is the form agreeing with the
 * rule instead of discovering it on submit.
 *
 * An empty group or description is left as the empty string; the API trims both
 * to null.
 */
export function normalize(values: PolicyFormValues): PolicyFormValues {
  return {
    ...values,
    role: { id: values.kind === "FILTER" ? null : (values.role?.id ?? null) },
    // Only `write` has a state to check afterwards, so a check clause left
    // behind by switching the action away from it would be dead configuration
    // that reappears if somebody switches back.
    checkScope: values.action === "write" ? (values.checkScope ?? null) : null,
  };
}

/** Giá trị `{ lit }` còn trống: chuỗi rỗng / toàn dấu cách, null, danh sách rỗng hoặc có ô trống. */
function literalIsBlank(lit: unknown): boolean {
  if (lit === undefined || lit === null) return true;
  if (typeof lit === "string") return lit.trim() === "";
  if (Array.isArray(lit)) return lit.length === 0 || lit.some(literalIsBlank);
  return false;
}

/**
 * Điều kiện ĐẦU TIÊN (theo thứ tự cây) còn thiếu giá trị so sánh, hoặc `null` nếu đã đủ. Phép
 * "chưa có / đã có giá trị" không cần giá trị; giá trị lấy từ tài khoản đăng nhập (`ctx`) thì đủ.
 * Kiểm ở form để báo "Hãy nhập giá trị cho điều kiện …" ngay, thay vì nhận câu kỹ thuật của máy chủ
 * khi lưu (`scope.all[0].value: "" is not a valid Long for unit.id`).
 */
export function firstIncompleteCondition(node: ScopeNode | null | undefined): string | null {
  if (!node) return null;
  if ("all" in node) return firstOf(node.all);
  if ("any" in node) return firstOf(node.any);
  if ("not" in node) return firstIncompleteCondition(node.not);
  if (NULLARY_OPERATORS.has(node.op)) return null;
  const value = node.value;
  const blank = value === undefined || ("lit" in value && literalIsBlank(value.lit)) || ("ctx" in value && !value.ctx);
  return blank ? fieldLabel(node.field) : null;
}

function firstOf(nodes: ScopeNode[]): string | null {
  for (const child of nodes) {
    const found = firstIncompleteCondition(child);
    if (found !== null) return found;
  }
  return null;
}

/** Câu báo cho ô điều kiện: `true` khi đủ giá trị, ngược lại câu tiếng Việt chỉ ra điều kiện nào thiếu. */
export function scopeCompleteMessage(node: ScopeNode | null | undefined): true | string {
  const missing = firstIncompleteCondition(node);
  return missing === null ? true : `Hãy nhập giá trị cho điều kiện "${missing}".`;
}
