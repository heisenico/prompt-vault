# Quiet Apple Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Apple-native identity and remove what reads as decoration: a quieter viewer that opens ready to copy, SF-correct type tokens, and consistent small details.

**Architecture:** This is CSS and markup only, plus one shared JS constant. Tokens in `styles/tokens.css` stay the single source of truth, and component rules consume them. The checks are visual and measured in Chrome, in light and dark mode, plus the Impeccable detector.

**Tech Stack:** CSS cascade layers, custom properties, `@media` user-preference queries.

**Spec:** `docs/superpowers/specs/2026-10-26-prompt-vault-ux-overhaul.md` (decisions 5, 12)

**Depends on:** nothing. It can run before, after or alongside plans 01 and 02. If it runs after plan 02, Task 3's star-color note still applies inside the card's "Avaliar e anotar" details.

## Global Constraints

- All of plan 01's Global Constraints apply.
- Keep the `-webkit-backdrop-filter` prefix (Safari 17).
- Every rule touched keeps its `prefers-reduced-transparency`, `prefers-contrast`, `prefers-reduced-motion` and `forced-colors` counterpart in step.
- No new colors outside `tokens.css`.

## Review Focus

- With prefers-reduced-transparency, the viewer panel is still fully opaque (`--glass-fill-solid`) after the pseudo-elements are removed. Browser check in Task 1.
- In forced-colors mode, the viewer panel keeps a visible `CanvasText` border, and Copy keeps its `ButtonText` border. Browser check in Task 1.
- With reduced motion, the viewer still appears with a short fade, never a jump or a spring. Browser check in Task 1.
- In light mode, every tracking-adjusted size still meets 4.5:1. Color isn't changed, but check that no text rule lost its color while being edited. Browser check in Task 2.
- At 390px, the nav note "Salvo só neste navegador" and the brand fit on one line without overflow. Browser check in Task 3.

---

### Task 1: A viewer that opens ready to copy

**Files:**
- Modify: `index.html:105-113` (move `autofocus` from the close button to the `.copy-pill`; replace `.viewer-eyebrow` with `<p class="viewer-model" data-field="model">` placed after the title)
- Modify: `styles/prompt-viewer.css:32-39` (backdrop), `:60-85` (delete `.viewer-panel::before` and `::after`), `:118-126` (rename the rule to `.viewer-model` in `--text-subhead`, secondary color), `:127-133` (`.viewer-title` font-size `var(--text-title)`), `:246` (copy-pill shadow), `:286-295` and the `@keyframes ripple` block (delete), `:303-305` (entrance), `:451-454` (remove the now-dead pseudo-element selectors from forced-colors)
- Modify: `js/prompt-viewer.js:46` (the `model` field is unchanged; check that it still fills the new element)

**Interfaces:**
- Produces: `.viewer-model` (replaces `.viewer-eyebrow`). Nothing else changes in `prompt-viewer.js`'s API.

- [ ] **Step 1: Quiet the backdrop.** `.prompt-viewer::backdrop` becomes `background: rgb(0 0 0 / 40%)` with no blur. Keep the literal color, per the comment at line 31.

- [ ] **Step 2: Strip the panel decoration.**
  - Delete both pseudo-elements and the ripple.
  - The copy pill shadow becomes `inset 0 1px 0 rgb(255 255 255 / 30%)` only, which removes the accent glow the detector flagged.
  - Keep the translucent `--glass-fill` and `--glass-blur`, the `@supports` fallback and the reduced-transparency rule as they are.

- [ ] **Step 3: Calm the entrance.** The `.prompt-viewer[open] .viewer-panel` animation becomes `viewer-in var(--duration-base) var(--ease-out)`. Check that `@keyframes viewer-in` has no overshoot, meaning no scale above 1. If it does, start the scale at `0.98` and end at `1`.

- [ ] **Step 4: Move focus to Copy.** Move `autofocus` to the copy pill.

- [ ] **Step 5: Check in the browser.**
  1. Open any prompt: `document.activeElement.dataset.viewerAction === "copy"`. Press Enter: the clipboard holds the prompt and the label reads "Copiado!".
  2. Emulate `prefers-reduced-transparency: reduce` in DevTools: the computed panel background is `--glass-fill-solid`.
  3. Emulate `forced-colors: active`: the panel border is visible.
  4. Emulate reduced motion: the panel appears within about 160ms with opacity only.
  5. Run `node ~/.claude/plugins/cache/impeccable/impeccable/3.5.0/skills/impeccable/scripts/detect.mjs --json index.html`: exit code 0.

