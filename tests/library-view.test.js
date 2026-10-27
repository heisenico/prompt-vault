import { test } from "node:test";
import assert from "node:assert/strict";
import { libraryItems, noResults } from "../js/library-view.js";
import { createNote, createPrompt } from "../js/prompt-model.js";

const make = (title) => createPrompt({ title, model: "gpt-4o", content: "conteúdo", isCode: false });
const baseView = () => ({ editingNoteId: null, confirmingDeleteId: null, newPromptId: null, noteDrafts: new Map(), noteEditDraft: null });
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
  const { markup } = libraryItems([prompt], view)[0].render();
  assert.ok(markup.includes("&lt;b&gt;</textarea>"));
  assert.ok(!markup.includes("<b>"));
});

test("card markup has no <li> wrapper of its own", () => {
  const { markup } = libraryItems([make("a")], baseView())[0].render();
  assert.ok(markup.trimStart().startsWith("<article"));
});

test("items render lazily through render()", () => {
  const [item] = libraryItems([make("a")], baseView());
  assert.equal(typeof item.render, "function");
  assert.equal(item.view, undefined);
});

const withNote = () => {
  const prompt = make("a");
  prompt.notes = [createNote("salva")];
  return prompt;
};

test("note edit drafts do not change the signature", () => {
  const prompt = withNote();
  const noteId = prompt.notes[0].id;
  const view = { ...baseView(), editingNoteId: noteId };
  const before = sig([prompt], view);
  assert.equal(sig([prompt], { ...view, noteEditDraft: { noteId, text: "meio editada" } }), before);
});

test("the editor shows the draft (escaped) for its own note, stored text otherwise", () => {
  const prompt = withNote();
  const noteId = prompt.notes[0].id;
  const view = { ...baseView(), editingNoteId: noteId, noteEditDraft: { noteId, text: "<i>x" } };
  const { markup } = libraryItems([prompt], view)[0].render();
  assert.ok(markup.includes("&lt;i&gt;x</textarea>"));
  assert.ok(!markup.includes("<i>"));
  const other = { ...view, noteEditDraft: { noteId: "outra", text: "nao" } };
  assert.ok(libraryItems([prompt], other)[0].render().markup.includes("salva</textarea>"));
});

test("both textareas start with a newline so a leading newline in a draft survives", () => {
  const prompt = withNote();
  const view = { ...baseView(), editingNoteId: prompt.notes[0].id };
  const { markup } = libraryItems([prompt], view)[0].render();
  const opens = markup.match(/<textarea[^>]*>[^]?/g);
  assert.equal(opens.length, 2);
  for (const open of opens) assert.ok(open.endsWith(">\n"), open);
});

test("noResults names the query, escaped, and offers to clear the search", () => {
  const { markup } = noResults('<img src=x onerror="a">');
  assert.match(markup, /Nada encontrado para “&lt;img src=x onerror=&quot;a&quot;&gt;”\./);
  assert.doesNotMatch(markup, /<img/);
  assert.match(markup, /<button class="text-button is-tinted" type="button" data-action="clear-search">Limpar busca<\/button>/);
});
