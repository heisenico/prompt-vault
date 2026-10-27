import { test } from "node:test";
import assert from "node:assert/strict";
import { queryLibrary, isSortOrder } from "../js/library-query.js";
import { promptFixture } from "./fixtures.js";

const at = (day) => `2026-10-${day}T10:00:00.000Z`;
const a = promptFixture({ id: "a", title: "Zebra", rating: 3, metadata: { createdAt: at("01"), updatedAt: at("01") } });
const b = promptFixture({ id: "b", title: "árvore", rating: null, metadata: { createdAt: at("03"), updatedAt: at("03") } });
const c = promptFixture({ id: "c", title: "Item 10", rating: 5, notes: [{ id: "n", content: "usar no Gemini" }], metadata: { createdAt: at("02"), updatedAt: at("02") } });
const ids = (list) => list.map(({ id }) => id);

test("recent: newest createdAt first", () => {
  assert.deepEqual(ids(queryLibrary([a, b, c], { query: "", sort: "recent" })), ["b", "c", "a"]);
});

test("rating: highest first, unrated last", () => {
  assert.deepEqual(ids(queryLibrary([a, b, c], { query: "", sort: "rating" })), ["c", "a", "b"]);
});

test("rating with no ratings falls back to newest first", () => {
  const unrated = [a, b, c].map((p) => ({ ...p, rating: null }));
  assert.deepEqual(ids(queryLibrary(unrated, { query: "", sort: "rating" })), ["b", "c", "a"]);
});

test("title: pt-BR collation ignores accents and sorts numbers naturally", () => {
  const d = promptFixture({ id: "d", title: "Item 9" });
  assert.deepEqual(ids(queryLibrary([a, b, c, d], { query: "", sort: "title" })), ["b", "d", "c", "a"]);
});

test("query matches notes and model, ignoring accents", () => {
  assert.deepEqual(ids(queryLibrary([a, b, c], { query: "gemini", sort: "recent" })), ["c"]);
  assert.deepEqual(ids(queryLibrary([a, b, c], { query: "ARVORE", sort: "recent" })), ["b"]);
});

test("does not mutate its input", () => {
  const input = [a, b, c];
  queryLibrary(input, { query: "", sort: "title" });
  assert.deepEqual(ids(input), ["a", "b", "c"]);
});

test("isSortOrder guards stored values", () => {
  assert.equal(isSortOrder("rating"), true);
  assert.equal(isSortOrder("random"), false);
});
