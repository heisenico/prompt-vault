// Shared test builders. Kept free of node:test imports so any test can use them.

/** A valid stored prompt. `overrides.metadata` is shallow-merged into the default metadata. */
export function promptFixture(overrides = {}) {
  const { metadata, ...rest } = overrides;
  return {
    id: "p1",
    title: "Revisar PR",
    content: "Você é um revisor.",
    isCode: false,
    rating: null,
    notes: [],
    ...rest,
    metadata: {
      model: "Claude Sonnet 5.5",
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
      tokenEstimate: { min: 3, max: 5, confidence: "high" },
      ...metadata,
    },
  };
}

/** A Map-backed stand-in for localStorage/sessionStorage. */
export function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => {
      items.set(key, String(value));
    },
    removeItem: (key) => items.delete(key),
    clear: () => items.clear(),
  };
}
