import { useCustom } from "@refinedev/core";

import { customResult } from "@/shared/hooks/use-custom-result";
import { API_URL } from "@/shared/api/constants";
import type { CoverageResponse } from "@/domains/row-level-policy/types";

/**
 * Which resources are under row-level management.
 *
 * Read off `/coverage`, which already enumerates them, rather than through an
 * endpoint of its own. The list is a fact about the *code* — a resource joins
 * by declaring a policy set, not by anybody adding a row — so there is nothing
 * to keep in step and no reason for a second way to ask.
 */
export function useManagedResources(): string[] {
  const { result } = useCustom<CoverageResponse>({
    url: `${API_URL}/row_level_policies/coverage`,
    method: "get",
  });

  // Through the same guard as everywhere else: refine reports a query with no
  // data as a frozen empty object rather than undefined, and one place that
  // handles it by accident is one place that stops handling it on the next edit.
  const coverage = customResult(result?.data, "resources");
  return (coverage?.resources ?? []).map((resource) => resource.resource);
}
