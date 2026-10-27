# Retrieval-First Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make finding and copying a prompt the page's first job: one library-first column, search and sort, dense cards with Copy as the primary action, editing, and errors shown where they happen.

**Architecture:** `main.js` keeps one `view` state object. Every interaction updates `view` or the store, then calls `renderApp()`, which runs `queryLibrary` and `renderKeyedList` from plan 01. The composer (new/edit form) is its own shell module. Pure helpers get `node:test` tests; layout and interaction are checked in Chrome at 1280px and 390px, in light and dark mode.

**Tech Stack:** Vanilla ES modules, CSS cascade layers (`styles/main.css`), `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-26-prompt-vault-ux-overhaul.md` (decisions 2, 4, 5, 6, 9, 11, 13)

**Depends on:** plan 01 (`queryLibrary`, `SORT_ORDERS`, `isSortOrder`, `renderKeyedList`, `libraryItems`, `revisePrompt`, `view.noteDrafts`).

## Global Constraints

- All of plan 01's Global Constraints apply.
- Interactive controls are ≥ 44×44px under `(pointer: coarse)` and ≥ 24×24px otherwise (WCAG 2.2 2.5.8).
- Text contrast ≥ 4.5:1 and control boundaries ≥ 3:1 in both color schemes, using the existing tokens in `styles/tokens.css`.
- Every new `localStorage` read or write is wrapped in `try/catch`, and the catch calls `console.error`. The UI keeps working without storage.
- The main column is at most `46rem` (a new token, `--reading-width`). The nav keeps `--content-width`.

## Review Focus

- Typing "/" inside the composer, a note or the search field types a slash; only outside fields does it jump to search. Browser check in Task 2.
- Saving a new prompt while a search is active clears the search, so the new card is visible and focusable. Browser check in Task 2.
- Deleting the prompt currently open in the composer for editing resets the composer to "Novo prompt", with the saved draft restored. Browser check in Task 4.
- A 100-character title with no spaces wraps inside the card at 390px with no horizontal scroll (`overflow-wrap: anywhere`). Browser check in Task 3.
- With storage blocked (DevTools → Application → block site data), the draft and sort silently fall back to defaults, an error is logged, and saving a prompt still reports the storage error in the status line. Browser check in Task 1.

---

### Task 1: Library-first layout and the composer

**Files:**
- Modify: `index.html:38-96` (remove `.intro`; restructure `main`)
- Create: `js/composer.js`
- Modify: `js/main.js:59-102` (form handling moves to composer callbacks)
- Modify: `styles/layout.css` (remove the `.workspace` grid and the sticky editor; add `--reading-width` to `tokens.css`)
- Modify: `styles/components.css` (`.composer` and `.library-toolbar`)

**Interfaces:**
- Produces: `initComposer(form: HTMLFormElement, { panel: HTMLElement, toggle: HTMLButtonElement, onSubmit: (fields: PromptFields, editingId: string | null) => boolean }): Composer`, where
  - `Composer = { open({ focus?: boolean }): void, close(): void, edit(prompt: Prompt): void, reset(): void, editingId(): string | null }`
  - `PromptFields = { title: string, model: string, content: string, isCode: boolean }`
  - `onSubmit` returns `true` when the save succeeded; the composer then clears the form and the draft and closes.
- Markup contract:
  - `<main class="page-width reading-width">`
  - `<header class="library-header">` holds `h1#library-title` ("Biblioteca" plus `#prompt-count`) and `<button id="composer-toggle" class="primary-pill" aria-expanded="false" aria-controls="composer">Novo prompt</button>`.
  - `<section id="composer" class="composer" hidden aria-labelledby="form-title">` wraps the existing `#prompt-form` and adds a `<button type="button" data-composer="cancel">Cancelar</button>` next to the submit button.
  - `#status-message` and `#prompt-list` follow.

- [ ] **Step 1: Restructure the markup to that contract.**
  - The `<h2 id="form-title">` text becomes "Novo prompt", or "Editar prompt" while editing.
  - The submit button text is "Salvar prompt", or "Salvar alterações" while editing.
  - Remove the `<section class="intro">` block.