- [ ] **Step 6: Commit** with `git commit -m "refactor: quieter viewer that opens focused on copy"`.

---

### Task 2: SF type tokens (fixed sizes, size-specific tracking)

**Files:**
- Modify: `styles/tokens.css:11-18` (add tracking and leading tokens; fix the large title size)
- Modify: `styles/base.css:21-22`; every `font-size: var(--text-*)` declaration in `styles/components.css` (28), `styles/prompt-viewer.css` (6) and `styles/layout.css` (1)

**Interfaces:**
- Produces:
  - Tracking tokens (`pt / size` from the Apple HIG "Typography → Tracking values" table): `--tracking-caption: 0`, `--tracking-footnote: -0.006em`, `--tracking-subhead: -0.016em`, `--tracking-body: -0.025em`, `--tracking-title: -0.012em`, `--tracking-large-title: 0.012em`.
  - Leading tokens: `--leading-tight: 1.2`, `--leading-body: 1.3` (HIG body 17/22), `--leading-prose: 1.45` (previews, notes, any multi-line user text).
  - `--text-large-title: 2.125rem`, fixed, with no `clamp()`.

- [ ] **Step 1: Verify the tracking values** against https://developer.apple.com/design/human-interface-guidelines/typography before writing them. These numbers were recalled from memory: 12pt 0, 13pt −0.08, 15pt −0.24, 17pt −0.43, 22pt −0.26, 34pt +0.40. Use the table's values if they differ, and note the doc page in the commit body.

- [ ] **Step 2: Add the tokens.**
  - In `base.css`, `body` becomes `line-height: var(--leading-body)` and `letter-spacing: var(--tracking-body)`.
  - Every `font-size: var(--text-X)` declaration gets `letter-spacing: var(--tracking-X)` directly beneath it. `components.css:66` becomes `var(--tracking-large-title)`.
  - `.prompt-preview`, `.note-content` and `.group-footer` get `line-height: var(--leading-prose)`. This also clears the detector's tight-leading hit.

- [ ] **Step 3: Verify the pairing.**

  Run: `for f in styles/components.css styles/prompt-viewer.css styles/layout.css; do echo "$f $(grep -c 'font-size: var(--text' $f) $(grep -c 'letter-spacing: var(--tracking' $f)"; done`

  Expected: the two counts are equal on every line.

- [ ] **Step 4: Check in the browser.**
  1. At 1280px and at 390px, the h1 computes to 34px at both widths.
  2. In light mode, re-measure contrast for `.card-meta` or `.metadata-model`, `.group-footer` and `.count-badge`: each is ≥ 4.5:1.

- [ ] **Step 5: Commit** with `git commit -m "style: fixed type scale with SF size-specific tracking tokens"`.

---

### Task 3: Small consistency fixes

**Files:**
- Modify: `index.html:10` (`<title>Prompt Vault</title>`), `styles/components.css:19` (`.app-icon` background `var(--color-accent)`, no gradient), `styles/components.css:42-50` (delete the narrow-screen hide of `.nav-note-text`)
- Modify: `js/clipboard.js` (export `COPY_RESET_DELAY = 2000`), `js/main.js:12` and `js/prompt-viewer.js:9` (import it; delete the local constants)

**Interfaces:**
- Produces: `COPY_RESET_DELAY: 2000`, exported from `js/clipboard.js`.

- [ ] **Step 1: Make the edits listed above.**
  - The idle `.rating-star` color stays `var(--color-control-border)`. A star is a non-text state indicator, so WCAG 1.4.11's 3:1 applies, and it measured 4.09:1 in dark mode. Record this in the commit body so the detector's text-contrast hit isn't "fixed" later.

- [ ] **Step 2: Check in the browser.**
  1. The tab title is "Prompt Vault".
  2. At 390px, `.nav-note-text` is visible and `document.documentElement.scrollWidth === innerWidth`.
  3. Copy from a card and from the viewer: both reset after 2s.

- [ ] **Step 3: Run the full check.**
  1. Run `npm test` (if plan 01 has landed): all passing.
  2. Re-run `/impeccable critique index.html`. Expected: no P0 or P1, and Aesthetic & Minimalist ≥ 3.

- [ ] **Step 4: Commit** with `git commit -m "style: solid app icon, visible privacy note, one copy reset delay"`.
