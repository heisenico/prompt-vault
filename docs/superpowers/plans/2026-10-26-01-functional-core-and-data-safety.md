# Functional Core and Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tested pure core (search, query, keyed rendering, import/export), stop note drafts from being lost, keep "Editado em" truthful, and give the vault a backup path.

**Architecture:** Pure modules under `js/` hold the logic and never import DOM or storage code. The shell modules (`main.js`, `library-view.js`, `keyed-render.js`) apply their results. A zero-dependency `node:test` suite covers the pure modules; DOM steps are checked in Chrome.

**Tech Stack:** Vanilla ES modules, no build step, Node ≥ 22 `node:test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-10-26-prompt-vault-ux-overhaul.md` (decisions 1, 3, 4, 7, 8, 10)

**Prerequisite:** the model-combobox work (`js/model-combobox.js`, `data/models.json`, `scripts/update-models.mjs`) and `PRODUCT.md` are committed on `main` before the worktree is cut.

## Global Constraints

- Zero runtime and dev dependencies. `package.json` exists only for `"type": "module"` and `npm test`.
- Pure modules (`text-search.js`, `library-query.js`, `keyed-list.js`, `library-transfer.js`, `prompt-model.js`) never reference `document`, `window` or `localStorage` at module scope.
- User text reaches the DOM only through the `html` tagged template (`js/html.js`).
- Storage key `prompt-vault-prompts` and its record shape stay backward compatible.
- UI copy is pt-BR, with no em dashes.
- Run the app with `python3 -m http.server 8000`, then hard-reload (⌘⇧R) after each JS change; the server sends no cache headers.

## Review Focus

- A search containing regex characters ("c++", "a.b", "(x)") matches literally and never throws. Test in Task 1.
- Sorting by rating when every prompt is unrated falls back to newest first, not to arbitrary order. Test in Task 2.
- A note draft typed in a card survives a rating change on the same card and on another card. Browser check in Task 4.
- Importing the same export twice adds nothing the second time and reports every prompt as skipped. Test in Task 5.
- Importing a pre-metadata backup (records without `metadata`) is upgraded, not rejected. Test in Task 5.

---

### Task 1: Test harness and shared text search

**Files:**
- Create: `package.json`, `js/text-search.js`, `tests/text-search.test.js`, `tests/fixtures.js`
- Modify: `js/model-combobox.js` (drop local `normalize`/`matchesQuery`), `README.md` (add a "Test" section: `npm test`)

**Interfaces:**
- Produces:
  - `normalize(text: string): string`: NFD, strips `\p{Diacritic}`, lowercases.
  - `matchesAllTerms(haystack: string, query: string): boolean`: splits `query` on whitespace; true when every term is a substring of the normalized haystack; true for a blank query.
  - `tests/fixtures.js`:
    - `promptFixture(overrides?: object): Prompt` returns a valid prompt with `id: "p1"`, `title: "Revisar PR"`, `content: "Você é um revisor."`, `isCode: false`, `rating: null` and `notes: []`.
    - Its metadata is `{ model: "Claude Sonnet 5.5", createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z", tokenEstimate: { min: 3, max: 5, confidence: "high" } }`.
    - `overrides.metadata` is shallow-merged into that metadata.
  - `tests/fixtures.js`: `memoryStorage(): Storage`, a Map-backed `getItem`/`setItem`/`removeItem`/`clear`.

- [ ] **Step 1: Create `package.json`** with `{ "name": "prompt-vault", "private": true, "type": "module", "scripts": { "test": "node --test" } }`.

- [ ] **Step 2: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, matchesAllTerms } from "../js/text-search.js";

test("normalize strips accents and case", () => {
  assert.equal(normalize("Gêmini AÇÃO"), "gemini acao");
});

test("every term must match, in any order", () => {
  assert.equal(matchesAllTerms("Anthropic Claude Opus 5.5", "opus  claude"), true);
  assert.equal(matchesAllTerms("Anthropic Claude Opus 5.5", "opus gpt"), false);
});

test("blank query matches everything", () => {
  assert.equal(matchesAllTerms("qualquer coisa", "   "), true);
});

