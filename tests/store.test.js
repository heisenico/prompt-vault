import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage, promptFixture } from "./fixtures.js";

globalThis.localStorage = memoryStorage();
const store = await import("../js/store.js");

test("rating a prompt does not mark it edited", () => {
  const prompt = promptFixture();
  store.addPrompts([prompt]);
  store.updatePrompt(prompt.id, (p) => ({ ...p, rating: 5 }));
  assert.equal(store.getPrompt(prompt.id).metadata.updatedAt, prompt.metadata.updatedAt);
  assert.equal(store.getPrompt(prompt.id).rating, 5);
});
