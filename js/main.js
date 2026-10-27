import * as store from "./store.js";
import { createNote, createPrompt } from "./prompt-model.js";
import { renderLibrary } from "./library-view.js";
import { renderCheckup } from "./checkup.js";
import { initPromptViewer } from "./prompt-viewer.js";
import { initModelCombobox } from "./model-combobox.js";
import { copyText } from "./clipboard.js";
import { announce, clearError, showError, STORAGE_HINT } from "./feedback.js";
import { formatList } from "./format.js";

const SAMPLE_PROMPTS_URL = new URL("../data/sample-prompts.json", import.meta.url);
const COPY_RESET_DELAY = 1600;

const form = document.querySelector("#prompt-form");
const checkup = document.querySelector("#prompt-checkup");
const promptList = document.querySelector("#prompt-list");
const promptCount = document.querySelector("#prompt-count");
const libraryTitle = document.querySelector("#library-title");

/** UI state that isn't part of the stored library. */
const view = {
  editingNoteId: null,
  confirmingDeleteId: null,
  newPromptId: null,
};

const viewer = initPromptViewer(document.querySelector("#prompt-viewer"), {
  getPrompt: store.getPrompt,
  getTrigger: (promptId) => findInCard(promptId, '[data-action="open"]'),
});

// ---------- Rendering ----------

function renderApp() {
  const prompts = store.listPrompts();
  renderLibrary(promptList, prompts, view);
  promptCount.textContent = prompts.length;
  view.newPromptId = null;
}

function findInCard(promptId, selector) {
  return promptList.querySelector(`[data-prompt-id="${CSS.escape(promptId)}"] ${selector}`);
}

/** Runs a store change, reporting storage failures instead of losing them. */
function attempt(change, failureMessage) {
  try {
    change();
    clearError();
    return true;
  } catch (error) {
    showError(`${failureMessage} ${STORAGE_HINT}`);
    console.error(failureMessage, error);
    return false;
  }
}

// ---------- New prompt form ----------

function readForm() {
  const data = new FormData(form);
  return {
    title: data.get("title").trim(),
    model: data.get("model").trim(),
    content: data.get("content").trim(),
    isCode: data.has("isCode"),
  };
}

function findMissingFields({ title, model, content }) {
  return [
    [title, "o título", "#prompt-title"],
    [model, "o modelo", "#prompt-model"],
    [content, "o prompt", "#prompt-content"],
  ].filter(([value]) => !value);
}

function savePrompt(event) {
  event.preventDefault();
  const fields = readForm();

  const missing = findMissingFields(fields);
  if (missing.length > 0) {
    showError(`Preencha ${formatList(missing.map(([, label]) => label))} para salvar.`);
    document.querySelector(missing[0][2]).focus();
    return;
  }

  const prompt = createPrompt(fields);
  view.newPromptId = prompt.id;
  const saved = attempt(() => store.addPrompts([prompt]), "Não foi possível salvar o prompt.");
  if (!saved) return;

  form.reset();
  updateCheckup();
  announce(`“${fields.title}” salvo na biblioteca`);
  form.elements.title.focus();
}

function updateCheckup() {
  renderCheckup(checkup, form.elements.content.value, form.elements.isCode.checked);
}

// ---------- Card actions ----------

