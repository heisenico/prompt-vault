const announcer = document.querySelector("#announcer");
const statusMessage = document.querySelector("#status-message");

export const STORAGE_HINT = "O armazenamento do navegador pode estar cheio ou bloqueado.";

/** Speaks a message to screen readers without changing anything visible. */
export function announce(message) {
  announcer.textContent = "";
  // Clearing first and writing on the next frame makes repeated messages re-announce.
  requestAnimationFrame(() => {
    announcer.textContent = message;
  });
}

export function showError(message) {
  statusMessage.textContent = message;
}

export function clearError() {
  statusMessage.textContent = "";
}
