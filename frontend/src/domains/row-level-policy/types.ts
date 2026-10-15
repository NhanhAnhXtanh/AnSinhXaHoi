/**
 * The `row_level_policies` resource as the API reports it, plus the metadata
 * that drives the condition builder.
 *
 * The shapes here mirror `RowLevelPolicyResponse` and `PolicyMetadataResponse`
 * on the backend. Nothing generates one from the other, so both sides are
 * changed together — the same hand-upheld contract the rest of this API has.
 */

/**
 * A condition tree, exactly as the backend stores it.
 *
 * The grammar is four node shapes and two value shapes, and that is the whole
 * of it. Nothing here can call a method, construct a type or name a bean —
 * which is what makes a policy editable from a screen without being an
 * execution surface.
 */
export type ScopeNode =
  | { all: ScopeNode[] }
  | { any: ScopeNode[] }
  | { not: ScopeNode }
  | ScopeLeaf;

export type ScopeLeaf = {
  field: string;
  op: string;
  /** Absent for `isNull` and `isNotNull`, which take no operand at all. */
  value?: ScopeValue;
};

export type ScopeValue = { lit: unknown } | { ctx: string };

/** The empty tree: always true, which is to say the full scope. */
export const EMPTY_SCOPE: ScopeNode = { all: [] };

export type PolicyKind = "SCOPE" | "FILTER";

export type RowLevelPolicy = {
  id: number;
  kind: PolicyKind;
  /** Null, and only null, for a FILTER — which is what makes a FILTER inescapable. */
  role: { id: number; code: string; name: string } | null;
  resource: string;
  action: "read" | "write" | "delete";
  name: string;
  policyGroup: string | null;
  description: string | null;
  scope: ScopeNode;
  /**
   * The `WITH CHECK` clause — what the row may look like *after* a write.
   *
   * Null means "the same as `scope`", which is Postgres's default and the safe
   * one: the same condition on both sides is what stops a row being pushed out
   * of its writer's own sight. It has to be separable, because the two clauses
   * answer different questions once the condition is about workflow state
   * rather than ownership — "you may edit drafts" must not also mean "and never
   * publish one".
   */
  checkScope: ScopeNode | null;
  enabled: boolean;
  /**
   * Why the loader had to disable this. Shown beside the policy rather than
   * only logged, because the person who can fix it is looking at this screen.
   */
  invalidReason: string | null;
  source: string;
  createdBy: { id: number; username: string; fullName: string } | null;
  updatedBy: { id: number; username: string; fullName: string } | null;
  createdAt: string;
  updatedAt: string | null;
};

/** What `/metadata` answers: everything the builder needs to offer only valid choices. */
export type PolicyMetadata = {
  resource: string;
  defaultScope: "FULL" | "NONE";
  fields: MetadataField[];
  context: MetadataContext[];
  /** Fields a `write` policy may not mention, because their value only exists after the flush. */
  notCheckSafe: string[];
  /** Policies declared in source. Read-only here, but shown, so the whole rule set is visible. */
  designTime: {
    kind: PolicyKind;
    action: string;
    role: string | null;
    name: string;
  }[];
};

export type MetadataField = {
  path: string;
  type: "enum" | "long" | "number" | "boolean" | "date" | "datetime" | "string";
  nullable: boolean;
  /** Enum constants, so the value input is a dropdown rather than free text. */
  values: string[];
  operators: string[];
  /**
   * Whether a `not` on this field needs the three-valued-logic warning.
   *
   * `not(assignee.id = me)` does not match a task with no assignee: a null
   * makes the comparison UNKNOWN, and UNKNOWN refuses the row. Saying so at the
   * moment somebody writes the `not` — and offering the `isNull` branch beside
   * it — is far better than letting the list and the save disagree later.
   */
  warnNotNull: boolean;
};

export type MetadataContext = {
  key: string;
  type: string;
  /** A set, so it works only with `in` and `notIn`. */
  collection: boolean;
};

export type CoverageResponse = {
  resources: {
    resource: string;
    defaultScope: "FULL" | "NONE";
    cells: {
      role: string;
      action: string;
      hasScope: boolean;
      risk: "OK" | "UNRESTRICTED" | "CLOSED";
    }[];
  }[];
};

export type ExplainResponse = {
  principal: {
    userId: number;
    organizationId: number | null;
    departmentId: number | null;
    roleCodes: string[];
  };
  resource: string;
  action: string;
  defaultScope: "FULL" | "NONE";
  scopes: ExplainRule[];
  filters: ExplainRule[];
  effective: string;
  warnings: string[];
};

export type ExplainRule = {
  source: string;
  role: string | null;
  name: string;
  reads: string;
  /** The `WITH CHECK` half, only when it says something `reads` does not. */
  checks: string | null;
  applies: boolean;
};

export const ACTIONS = ["read", "write", "delete"] as const;

/** Operators that take no operand at all, so the value input disappears entirely. */
export const NULLARY_OPERATORS = new Set(["isNull", "isNotNull"]);

/** Operators that take a set rather than one value. */
export const SET_OPERATORS = new Set(["in", "notIn"]);

/** Operators that take exactly two bounds. */
export const RANGE_OPERATORS = new Set(["between"]);

/** How each operator reads, so the builder does not make people learn the wire names. */
export const OPERATOR_LABELS: Record<string, string> = {
  eq: "is",
  ne: "is not",
  in: "is one of",
  notIn: "is not one of",
  lt: "is before",
  lte: "is at most",
  gt: "is after",
  gte: "is at least",
  between: "is between",
  like: "contains",
  notLike: "does not contain",
  isNull: "is empty",
  isNotNull: "is not empty",
};

export function operatorLabel(op: string): string {
  return OPERATOR_LABELS[op] ?? op;
}
