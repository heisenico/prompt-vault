# Prompt Vault UX overhaul: spec

Source: Impeccable critique of `index.html`, 2026-10-26 (23/40), snapshot in
`.impeccable/critique/2026-10-27T02-28-34Z__index-html.md`, plus PRODUCT.md.
Every finding below was checked against the code before it was written down.

## Problem

PRODUCT.md says retrieval comes first: open the vault mid-task, find a prompt, copy it, leave.
The current page is built around saving instead. Specifically:

- **No way to find anything.** The library has no search and no sort (`store.js:46` hard-codes newest first).
- **The form comes first.** It is the first column; on a 390px screen the first card starts 879px down. A marketing hero sits above both.
- **Cards are heavy.** Each is about 500px tall, with stars and a full notes form always open. Copy, the main job, is a 30px grey icon.
- **Silent data loss.** Every store change replaces the whole list via `innerHTML` (`html.js:32`, `main.js:293`), which wipes any note being typed.
- **Rating looks like editing.** Rating goes through `touch()` (`store.js:54`), so the card shows "Editado em".
- **No edit.** A prompt's title, model or content can't be changed.
- **No backup.** One "clear site data" wipes the vault, and there is no export.
- **Errors appear far from their cause.** They render in the library column (`index.html:92`), and fields never get `aria-invalid`.
- **The viewer focuses the wrong control.** It focuses Close, not Copy (`index.html:112`), and its decorative glass slows a copy-and-go task.

## Decisions

1. **Functional core, imperative shell.** All new logic that doesn't touch the DOM or storage lives in pure modules (search, query, keyed-list diff, import/export, field validation). These are tested with `node:test` and add no dependencies. DOM behavior is checked in the browser with the exact steps written in each task.
2. **One column, library first.** The page shows the "Biblioteca" heading (the page's h1), then a toolbar, then the list. The hero is removed. The form becomes a "composer" disclosure toggled by "Novo prompt", and it opens on its own when the library is empty. The column is at most 46rem wide.
3. **Search.** Matching ignores case and accents, and every term must appear somewhere in title, model, content or notes. Plain substring matching, no regex. Shared with the model combobox.
4. **Sort.** Three orders: Recentes (default), Mais bem avaliados (unrated last, ties by most recent), A–Z (pt-BR collator, numeric). The choice is remembered in `localStorage` under `prompt-vault-sort`. The search text is not remembered.
5. **Keyboard.**
   - `/` focuses search, except while typing in a field.
   - Escape clears the search.
   - ⌘/Ctrl+Enter submits the composer.
   - The viewer opens with focus on "Copiar prompt".
6. **Dense card.**
   - Title, with a primary "Copiar" button.
   - A meta line: model · ★n · ≈ tokens.
   - A two-line preview.
   - "Ver completo".
   - A `<details>` "Avaliar e anotar" holding the rating, notes, dates, "Editar prompt" and "Excluir prompt". The open/closed state lives in view state. Delete moves inside it, and the × icon button goes away.
7. **Rendering is keyed by prompt id.** Only cards whose rendered inputs changed are replaced. Note drafts live in view state, keyed by prompt id, so they survive re-renders, filtering and sorting.
8. **Timestamps are explicit.** `store.updatePrompt` never touches `updatedAt`. Only `revisePrompt` (an edit of title, model, content or the code flag) does. Ratings and notes are not edits.
9. **Edit** reuses the composer, with the heading "Editar prompt" and the button "Salvar alterações".
10. **Export/import** live in the footer.
    - Export downloads `prompt-vault-AAAA-MM-DD.json` as `{ app: "prompt-vault", version: 1, exportedAt, prompts }`.
    - Import accepts that file, or a bare array in the stored format. It validates with `parseStoredPrompts`, skips ids already in the library, and reports how many prompts were added and how many skipped.
11. **Errors appear at their source.** Composer errors go in an alert inside the form, with `aria-invalid` and `aria-describedby` on the missing fields. Card errors go in a `.card-error` inside the card. The global status line is kept only for load and storage failures.
12. **Quieter, still Apple.** We keep the HIG direction: system font, grouped lists, one material.
    - The viewer keeps a translucent panel, but loses the colored backdrop gradients, the specular and rim pseudo-elements, the ripple and the accent glow.
    - The viewer's entrance uses `--duration-base` with `--ease-out`.
    - Type sizes are fixed rems (no `clamp()`), each with its SF tracking token (Apple HIG tracking table).
    - The app icon is a solid accent color, and the `<title>` drops the em dash.
13. **Composer draft.** An unsaved new prompt is kept in `localStorage` under `prompt-vault-draft` and restored on load. Edits don't use the draft.
14. **Out of scope:** undo for delete (the inline confirm stays), cloud sync, tags.

## Requirements carried from PRODUCT.md

- WCAG 2.2 AA.
- Works with prefers-reduced-motion, prefers-reduced-transparency, prefers-contrast and forced-colors.
- pt-BR copy.
- Nothing leaves the browser: only same-origin static files are fetched.
