// Pure planning for keyed list updates: which existing nodes to keep, replace
// or drop, and which new ones to create. The DOM side lives in keyed-render.js.

/**
 * @param {Map<string, string>} previous key -> signature, in DOM order
 * @param {Array<[string, string]>} next [key, signature] in the desired order
 * @returns {{ removals: string[], steps: Array<{ key: string, action: "keep" | "create" | "replace" }> }}
 */
export function planListUpdate(previous, next) {
  const nextKeys = new Set(next.map(([key]) => key));
  const removals = [...previous.keys()].filter((key) => !nextKeys.has(key));
  const steps = next.map(([key, signature]) => {
    if (!previous.has(key)) return { key, action: "create" };
    return { key, action: previous.get(key) === signature ? "keep" : "replace" };
  });
  return { removals, steps };
}