- [ ] **Step 2: Implement `js/composer.js`.**
  - Opening shows the panel, sets `aria-expanded="true"` on the toggle, and focuses `#prompt-title` unless `focus: false`.
  - Escape inside the panel and the Cancelar button both close it and return focus to the toggle.
  - ⌘Enter or Ctrl+Enter in any field calls `form.requestSubmit()`.
  - While not editing, every `input` saves `{ title, model, content, isCode }` to `localStorage["prompt-vault-draft"]`, debounced 300ms. The draft is restored at init and removed after a successful save.
  - `edit(prompt)` fills the fields, swaps the heading and button text, opens the panel, and calls `panel.scrollIntoView({ block: "nearest" })`. It does not touch the draft.

- [ ] **Step 3: Wire it in `main.js`.**
  - `onSubmit` reuses the existing validation and `createPrompt` path.
  - `renderApp` calls `composer.open({ focus: false })` when the store is empty and `composer.editingId()` is null.

- [ ] **Step 4: Style it.**
  - The composer reuses `.grouped-list` and gets a `var(--space-5)` gap below the header.
  - `.primary-pill` is the existing `.primary-button` look at `min-height: 2.75rem` with `padding-inline: var(--space-5)`.
  - Delete `.workspace` and `.editor-panel` from `layout.css`.

- [ ] **Step 5: Check in the browser.**
  1. At 390px with 3 prompts, the first card's top edge is above 300px (it was 879px).
  2. Click "Novo prompt", type a title, reload. Expected: the composer reopens with the title restored.
  3. ⌘Enter with all fields filled saves, closes the composer, and the new card appears first.
  4. Escape closes the composer and focus lands on "Novo prompt".
  5. Block site data in DevTools and reload. Expected: the page renders, the console shows the draft read error, and saving shows the storage hint in `#status-message`.

- [ ] **Step 6: Commit** with `git commit -m "feat: library-first layout with a collapsible composer and saved draft"`.

---

### Task 2: Search and sort

**Files:**
- Modify: `index.html` (toolbar inside `.library-header`), `js/main.js` (view state and listeners), `js/library-view.js` (no-results state), `styles/components.css`

**Interfaces:**
- Consumes: `queryLibrary`, `isSortOrder`, `SORT_ORDERS` (plan 01, Task 2); `announce` (`js/feedback.js`).
- Produces:
  - `view.query: string` and `view.sort: SortOrder`.
  - `renderLibrary(container, prompts, view, { total: number })`. When `prompts` is empty and `total > 0`, it renders the no-results state instead of the empty-library state.
- Markup:
  - `<search class="library-toolbar">`.
  - `<label class="visually-hidden" for="library-search">Buscar prompts</label>` and `<input id="library-search" type="search" placeholder="Buscar por título, modelo, texto ou nota" autocomplete="off" enterkeyhint="search" aria-keyshortcuts="/">`.
  - `<label class="visually-hidden" for="library-sort">Ordenar por</label>` and `<select id="library-sort">` with options `recent` "Recentes", `rating` "Mais bem avaliados" and `title` "A–Z".

- [ ] **Step 1: Add the toolbar markup.**
  - Search grows with `flex: 1`; the sort select keeps its intrinsic width.
  - Both are `2.75rem` tall, filled with `var(--color-fill)`, with radius `var(--radius-control)`.
  - The search field gets a leading magnifier icon. Add `search` to `ICON_PATHS` with paths `["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M20 20l-4.2-4.2"]`.

- [ ] **Step 2: Wire the state.**
  - Search `input` sets `view.query` and calls `renderApp()`.
  - Sort `change` sets `view.sort`, writes `localStorage["prompt-vault-sort"]` and calls `renderApp()`.
  - At init, read the stored sort and keep it only if `isSortOrder` accepts it.
  - `renderApp` passes `queryLibrary(store.listPrompts(), view)` to the view, and `cardActions.open` uses that same visible order as the viewer's `sequence`.

- [ ] **Step 3: Add keyboard shortcuts.**
  - A `document` `keydown` handler focuses search on `/` only when there are no modifiers, `event.target` is not inside `input, textarea, select, [contenteditable]`, and the viewer dialog isn't open.
  - Escape in a non-empty search clears it and calls `renderApp()`.
  - On a successful save, clear `view.query` and the search field before rendering.

- [ ] **Step 4: Add result feedback.**
  - Debounce by 400ms, then `announce(\`${shown} de ${total} prompts\`)` while a query is active.
  - The no-results state reads `Nada encontrado para “${query}”.` and has a `<button class="text-button is-tinted" data-action="clear-search">Limpar busca</button>`, handled in `cardActions`.