test("regex characters match literally", () => {
  assert.equal(matchesAllTerms("Templates em C++", "c++"), true);
  assert.equal(matchesAllTerms("abc", "a.c"), false);
  assert.doesNotThrow(() => matchesAllTerms("x", "(["));
});
```

- [ ] **Step 3: Run `npm test`.** Expected: FAIL, `Cannot find module '../js/text-search.js'`.

- [ ] **Step 4: Implement `js/text-search.js`** with the two functions above. Use `String.prototype.includes`, never `RegExp`.

- [ ] **Step 5: Run `npm test`.** Expected: 4 passing.

- [ ] **Step 6: Point `js/model-combobox.js` at the shared module.** Delete its `normalize` and `matchesQuery`, and filter with `matchesAllTerms(\`${name} ${model}\`, query)`. In the browser, type "claude opus" in Modelo. Expected: exactly "Claude Opus 5.5" and "Claude Opus 5".

- [ ] **Step 7: Commit**

```bash
git add package.json js/text-search.js js/model-combobox.js tests/ README.md
git commit -m "test: add node:test harness and shared accent-insensitive search"
```

---

### Task 2: Pure library query (filter + sort)

**Files:**
- Create: `js/library-query.js`, `tests/library-query.test.js`

**Interfaces:**
- Consumes: `matchesAllTerms` (Task 1).
- Produces:
  - `SORT_ORDERS: readonly ["recent", "rating", "title"]`.
  - `isSortOrder(value: unknown): boolean`.
  - `queryLibrary(prompts: Prompt[], { query: string, sort: SortOrder }): Prompt[]`. Returns a new array, never mutates. A prompt is searchable by `title`, `metadata.model`, `content` and every `notes[].content`.

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, module not found.

- [ ] **Step 3: Implement `js/library-query.js`.** Use one `new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true })` at module scope, and write each comparator as a named pure function.

- [ ] **Step 4: Run `npm test`.** Expected: all passing.

- [ ] **Step 5: Commit** with `git commit -m "feat: pure library filter and sort"`.

---

### Task 3: Only real edits change "Editado em"

**Files:**
- Modify: `js/store.js:5,53-55` (remove `touch` from `updatePrompt` and from the import)
- Modify: `js/prompt-model.js` (add `revisePrompt`)
- Create: `tests/prompt-model.test.js`, `tests/store.test.js`

**Interfaces:**
- Produces:
  - `revisePrompt(prompt: Prompt, { title, model, content, isCode }): Prompt`. It validates `model` with the existing `assertModelName`, trims `model`, recomputes `metadata.tokenEstimate`, keeps `id`, `rating`, `notes` and `createdAt`, and returns the result of `touch`.
  - `store.updatePrompt(id, change)` now stores `change(prompt)` exactly as returned.

- [ ] **Step 1: Write the failing tests**

```js
// tests/prompt-model.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { revisePrompt } from "../js/prompt-model.js";
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
```

```js
// tests/store.test.js
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
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL. `revisePrompt` is not exported, and the store test's `updatedAt` differs.

- [ ] **Step 3: Implement `revisePrompt` and drop `touch` from `store.updatePrompt`.**

- [ ] **Step 4: Run `npm test`.** Expected: all passing.

- [ ] **Step 5: Check in the browser.** Rate any card. Expected: no "Editado em" line appears. Prompts already marked by earlier ratings keep their old timestamp, because that data can't be repaired.

- [ ] **Step 6: Commit** with `git commit -m "fix: ratings and notes no longer mark a prompt as edited"`.

---

### Task 4: Keyed rendering with drafts in view state

**Files:**
- Create: `js/keyed-list.js` (pure), `js/keyed-render.js` (DOM), `tests/keyed-list.test.js`
- Modify: `js/library-view.js:10-15,92-108` (list rendered through `renderKeyedList`; the new-note textarea gets its content from `view.noteDrafts`)
- Modify: `js/main.js:20-24,295` (add `noteDrafts: new Map()` to `view`; an `input` listener on `promptList` for `.note-form textarea` updates it; a successful `add-note` deletes the entry)

**Interfaces:**
- Produces (pure):
  - `planListUpdate(previous: Map<string, string>, next: Array<[key: string, signature: string]>): { removals: string[], steps: Array<{ key: string, action: "keep" | "create" | "replace" }> }`.
  - `previous` holds key → signature in DOM order.
  - `steps` follows the order of `next`.
- Produces (DOM): `renderKeyedList(list: HTMLUListElement, items: Array<{ key: string, signature: string, view: SafeHTML }>): void`.
  - Each item is one `<li data-key data-signature>`.
  - New nodes are created by parsing `view.markup` in a `<template>`.
  - A node is moved only when it isn't already in its target position. Use `list.moveBefore` when it exists (it preserves focus), otherwise `insertBefore`.
- Produces: `libraryItems(prompts, view): Array<{ key, signature, view }>`, exported from `library-view.js`.
  - `signature` is `JSON.stringify([prompt, editingNoteId-in-card, confirmingDelete, cardError])`.
  - `cardError` is `view.cardError?.promptId === id ? view.cardError.message : null`. `view.cardError` stays undefined until plan 02, Task 5.
  - Drafts and the expanded state are deliberately left out of the signature, so typing never re-renders a card.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, module not found.

- [ ] **Step 3: Implement `planListUpdate`, then `renderKeyedList`, then `libraryItems`.** `renderLibrary` keeps one persistent `<ul class="prompt-grid" role="list">` and swaps it with the empty state only when the list goes from empty to non-empty or back.

- [ ] **Step 4: Run `npm test`.** Expected: all passing.

- [ ] **Step 5: Check in the browser with the 3 sample prompts.**
  1. Type "rascunho" in card 2's new-note field, then rate card 3. Expected: the draft is still there.
  2. Rate card 2 itself. Expected: the draft is still there, and focus is on the star you pressed.
  3. In DevTools, run `document.querySelectorAll(".prompt-grid > li")[0] === firstBefore` across a rating of card 3. Expected: `true`, because the node was kept.

- [ ] **Step 6: Commit** with `git commit -m "fix: keyed library rendering keeps note drafts and unchanged cards"`.

---

### Task 5: Export and import

**Files:**
- Create: `js/library-transfer.js`, `tests/library-transfer.test.js`
- Modify: `index.html:98-101` (footer), `js/main.js` (wire up the footer controls), `styles/components.css` (footer controls)

**Interfaces:**
- Consumes: `parseStoredPrompts(json: string): { prompts, upgraded }` (from `prompt-model.js`).
- Produces:
  - `serializeLibrary(prompts: Prompt[], exportedAt: string): string` returns pretty JSON (two-space indent) `{ app: "prompt-vault", version: 1, exportedAt, prompts }`.
  - `parseLibraryFile(text: string): Prompt[]` accepts the envelope or a bare array. It throws `Error("Arquivo não reconhecido: …")` for anything else, and lets the `parseStoredPrompts` validation errors through.
  - `partitionImport(existing: Prompt[], incoming: Prompt[]): { fresh: Prompt[], duplicates: number }` matches by `id`.
  - `exportFileName(date: Date): string` returns `prompt-vault-AAAA-MM-DD.json` in local time.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeLibrary, parseLibraryFile, partitionImport, exportFileName } from "../js/library-transfer.js";
import { promptFixture } from "./fixtures.js";

test("export then import round-trips", () => {
  const prompts = [promptFixture({ id: "a" }), promptFixture({ id: "b" })];
  assert.deepEqual(parseLibraryFile(serializeLibrary(prompts, "2026-10-26T12:00:00.000Z")), prompts);
});

test("bare legacy array without metadata is upgraded", () => {
  const legacy = JSON.stringify([{ id: "x", title: "Antigo", content: "texto" }]);
  const [prompt] = parseLibraryFile(legacy);
  assert.equal(prompt.metadata.model, "Não informado");
});

test("unrecognized JSON is rejected with a pt-BR message", () => {
  assert.throws(() => parseLibraryFile('{"foo":1}'), /Arquivo não reconhecido/);
  assert.throws(() => parseLibraryFile("not json"), /Arquivo não reconhecido/);
});

test("importing the same prompts twice adds nothing", () => {
  const prompts = [promptFixture({ id: "a" }), promptFixture({ id: "b" })];
  assert.deepEqual(partitionImport(prompts, prompts), { fresh: [], duplicates: 2 });
  assert.deepEqual(partitionImport([prompts[0]], prompts), { fresh: [prompts[1]], duplicates: 1 });
});

test("file name uses the local date", () => {
  assert.equal(exportFileName(new Date(2026, 9, 26, 23, 30)), "prompt-vault-2026-10-26.json");
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, module not found.

- [ ] **Step 3: Implement `js/library-transfer.js`.** Wrap the `JSON.parse` `SyntaxError` as "Arquivo não reconhecido: o conteúdo não é JSON.", and pass `cause`.

- [ ] **Step 4: Run `npm test`.** Expected: all passing.

- [ ] **Step 5: Replace the footer's two taglines.**
  - Keep `<span>Nada sai do seu navegador.</span>`.
  - Add `<button class="text-button" type="button" data-transfer="export">Exportar biblioteca</button>`.
  - Add `<label class="text-button">Importar…<input class="visually-hidden" type="file" accept=".json,application/json" data-transfer="import"></label>`.
  - Show the label's focus ring with `.text-button:has(input:focus-visible)`.
  - Set the export button's `disabled` in `renderApp` when the library is empty.

- [ ] **Step 6: Wire the footer controls in `main.js`.**
  - Export: build a `Blob`, set `a.download = exportFileName(new Date())`, then `URL.revokeObjectURL`.
  - Import: `await file.text()`, then `parseLibraryFile`, then `partitionImport`, then `attempt(() => store.addPrompts(fresh), "Não foi possível importar.")`.
  - On success, `announce` "`${fresh.length}` importados, `${duplicates}` já existiam".
  - On a parse error, call `showError(error.message)`.
  - Reset the input's `value` so the same file can be chosen again.

- [ ] **Step 7: Check in the browser.**
  1. Export, then import the same file. Expected: "0 importados, 3 já existiam".
  2. Delete one prompt and import again. Expected: "1 importados, 2 já existiam", and the card comes back.
  3. Import a `.json` containing `{}`. Expected: the status line reads "Arquivo não reconhecido…".

- [ ] **Step 8: Commit** with `git commit -m "feat: export and import the library as JSON"`.
