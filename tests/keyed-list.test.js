import { test } from "node:test";
import assert from "node:assert/strict";
import { planListUpdate } from "../js/keyed-list.js";

const prev = new Map([["a", "1"], ["b", "1"], ["c", "1"]]);

test("unchanged list keeps every node", () => {
  const plan = planListUpdate(prev, [["a", "1"], ["b", "1"], ["c", "1"]]);
  assert.deepEqual(plan.removals, []);
  assert.deepEqual(plan.steps.map((s) => s.action), ["keep", "keep", "keep"]);
});

test("only the changed signature is replaced", () => {
  const plan = planListUpdate(prev, [["a", "1"], ["b", "2"], ["c", "1"]]);
  assert.deepEqual(plan.steps, [{ key: "a", action: "keep" }, { key: "b", action: "replace" }, { key: "c", action: "keep" }]);
});

test("missing keys are removed and new keys created in place", () => {
  const plan = planListUpdate(prev, [["d", "1"], ["a", "1"], ["c", "1"]]);
  assert.deepEqual(plan.removals, ["b"]);
  assert.deepEqual(plan.steps.map((s) => `${s.key}:${s.action}`), ["d:create", "a:keep", "c:keep"]);
});

test("reordering keeps nodes and follows the new order", () => {
  const plan = planListUpdate(prev, [["c", "1"], ["a", "1"], ["b", "1"]]);
  assert.deepEqual(plan.steps.map((s) => s.key), ["c", "a", "b"]);
  assert.ok(plan.steps.every((s) => s.action === "keep"));
});
