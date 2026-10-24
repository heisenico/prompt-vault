// The full-view panel. Built on a native modal <dialog>, which already
// provides the dialog role, a focus trap, an inert background and the
// Escape key. This module adds the animated exit, click-outside dismissal,
// prev/next navigation, copy feedback and focus return.

import { copyText } from "./clipboard.js";
import { countCharacters, formatDate, formatNumber, formatTokenRange } from "./format.js";

const COPY_RESET_DELAY = 2000;
const ARROW_STEPS = new Map([
  ["ArrowLeft", -1],
  ["ArrowRight", 1],
]);

/**
 * @param {HTMLDialogElement} dialog
 * @param {object} library
 * @param {(id: string) => object} library.getPrompt
 * @param {(id: string) => HTMLElement | null} library.getTrigger  the card button that opens a prompt
 */
export function initPromptViewer(dialog, { getPrompt, getTrigger }) {
  const panel = dialog.querySelector(".viewer-panel");
  const swappables = dialog.querySelectorAll(".viewer-swap");
  const field = (name) => dialog.querySelector(`[data-field="${name}"]`);
  const copyButton = dialog.querySelector('[data-viewer-action="copy"]');

  let sequence = [];
  let currentId = null;
  let openedFrom = null;
  let copyResetTimer;

  // ---------- Opening and showing ----------

  function open(promptId, { trigger, sequence: promptIds }) {
    sequence = promptIds;
    openedFrom = trigger;
    show(promptId);
    dialog.showModal();
  }

  function show(promptId) {
    const { title, content, isCode, metadata } = getPrompt(promptId);
    currentId = promptId;

    field("title").textContent = title;
    field("model").textContent = metadata.model;
    field("content").textContent = content;
    field("content").classList.toggle("is-code", isCode);
    field("tokens").textContent = `≈ ${formatTokenRange(metadata.tokenEstimate)}`;
    field("characters").textContent = formatNumber(countCharacters(content));
    field("created").textContent = formatDate(metadata.createdAt);
    field("created").dateTime = metadata.createdAt;
    field("position").textContent = positionLabel();
    field("stepper").hidden = sequence.length < 2;
    field("body").scrollTop = 0;
    resetCopyButton();
  }

  function positionLabel() {
    return `${sequence.indexOf(currentId) + 1} de ${sequence.length}`;
  }

  // ---------- Navigating between prompts ----------

  function step(direction) {
    if (sequence.length < 2) return;
    const index = sequence.indexOf(currentId);
    const nextIndex = (index + direction + sequence.length) % sequence.length;

    panel.dataset.direction = direction > 0 ? "next" : "previous";
    show(sequence[nextIndex]);
    swappables.forEach((element) => replayAnimation(element, "is-swapping"));
    announce(`${getPrompt(currentId).title}, ${positionLabel()}`);
  }

  // ---------- Copying ----------

  async function copyCurrentPrompt() {
    clearTimeout(copyResetTimer);
    try {
      await copyText(getPrompt(currentId).content);
      setCopyState("copied", "Copiado!");
      announce("Prompt copiado para a área de transferência.");
    } catch (error) {
      console.error("Falha ao copiar prompt:", error);
      setCopyState("error", "Não deu para copiar");
      announce("O navegador bloqueou a cópia. Selecione o texto e copie manualmente.");
    }
    copyResetTimer = setTimeout(resetCopyButton, COPY_RESET_DELAY);
  }

  function setCopyState(state, label) {
    copyButton.dataset.state = state;
    field("copy-label").textContent = label;
  }

  function resetCopyButton() {
    clearTimeout(copyResetTimer);
    setCopyState("idle", "Copiar prompt");
  }

  function announce(message) {
    field("status").textContent = message;
  }

  // ---------- Closing ----------

  /** Plays the CSS exit animation, then actually closes the dialog. */
  async function close() {
    if (!dialog.open || dialog.classList.contains("is-closing")) return;

    dialog.classList.add("is-closing");
    // getAnimations() flushes styles, so it already sees the exit animation.
    // allSettled: an animation cancelled mid-way still lets the dialog close.
    await Promise.allSettled(panel.getAnimations().map((animation) => animation.finished));
    dialog.close();
    dialog.classList.remove("is-closing");
  }

  function returnFocus() {
    clearTimeout(copyResetTimer);
    announce("");
    // Prefer the card of the prompt last shown, which may differ after prev/next.
    const target = getTrigger(currentId) ?? openedFrom;
    target?.focus();
  }

  // ---------- Events ----------

  const actions = {
    close,
    copy: copyCurrentPrompt,
    previous: () => step(-1),
    next: () => step(1),
  };

  dialog.addEventListener("click", (event) => {
    const control = event.target.closest("[data-viewer-action]");
    if (control) actions[control.dataset.viewerAction]();
  });

  // A press that starts and ends on the dialog itself (not the panel) is a
  // click outside. Checking both ends ignores text drags that leave the panel.
  let pressStartedOutside = false;
  dialog.addEventListener("pointerdown", (event) => {
    pressStartedOutside = event.target === dialog;
  });
  dialog.addEventListener("click", (event) => {
    if (pressStartedOutside && event.target === dialog) close();
  });

  // Escape fires `cancel`. Take it over to animate the exit; if the browser
  // marks it non-cancelable (repeated Escape), let it close immediately.
  dialog.addEventListener("cancel", (event) => {
    if (!event.cancelable) return;
    event.preventDefault();
    close();
  });

  dialog.addEventListener("keydown", (event) => {
    const direction = ARROW_STEPS.get(event.key);
    if (!direction || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    step(direction);
  });

  dialog.addEventListener("close", returnFocus);

  return { open };
}

function replayAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth; // force a reflow so re-adding the class restarts the animation
  element.classList.add(className);
}
