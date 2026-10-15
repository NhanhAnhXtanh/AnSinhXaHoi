import type { PolicyFormValues } from "./policy-form";
import { EMPTY_SCOPE } from "@/domains/row-level-policy/types";

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
