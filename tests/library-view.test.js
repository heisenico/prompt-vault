import { test } from "node:test";
import assert from "node:assert/strict";
import { libraryItems, noResults } from "../js/library-view.js";
import { createNote, createPrompt } from "../js/prompt-model.js";

const make = (title) => createPrompt({ title, model: "gpt-4o", content: "conteúdo", isCode: false });
const baseView = () => ({ editingNoteId: null, confirmingDeleteId: null, newPromptId: null, noteDrafts: new Map(), noteEditDraft: null, expandedIds: new Set() });
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

const cardMarkup = (prompt, view = baseView()) => libraryItems([prompt], view)[0].render().markup;
const openDetails = (markup) => /<details class="card-more"[^>]* open[ >]/.test(markup);

test("expandedIds does not change the signature but opens details.card-more", () => {
  const prompt = make("a");
  const before = sig([prompt], baseView());
  const view = { ...baseView(), expandedIds: new Set([prompt.id]) };
  assert.equal(sig([prompt], view), before);
  assert.ok(openDetails(cardMarkup(prompt, view)));
  assert.ok(!openDetails(cardMarkup(prompt, baseView())));
  assert.ok(!openDetails(cardMarkup(prompt, { ...baseView(), expandedIds: new Set(["outro"]) })));
});

test("details open while confirming delete or editing one of the card's notes", () => {
  const prompt = withNote();
  assert.ok(openDetails(cardMarkup(prompt, { ...baseView(), confirmingDeleteId: prompt.id })));
  assert.ok(openDetails(cardMarkup(prompt, { ...baseView(), editingNoteId: prompt.notes[0].id })));
  assert.ok(!openDetails(cardMarkup(prompt, { ...baseView(), confirmingDeleteId: "outro" })));
});

test("card has a primary Copiar pill with an accessible name and a more section", () => {
  const markup = cardMarkup(make("Meu título"));
  assert.match(markup, /<button class="copy-pill-small"[^>]*data-action="copy"[^>]*data-state="idle"[^>]*aria-label="Copiar Meu título"/);
  assert.match(markup, />Copiar<\/span>/);
  assert.match(markup, /<summary[^>]*>[^]*Avaliar e anotar/);
  assert.ok(!markup.includes("delete-button"));
  assert.ok(!markup.includes("metadata-section"));
  assert.match(markup, /data-action="edit-prompt"/);
  assert.match(markup, /Excluir prompt/);
});

test("summary shows the note count only when there are notes", () => {
  assert.ok(!/Avaliar e anotar\s*·/.test(cardMarkup(make("a"))));
  assert.match(cardMarkup(withNote()), /Avaliar e anotar · 1 nota/);
});

test("summary and manage buttons carry the prompt title in a visually-hidden suffix", () => {
  const markup = cardMarkup(make("Meu <título>"));
  const suffix = '<span class="visually-hidden">: Meu &lt;título&gt;</span>';
  assert.ok(markup.includes(`Avaliar e anotar${suffix}`));
  assert.ok(markup.includes(`data-action="edit-prompt">Editar prompt${suffix}</button>`));
  assert.ok(markup.includes(`data-action="delete">Excluir prompt${suffix}</button>`));
});

test("meta line hides separators and visual stars from speech and spells out the spoken text", () => {
  const prompt = { ...make("a"), rating: 4 };
  const meta = cardMarkup(prompt).match(/<p class="card-meta">[^]*?<\/p>/)[0];
  assert.ok(meta.includes('<span aria-hidden="true">★ 4</span><span class="visually-hidden">, 4 de 5 estrelas</span>'));
  assert.equal(meta.match(/<span aria-hidden="true"> · <\/span>/g).length, 2);
  assert.match(meta, /<span class="visually-hidden">, cerca de \d+ a \d+ tokens, [^<]+<\/span>/);
  const unrated = cardMarkup(make("a")).match(/<p class="card-meta">[^]*?<\/p>/)[0];
  assert.ok(!unrated.includes("estrelas"));
  assert.equal(unrated.match(/ · /g).length, 1);
});

test("noResults names the query, escaped, and offers to clear the search", () => {
  const { markup } = noResults('<img src=x onerror="a">');
  assert.match(markup, /Nada encontrado para “&lt;img src=x onerror=&quot;a&quot;&gt;”\./);
  assert.doesNotMatch(markup, /<img/);
  assert.match(markup, /<button class="text-button is-tinted" type="button" data-action="clear-search">Limpar busca<\/button>/);
});
