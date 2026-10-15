/**
 * Turns `useCustom`'s "no data yet" back into `undefined`.
 *
 * Refine does not hand back `undefined` when a custom query has not produced
 * anything — it hands back a frozen empty object:
 *
 * ```js
 * result: { data: queryResponse.data?.data || EMPTY_OBJECT }
 * ```
 *
 * That object is **truthy**, so the obvious guard (`if (!data) return null`)
 * passes and the very next property access reads `undefined.length`. It bites
 * hardest on a query that is `enabled: false` — a disabled react-query is not
 * "loading" either, so neither of the two natural guards catches it and the
 * component crashes on its first render.
 *
 * Everything here goes through this instead, so the emptiness is handled once
 * rather than at each of the several places that would otherwise have to
 * remember.
 *
 * @param probe a key the real payload always carries. The sentinel has no keys
 *              at all, so any one of them tells the two apart — naming it
 *              rather than counting keys keeps the check honest if the API ever
 *              legitimately answers with a sparse object
 */
export function customResult<T extends object>(
  data: T | undefined,
  probe: keyof T
): T | undefined {
  if (!data || data[probe] === undefined) {
    return undefined;
  }
  return data;
}
