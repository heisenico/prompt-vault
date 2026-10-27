import { test } from "node:test";
import assert from "node:assert/strict";
import { promptToFields, revisePrompt } from "../js/prompt-model.js";
import { promptFixture } from "./fixtures.js";

test("revisePrompt updates fields, estimate and updatedAt, keeps identity", () => {
  const original = promptFixture({ rating: 4, notes: [{ id: "n1", content: "ok" }] });
  const revised = revisePrompt(original, { title: "Novo", model: " GPT-6.1 Sol ", content: "um dois três quatro", isCode: true });
  assert.equal(revised.id, original.id);
  assert.equal(revised.title, "Novo");
  assert.equal(revised.metadata.model, "GPT-6.1 Sol");
  assert.equal(revised.rating, 4);
  assert.deepEqual(revised.notes, original.notes);
  assert.equal(revised.metadata.createdAt, original.metadata.createdAt);
  assert.ok(Date.parse(revised.metadata.updatedAt) > Date.parse(original.metadata.createdAt));
  assert.notDeepEqual(revised.metadata.tokenEstimate, original.metadata.tokenEstimate);
});

test("revisePrompt rejects a blank model", () => {
  assert.throws(() => revisePrompt(promptFixture(), { title: "t", model: "  ", content: "c", isCode: false }), /modelo/);
});

test("promptToFields flattens a stored prompt into the form's fields", () => {
  assert.deepEqual(promptToFields(promptFixture({ title: "T", isCode: true })), {
    title: "T",
    model: "Claude Sonnet 5.5",
    content: "Você é um revisor.",
    isCode: true,
  });
});

test("promptToFields rejects a prompt without metadata.model", () => {
  assert.throws(() => promptToFields({ metadata: {} }), TypeError);
});
