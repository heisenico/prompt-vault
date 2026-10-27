// Turns the model text field into an editable combobox (WAI-ARIA 1.2 "list
// autocomplete" pattern). Suggestions come from data/models.json, a bundled
// snapshot refreshed by scripts/update-models.mjs; any other text still saves.

import { html, render } from "./html.js";
import { icon } from "./icons.js";
import { announce } from "./feedback.js";
import { matchesAllTerms } from "./text-search.js";

const MODELS_URL = new URL("../data/models.json", import.meta.url);
const ANNOUNCE_DELAY = 500;
const VIEWPORT_MARGIN = 16;
const MIN_LIST_HEIGHT = 160;

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export async function initModelCombobox(input) {
  const response = await fetch(MODELS_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const { providers, updatedAt } = await response.json();

  // Built only once the list has loaded, so a failed fetch leaves a plain text field.
  const field = document.createElement("div");
  field.className = "model-field";
  input.replaceWith(field);

  const popover = document.createElement("div");
  popover.className = "model-popover";
  popover.popover = "manual";
  render(popover, html`
    <ul id="model-options" class="model-options" role="listbox" aria-label="Modelos sugeridos"></ul>
    <p class="model-footnote">Lista de ${dateFormat.format(new Date(updatedAt))}. Outro modelo? É só digitar.</p>
  `);
  const listbox = popover.querySelector('[role="listbox"]');

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "model-toggle";
  toggle.tabIndex = -1; // Keyboard users open the list with ↓ from the field.
  toggle.setAttribute("aria-label", "Mostrar modelos");
  render(toggle, icon("chevron", { strokeWidth: 2.5 }));

  field.append(input, toggle, popover);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", listbox.id);
  input.setAttribute("aria-expanded", "false");
  input.autocomplete = "off";
  toggle.setAttribute("aria-controls", listbox.id);
  toggle.setAttribute("aria-expanded", "false");

  let options = [];
  let activeIndex = -1;
  let announceTimer;

  const isOpen = () => popover.matches(":popover-open");

  function renderOptions(query) {
    let index = 0;
    const groups = providers
      .map(({ name, models }) => ({ name, models: models.filter((model) => matchesAllTerms(`${name} ${model}`, query)) }))
      .filter(({ models }) => models.length > 0);

    render(listbox, html`${groups.map(({ name, models }, groupIndex) => html`
      <li role="group" aria-labelledby="model-group-${groupIndex}">
        <span id="model-group-${groupIndex}" class="model-group-label">${name}</span>
        <ul role="none">
          ${models.map((model) => html`
            <li id="model-option-${index++}" class="model-option" role="option" aria-selected="false"
                data-value="${model}">${model}</li>
          `)}
        </ul>
      </li>
    `)}`);
    options = [...listbox.querySelectorAll('[role="option"]')];
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    return options.length;
  }

  function open(query = "") {
    const count = renderOptions(query);
    if (count === 0) {
      close();
      return;
    }
    if (!isOpen()) popover.showPopover();
    input.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-expanded", "true");
    position();
    listbox.scrollTop = 0;

    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => announce(count === 1 ? "1 modelo sugerido" : `${count} modelos sugeridos`), ANNOUNCE_DELAY);
  }

  function close() {
    clearTimeout(announceTimer);
    if (isOpen()) popover.hidePopover();
    input.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }

  // The popover sits in the top layer, so it escapes the form's rounded, clipped group.
  // Below the row by default; above it when there's clearly more room there.
  function position() {
    const row = field.closest(".field-row").getBoundingClientRect();
    const spaceBelow = window.innerHeight - row.bottom - VIEWPORT_MARGIN;
    const spaceAbove = row.top - VIEWPORT_MARGIN;
    const placeAbove = spaceBelow < MIN_LIST_HEIGHT && spaceAbove > spaceBelow;

    popover.style.left = `${row.left}px`;
    popover.style.width = `${row.width}px`;
    popover.style.setProperty("--available-height", `${Math.max(placeAbove ? spaceAbove : spaceBelow, 0)}px`);
    popover.style.top = placeAbove ? "auto" : `${row.bottom + 4}px`;
    popover.style.bottom = placeAbove ? `${window.innerHeight - row.top + 4}px` : "auto";
  }

  function setActive(index) {
    options[activeIndex]?.setAttribute("aria-selected", "false");
    activeIndex = index;
    const option = options[index];
    option.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({ block: "nearest" });
  }

  function choose(option) {
    input.value = option.dataset.value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    close();
    input.focus();
  }

  input.addEventListener("input", () => open(input.value.trim()));

  input.addEventListener("keydown", (event) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];

    if (step && event.altKey) {
      event.preventDefault();
      if (step > 0) open();
      else close();
    } else if (step) {
      event.preventDefault();
      if (!isOpen()) {
        open();
        if (options.length > 0) setActive(step > 0 ? 0 : options.length - 1);
      } else {
        setActive((activeIndex + step + options.length) % options.length);
      }
    } else if (event.key === "Enter" && isOpen() && activeIndex >= 0) {
      // Picks the highlighted model instead of submitting the form.
      event.preventDefault();
      choose(options[activeIndex]);
    } else if (event.key === "Escape" && isOpen()) {
      event.preventDefault();
      close();
    }
  });

  input.addEventListener("blur", close);

  // Pointer presses on the list or the toggle must not blur the field, or the list would close first.
  for (const element of [popover, toggle]) {
    element.addEventListener("pointerdown", (event) => event.preventDefault());
  }

  toggle.addEventListener("click", () => {
    if (isOpen()) {
      close();
    } else {
      input.focus();
      open();
    }
  });

  listbox.addEventListener("click", (event) => {
    const option = event.target.closest('[role="option"]');
    if (option) choose(option);
  });

  window.addEventListener("resize", () => isOpen() && position());
  window.addEventListener("scroll", () => isOpen() && position(), { capture: true, passive: true });
  input.form.addEventListener("reset", close);
}
