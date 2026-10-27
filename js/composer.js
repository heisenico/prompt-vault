const DRAFT_KEY = "prompt-vault-draft";
const DRAFT_DELAY = 300;

const HEADING = { create: "Novo prompt", edit: "Editar prompt" };
const SUBMIT_LABEL = { create: "Salvar prompt", edit: "Salvar alterações" };

/**
 * The collapsible "new prompt" form. It owns opening, closing, edit mode and the
 * saved draft; the caller supplies what saving means through `onSubmit`.
 *
 * `onSubmit(fields, editingId)` returns true once the save succeeded, and the
 * composer then clears the form and closes. `onFill` (optional) runs after the
 * composer fills or clears the fields itself, which fire no events.
 */
export function initComposer(form, { panel, toggle, onSubmit, onFill = () => {} }) {
  const heading = document.querySelector("#form-title");
  const submitButton = form.querySelector('[type="submit"]');
  const cancelButton = form.querySelector('[data-composer="cancel"]');
  let editingId = null;
  let draftTimer = null;

  function readFields() {
    const data = new FormData(form);
    return {
      title: data.get("title").trim(),
      model: data.get("model").trim(),
      content: data.get("content").trim(),
      isCode: data.has("isCode"),
    };
  }

  function fill({ title = "", model = "", content = "", isCode = false }) {
    form.elements.title.value = title;
    form.elements.model.value = model;
    form.elements.content.value = content;
    form.elements.isCode.checked = isCode;
    onFill();
  }

  function setMode(mode) {
    heading.textContent = HEADING[mode];
    submitButton.textContent = SUBMIT_LABEL[mode];
  }

  // ---------- Draft ----------

  function readDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const draft = JSON.parse(raw);
      if (draft === null || typeof draft !== "object" || Array.isArray(draft)) {
        throw new TypeError("O rascunho salvo não é um objeto.");
      }
      const text = (value) => (typeof value === "string" ? value : "");
      return {
        title: text(draft.title),
        model: text(draft.model),
        content: text(draft.content),
        isCode: draft.isCode === true,
      };
    } catch (error) {
      console.error("Não foi possível ler o rascunho salvo:", error);
      discardDraft();
      return null;
    }
  }

  function isBlank({ title, model, content, isCode }) {
    return !title.trim() && !model.trim() && !content.trim() && !isCode;
  }

  function writeDraft() {
    draftTimer = null;
    if (editingId) return;
    try {
      const fields = readFields();
      if (isBlank(fields)) {
        discardDraft();
        return;
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(fields));
    } catch (error) {
      console.error("Não foi possível salvar o rascunho:", error);
    }
  }

  function scheduleDraft() {
    if (editingId) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(writeDraft, DRAFT_DELAY);
  }

  function discardDraft() {
    clearTimeout(draftTimer);
    draftTimer = null;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      console.error("Não foi possível remover o rascunho:", error);
    }
  }

  function restoreDraft() {
    const draft = readDraft();
    if (!draft || isBlank(draft)) return false;
    fill(draft);
    return true;
  }

  // ---------- Panel ----------

  function open({ focus = true } = {}) {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    if (focus) form.elements.title.focus();
  }

  /** Back to an empty "new prompt" form, showing the saved draft again if there is one. */
  function reset() {
    editingId = null;
    setMode("create");
    fill({});
    restoreDraft();
  }

  function close() {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (editingId) reset();
  }

  function closeAndReturnFocus() {
    close();
    toggle.focus();
  }

  function edit(prompt) {
    // Keep what was typed in the last moments before the form is taken over.
    if (!editingId && draftTimer !== null) {
      clearTimeout(draftTimer);
      writeDraft();
    }
    editingId = prompt.id;
    setMode("edit");
    fill(prompt);
    open();
    panel.scrollIntoView({ block: "nearest" });
  }

  // ---------- Events ----------

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const id = editingId;
    if (!onSubmit(readFields(), id)) return;
    editingId = null;
    setMode("create");
    if (id === null) {
      discardDraft();
      fill({});
    } else {
      // The saved draft belongs to the "new prompt" form, so bring it back after an edit.
      fill({});
      restoreDraft();
    }
    closeAndReturnFocus();
  });

  form.addEventListener("input", scheduleDraft);
  // The model combobox sets its value programmatically and signals it with "change".
  form.addEventListener("change", scheduleDraft);

  form.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  panel.addEventListener("keydown", (event) => {
    // An open model list handles Escape itself and marks the event.
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    closeAndReturnFocus();
  });

  cancelButton.addEventListener("click", closeAndReturnFocus);

  toggle.addEventListener("click", () => {
    if (panel.hidden) open();
    else closeAndReturnFocus();
  });

  if (restoreDraft()) open({ focus: false });

  return { open, close, edit, reset, editingId: () => editingId };
}