- [ ] **Step 5: Check in the browser with the 3 samples.**
  1. Type "testes": 1 card. Type "zzz": the no-results state, and "Limpar busca" restores all 3.
  2. Choose "A–Z" and reload: the order is still A–Z.
  3. Press `/` from the page: focus is in search. Press `/` inside the composer's Prompt field: a slash is typed.
  4. With "testes" active, save a new prompt titled "Outro": the search is cleared and "Outro" is visible.
  5. Open the viewer from the filtered list: the position reads "1 de 1".

- [ ] **Step 6: Commit** with `git commit -m "feat: search and sort the library"`.

---

### Task 3: Dense cards with Copy as the primary action

**Files:**
- Modify: `js/library-view.js:17-108`, `js/main.js` (view state `expandedIds`), `styles/components.css:470-560` (card rules)

**Interfaces:**
- Consumes: `libraryItems` (plan 01); `view.noteDrafts`.
- Produces: `view.expandedIds: Set<string>`. It is kept in sync by a capturing `toggle` listener on `#prompt-list`, because `toggle` doesn't bubble. It is never part of a card's signature.
- Card markup, top to bottom:
  1. `header.card-header`, holding `h3.card-title` and `<button class="copy-pill-small" data-action="copy" data-state="idle">` with the copy/check icons and the text "Copiar". Its accessible name is "Copiar " plus the title.
  2. `p.card-meta`: `${model} · ★ ${rating}` (the star part only when rated) ` · ≈ ${range} tokens`. The confidence goes in a `visually-hidden` span.
  3. `p.prompt-preview`, clamped to 2 lines.
  4. `div.card-footer`, holding the existing `.open-button`, restyled as an untinted text button, and `<details class="card-more" ${open}>`. Its summary reads `Avaliar e anotar`, plus ` · ${n} notas` when n > 0. Its body holds the rating group, the notes section, the dates (Criado/Editado), `<button class="text-button" data-action="edit-prompt">Editar prompt</button>` and `<button class="text-button is-danger" data-action="delete">Excluir prompt</button>`, followed by the existing delete confirmation.
- `open` is rendered when `expandedIds` has the id, or when this card has `confirmingDeleteId` or a note being edited.

- [ ] **Step 1: Rewrite `promptCard`** to the markup above.
  - Remove the `.delete-button` icon button and `.metadata-section`.
  - The `xmark` icon stays, because the viewer still uses it.

- [ ] **Step 2: Restyle the cards.**
  - `.card-title` gets `overflow-wrap: anywhere` and a 2-line clamp.
  - `.copy-pill-small` uses `--color-accent` with `--color-on-accent`, `min-height: 2.25rem` (2.75rem under `(pointer: coarse)`), and pill radius.
  - `.card-meta` uses `--text-footnote` in secondary color.
  - Use the `.prompt-preview` clamp `-webkit-line-clamp: 2` at `components.css:651`.
  - Delete `.prompt-card:hover`'s translate at `components.css:612`.
  - `.card-more > summary` is a text button with a rotating chevron (the `chevron` icon), `list-style: none`, and `::-webkit-details-marker { display: none }`.

- [ ] **Step 3: Track expansion.** On `toggle`, add the card's `data-prompt-id` to `view.expandedIds` or delete it. Do not call `renderApp`.

- [ ] **Step 4: Check in the browser.**
  1. At 390px, a closed card with a one-line title is at most 152px tall (`getBoundingClientRect().height`).
  2. Tabbing through a closed card hits exactly 3 stops: Copiar, Ver completo, the summary.
  3. Open "Avaliar e anotar" on card 2 and rate it: the details stay open.
  4. Type a note draft in card 2, search for something that hides card 2, then clear the search: the draft is still there.
  5. Save a prompt whose title is 100 "a" characters: no horizontal scroll at 390px (`document.documentElement.scrollWidth === innerWidth`).

- [ ] **Step 5: Commit** with `git commit -m "feat: dense prompt cards with copy as the primary action"`.

---

### Task 4: Edit a prompt

**Files:**
- Modify: `js/main.js` (`cardActions["edit-prompt"]` and an `onSubmit` branch), `js/composer.js` (already exposes `edit`)

