// Accent- and case-insensitive text matching shared by the search fields.
// Pure: no DOM access, so it runs under node:test.

/** Case- and accent-insensitive: "Gêmini" finds "Gemini". Strips combining marks only; \p{Diacritic} would also eat ASCII ^ and `. */
export const normalize = (text) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** True when every whitespace-separated term of `query` appears in `haystack`, in any order. */
export function matchesAllTerms(haystack, query) {
  const text = normalize(haystack);
  return normalize(query).split(/\s+/).every((term) => text.includes(term));
}
