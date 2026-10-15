import { NULLARY_OPERATORS, operatorLabel, type ScopeNode } from "./types";

/**
 * A condition tree as a sentence.
 *
 * The JSON below it on the show page is the authoritative version; this is for
 * the person who wants to know what a rule does without reading a tree. It
 * renders the tree **as authored**, including the `not` — unlike `/explain`,
 * which reports the compiled form after the server has pushed negations down
 * into the leaves. Both are worth having, and conflating them would hide the
 * one transformation most likely to surprise whoever wrote the rule.
 */
export function readCondition(node: ScopeNode | undefined): string {
  if (!node) return "—";

  if ("all" in node) {
    if (node.all.length === 0) return "every row";
    return node.all.map(readCondition).join(" and ");
  }
  if ("any" in node) {
    if (node.any.length === 0) return "no rows";
    return `(${node.any.map(readCondition).join(" or ")})`;
  }
  if ("not" in node) {
    return `not (${readCondition(node.not)})`;
  }

  if (NULLARY_OPERATORS.has(node.op)) {
    return `${node.field} ${operatorLabel(node.op)}`;
  }

  const value = node.value;
  if (value && "ctx" in value) {
    return `${node.field} ${operatorLabel(node.op)} the caller's ${value.ctx}`;
  }
  if (value && "lit" in value) {
    const literal = Array.isArray(value.lit)
      ? value.lit.join(", ")
      : String(value.lit);
    return `${node.field} ${operatorLabel(node.op)} ${literal}`;
  }
  return `${node.field} ${operatorLabel(node.op)}`;
}
