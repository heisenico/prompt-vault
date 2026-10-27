import { test } from "node:test";
import assert from "node:assert/strict";
import { libraryItems } from "../js/library-view.js";
import { createNote, createPrompt } from "../js/prompt-model.js";

const make = (title) => createPrompt({ title, model: "gpt-4o", content: "conteúdo", isCode: false });
const baseView = () => ({ editingNoteId: null, confirmingDeleteId: null, newPromptId: null, noteDrafts: new Map() });
const sig = (prompts, view, index = 0) => libraryItems(prompts, view)[index].signature;

test("drafts do not change the signature", () => {
  const prompts = [make("a")];
  const before = sig(prompts, baseView());
  const view = baseView();
  view.noteDrafts.set(prompts[0].id, "rascunho");
  assert.equal(sig(prompts, view), before);
});

test("editingNoteId of another prompt does not change the signature", () => {
  const [a, b] = [make("a"), make("b")];
  b.notes = [createNote("x")];
  const view = baseView();
  const before = sig([a, b], view, 0);
  view.editingNoteId = b.notes[0].id;
  assert.equal(sig([a, b], view, 0), before);
  assert.notEqual(sig([a, b], view, 1), sig([a, b], baseView(), 1));
});

test("rating, delete confirmation and card error change the signature", () => {
  const prompt = make("a");
  const before = sig([prompt], baseView());
  assert.notEqual(sig([{ ...prompt, rating: 4 }], baseView()), before);
  assert.notEqual(sig([prompt], { ...baseView(), confirmingDeleteId: prompt.id }), before);
  assert.notEqual(sig([prompt], { ...baseView(), cardError: { promptId: prompt.id, message: "x" } }), before);
  assert.equal(sig([prompt], { ...baseView(), cardError: { promptId: "other", message: "x" } }), before);
});

test("the draft is rendered escaped inside the new-note textarea", () => {
  const prompt = make("a");
  const view = baseView();
  view.noteDrafts.set(prompt.id, "<b>");
  const { markup } = libraryItems([prompt], view)[0].view;
  assert.ok(markup.includes("&lt;b&gt;</textarea>"));
  assert.ok(!markup.includes("<b>"));
});

test("card markup has no <li> wrapper of its own", () => {
  const { markup } = libraryItems([make("a")], baseView())[0].view;
  assert.ok(markup.trimStart().startsWith("<article"));
});
