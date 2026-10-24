# Prompt Vault

A personal prompt library in vanilla HTML, CSS and JavaScript. It has no build step, no framework and no dependencies. Prompts are stored in your browser's `localStorage` and never leave your device. The interface is in Brazilian Portuguese.

## Run locally

The app uses ES modules, and browsers block modules loaded from `file://` URLs. Opening `index.html` directly will not work, so serve the folder with any static server:

```sh
python3 -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000>. Copy-to-clipboard needs a secure context (`localhost` or `https://`).

## Use

- **Save:** fill in the form and press **Salvar prompt**. The checkup hints at what the prompt is missing and estimates its token count.
- **Full view:** press **Ver completo** on any card to read the whole prompt in a glass panel.
  - **Copiar prompt** copies the full text.
  - **← / →** (or the arrow buttons) move to the previous or next prompt.
  - **Esc**, the close button, or a click outside the panel closes it, and focus returns to the card.
- **Try it:** with an empty library, **Carregar exemplos** loads three sample prompts.

## Project structure

```
index.html              Page markup, including the full-view <dialog>
styles/main.css         Cascade layer order and imports
styles/tokens.css       Design tokens: color, type, space, motion
styles/base.css         Element defaults and focus styles
styles/layout.css       Page shell and responsive grid
styles/components.css   Form, cards, rating, notes
styles/prompt-viewer.css  Liquid glass panel, its animations and fallbacks
styles/utilities.css    .visually-hidden
js/main.js              Wires the UI: form and card actions
js/store.js             Prompt library in a Map, kept in sync with localStorage
js/prompt-model.js      Creating, estimating, validating and upgrading prompts
js/library-view.js      Card and empty-state markup
js/prompt-viewer.js     Full-view dialog behavior
js/checkup.js           Live prompt checkup
js/html.js              Escaping `html` tagged template
js/icons.js, format.js, clipboard.js, feedback.js   Small helpers
data/sample-prompts.json  Sample prompts
```

## Browser support

Current Chrome, Edge, Firefox and Safari. The glass panel uses `backdrop-filter`, with the `-webkit-` prefix kept for Safari 17 and earlier. Where `backdrop-filter` is unsupported, or the user has asked for reduced transparency, the panel uses an opaque surface instead. When reduced motion is requested, the animations become a short fade.

## License

[MIT](LICENSE)