**Interfaces:**
- Consumes: `composer.edit`, `composer.editingId`, `composer.reset` (Task 1); `revisePrompt` (plan 01, Task 3).

- [ ] **Step 1: Add the action.** `cardActions["edit-prompt"](promptId)` calls `composer.edit(store.getPrompt(promptId))`.

- [ ] **Step 2: Save edits.**
  - When `editingId` is set, `onSubmit` runs `attempt(() => store.updatePrompt(editingId, (p) => revisePrompt(p, fields)), "Não foi possível salvar as alterações.")`.
  - It then announces `“${title}” atualizado` and focuses that card's `[data-action="copy"]`.

- [ ] **Step 3: Handle deletion while editing.** In `cardActions["confirm-delete"]`, if `promptId === composer.editingId()`, call `composer.reset()`. This restores new-prompt mode and the saved draft, and closes the panel.

- [ ] **Step 4: Check in the browser.**
  1. Edit a sample's title: the card updates in place, "Editado em" appears inside its details, and the card keeps its position under "Recentes".
  2. Start editing, then cancel: a reload shows the composer's new-prompt draft unchanged.
  3. Start editing card 1, then delete card 1 from its details: the composer resets to "Novo prompt".

- [ ] **Step 5: Commit** with `git commit -m "feat: edit a saved prompt in the composer"`.

---

### Task 5: Errors at their source

**Files:**
- Create: `js/prompt-fields.js`, `tests/prompt-fields.test.js`
- Modify: `index.html` (add `<p id="form-error" class="form-error" role="alert" hidden></p>` after `.grouped-list`), `js/main.js:66-87,106-113,197-202`, `js/library-view.js` (`.card-error` slot), `styles/components.css`

**Interfaces:**
- Produces:
  - `missingFields(fields: PromptFields): Array<"title" | "model" | "content">`, in form order. Whitespace-only counts as missing. It replaces `findMissingFields` in `main.js`.
  - `missingFieldsMessage(missing): string`, for example `"Preencha o título e o prompt para salvar."`, using `formatList`.
  - `view.cardError: { promptId: string, message: string } | null`. It is part of the card signature, and is cleared by the next successful card action.

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { missingFields, missingFieldsMessage } from "../js/prompt-fields.js";

test("whitespace-only fields are missing, in form order", () => {
  assert.deepEqual(missingFields({ title: " ", model: "GPT-6.1 Sol", content: "\n", isCode: false }), ["title", "content"]);
});

test("message lists missing fields in pt-BR", () => {
  assert.equal(missingFieldsMessage(["title", "content"]), "Preencha o título e o prompt para salvar.");
  assert.equal(missingFieldsMessage(["model"]), "Preencha o modelo para salvar.");
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, module not found.

- [ ] **Step 3: Implement `js/prompt-fields.js`.** Run `npm test`. Expected: all passing.

- [ ] **Step 4: Report composer errors in the form.**
  - On a failed submit, set `#form-error` text and `hidden = false`.
  - Set `aria-invalid="true"` and `aria-describedby="form-error"` on each missing field, and focus the first one.
  - An `input` on an invalid field with a non-blank value removes both attributes, and hides `#form-error` once no field is invalid.
  - CSS: `.field-row:has([aria-invalid="true"]) { box-shadow: inset 0 0 0 2px var(--color-danger) }` and `.field-row:has([aria-invalid="true"]) > label { color: var(--color-danger) }`. The existing focus ring rule comes after it and wins while the field is focused.

- [ ] **Step 5: Report card errors in the card.**
  - A copy failure, a blank note and a failed rating write set `view.cardError` and call `renderApp()`, instead of `showError`.
  - The card renders `<p class="card-error" role="alert">` under its header.
  - Storage-hint messages for card actions also go in the card. `showError` is kept only for load and import failures.

- [ ] **Step 6: Check in the browser.**
  1. Submit an empty composer: the alert is inside the form, all three rows are outlined in danger color, focus is on Título, and VoiceOver reads the field as invalid with the message.
  2. Type a title: its row loses the outline, and the message stays for the other two.
  3. Submit an empty note on card 3 while scrolled to card 3: the error is visible inside card 3.

- [ ] **Step 7: Commit** with `git commit -m "feat: show errors at their source with aria-invalid"`.