const cardActions = {
  open(promptId, control) {
    const sequence = store.listPrompts().map(({ id }) => id);
    viewer.open(promptId, { trigger: control, sequence });
  },

  async copy(promptId, control) {
    const { title, content } = store.getPrompt(promptId);
    try {
      await copyText(content);
    } catch (error) {
      showError("O navegador bloqueou a cópia. Permita o acesso à área de transferência e tente de novo.");
      console.error("Falha ao copiar prompt:", error);
      return;
    }
    clearError();
    announce(`“${title}” copiado`);
    control.dataset.state = "copied";
    setTimeout(() => (control.dataset.state = "idle"), COPY_RESET_DELAY);
  },

  // Deleting is two steps: the × button asks, and only the confirm button deletes.
  delete(promptId) {
    view.confirmingDeleteId = promptId;
    renderApp();
    findInCard(promptId, '[data-action="cancel-delete"]').focus();
  },

  "cancel-delete"(promptId) {
    stopConfirmingDelete(promptId);
  },

  "confirm-delete"(promptId) {
    const { title } = store.getPrompt(promptId);
    view.confirmingDeleteId = null;
    const ids = store.listPrompts().map(({ id }) => id);
    const neighbourId = ids[ids.indexOf(promptId) + 1] ?? ids[ids.indexOf(promptId) - 1];

    if (!attempt(() => store.deletePrompt(promptId), "Não foi possível excluir o prompt.")) return;
    announce(`“${title}” excluído`);
    // Focus would otherwise fall to <body>; move it to the next card or the heading.
    (neighbourId ? findInCard(neighbourId, '[data-action="open"]') : libraryTitle).focus();
  },

  rate(promptId, control) {
    setRating(promptId, Number(control.dataset.rating));
  },

  "edit-note"(promptId, control) {
    view.editingNoteId = control.closest("[data-note-id]").dataset.noteId;
    renderApp();
    findInCard(promptId, ".note-edit-form textarea").focus();
  },

  "cancel-note"(promptId) {
    stopEditingNote(promptId);
  },

  "delete-note"(promptId, control) {
    const { noteId } = control.closest("[data-note-id]").dataset;
    const deleted = attempt(
      () => store.updatePrompt(promptId, (prompt) => ({ ...prompt, notes: prompt.notes.filter((note) => note.id !== noteId) })),
      "Não foi possível excluir a nota.",
    );
    if (deleted) {
      announce("Nota excluída");
      findInCard(promptId, ".note-form textarea").focus();
    }
  },

  async "load-samples"() {
    try {
      const response = await fetch(SAMPLE_PROMPTS_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const samples = await response.json();
      if (!attempt(() => store.addPrompts(samples.map(createPrompt)), "Não foi possível salvar os exemplos.")) return;
      announce(`${samples.length} prompts de exemplo carregados`);
      libraryTitle.focus();
    } catch (error) {
      showError("Não foi possível carregar os exemplos. Sirva a pasta com um servidor local e tente de novo.");
      console.error("Falha ao carregar exemplos:", error);
    }
  },
};

const formActions = {
  "add-note"(promptId, noteForm) {
    const content = noteForm.elements.note.value.trim();
    if (!content) {
      showError("A nota está em branco. Escreva algo antes de adicionar.");
      noteForm.elements.note.focus();
      return;
    }
    const added = attempt(
      () => store.updatePrompt(promptId, (prompt) => ({ ...prompt, notes: [...prompt.notes, createNote(content)] })),
      "Não foi possível salvar a nota.",
    );
    if (added) {
      announce("Nota adicionada");
      findInCard(promptId, ".note-form textarea").focus();
    }
  },

  "save-note"(promptId, noteForm) {
    const content = noteForm.elements.note.value.trim();
    if (!content) {
      showError("A nota não pode ficar em branco. Escreva algo ou exclua a nota.");
      noteForm.elements.note.focus();
      return;
    }
    const { noteId } = noteForm.closest("[data-note-id]").dataset;
    view.editingNoteId = null;
    const saved = attempt(
      () => store.updatePrompt(promptId, (prompt) => ({
        ...prompt,
        notes: prompt.notes.map((note) => (note.id === noteId ? { ...note, content } : note)),
      })),
      "Não foi possível salvar a edição.",
    );
    if (saved) findInCard(promptId, `[data-note-id="${CSS.escape(noteId)}"] [data-action="edit-note"]`).focus();
  },
};

function setRating(promptId, rating) {
  const rated = attempt(
    () => store.updatePrompt(promptId, (prompt) => ({ ...prompt, rating })),
    "Não foi possível salvar a avaliação.",
  );
  if (rated) findInCard(promptId, `[data-rating="${rating}"]`).focus();
}

function stopEditingNote(promptId) {
  const noteId = view.editingNoteId;
  view.editingNoteId = null;
  renderApp();
  findInCard(promptId, `[data-note-id="${CSS.escape(noteId)}"] [data-action="edit-note"]`).focus();
}

const RATING_KEYS = new Map([
  ["ArrowRight", (rating) => Math.min(rating + 1, 5)],
  ["ArrowUp", (rating) => Math.min(rating + 1, 5)],
  ["ArrowLeft", (rating) => Math.max(rating - 1, 1)],
  ["ArrowDown", (rating) => Math.max(rating - 1, 1)],
  ["Home", () => 1],
  ["End", () => 5],
]);

function handleLibraryKeydown(event) {
  const promptId = event.target.closest("[data-prompt-id]")?.dataset.promptId;

  if (event.target.matches('[data-action="rate"]') && RATING_KEYS.has(event.key)) {
    event.preventDefault();
    setRating(promptId, RATING_KEYS.get(event.key)(Number(event.target.dataset.rating)));
  } else if (event.key === "Escape" && event.target.closest(".note-edit-form")) {
    stopEditingNote(promptId);
  } else if (event.key === "Escape" && event.target.closest(".delete-confirm")) {
    stopConfirmingDelete(promptId);
  }
}

function stopConfirmingDelete(promptId) {
  view.confirmingDeleteId = null;
  renderApp();
  findInCard(promptId, '[data-action="delete"]').focus();
}

function handleLibraryClick(event) {
  const control = event.target.closest("button[data-action]");
  if (!control) return;
  const promptId = control.closest("[data-prompt-id]")?.dataset.promptId;
  cardActions[control.dataset.action](promptId, control);
}

function handleLibrarySubmit(event) {
  event.preventDefault();
  const noteForm = event.target;
  const promptId = noteForm.closest("[data-prompt-id]").dataset.promptId;
  formActions[noteForm.dataset.action](promptId, noteForm);
}

// ---------- Start ----------

form.addEventListener("submit", savePrompt);
form.elements.content.addEventListener("input", updateCheckup);
form.elements.isCode.addEventListener("change", updateCheckup);
promptList.addEventListener("click", handleLibraryClick);
promptList.addEventListener("submit", handleLibrarySubmit);
promptList.addEventListener("keydown", handleLibraryKeydown);
store.subscribe(renderApp);

// Without the suggestion list the model field still works as plain text.
initModelCombobox(form.elements.model).catch((error) => {
  console.error("Falha ao carregar a lista de modelos:", error);
});

try {
  store.loadPrompts();
} catch (error) {
  showError(`Não foi possível ler os prompts salvos neste navegador. ${error.message}`);
  console.error("Falha ao carregar prompts:", error);
}
renderApp();
