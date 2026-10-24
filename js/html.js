// A tiny `html` tagged template: interpolated values are escaped unless they
// are themselves the result of `html` (or `trustedHTML`), so user text can
// never inject markup.

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

class SafeHTML {
  constructor(markup) {
    this.markup = markup;
  }
}

function serialize(value) {
  if (value === null || value === undefined || value === false) return "";
  if (value instanceof SafeHTML) return value.markup;
  if (Array.isArray(value)) return value.map(serialize).join("");
  return String(value).replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

export function html(strings, ...values) {
  return new SafeHTML(
    strings.reduce((markup, string, index) => markup + serialize(values[index - 1]) + string),
  );
}

/** Marks a string the app itself authored (never user input) as markup. */
export function trustedHTML(markup) {
  return new SafeHTML(markup);
}

export function render(target, view) {
  target.innerHTML = view.markup;
}
