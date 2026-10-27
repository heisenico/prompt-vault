import { trustedHTML } from "./html.js";

const ICON_PATHS = {
  xmark: ["M6 6l12 12", "M18 6L6 18"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  chevron: ["M7 10l5 5 5-5"],
  copy: [
    "M10 8h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z",
    "M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2",
  ],
  expand: ["M14 4h6v6", "M20 4l-7 7", "M10 20H4v-6", "M4 20l7-7"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M20 20l-4.2-4.2"],
  tray: [
    "M3 13.5h4.5l1.5 2.5h6l1.5-2.5H21",
    "M5.5 5.5h13l2.5 8v4A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-4z",
  ],
};

export function icon(name, { strokeWidth = 2, className = "" } = {}) {
  const paths = ICON_PATHS[name].map((d) => `<path d="${d}"/>`).join("");
  return trustedHTML(
    `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
      `stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`,
  );
}
