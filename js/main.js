import * as store from "./store.js";
import { createNote, createPrompt } from "./prompt-model.js";
import { renderLibrary } from "./library-view.js";
import { renderCheckup } from "./checkup.js";
import { initPromptViewer } from "./prompt-viewer.js";
import { initComposer } from "./composer.js";
import { initModelCombobox } from "./model-combobox.js";
import { copyText } from "./clipboard.js";
import { announce, clearError, showError, STORAGE_HINT } from "./feedback.js";
import { formatList } from "./format.js";
import { exportFileName, importSummary, parseLibraryFile, partitionImport, serializeLibrary } from "./library-transfer.js";

const SAMPLE_PROMPTS_URL = new URL("../data/sample-prompts.json", import.meta.url);
const COPY_RESET_DELAY = 1600;

const form = document.querySelector("#prompt-form");
const checkup = document.querySelector("#prompt-checkup");
const promptList = document.querySelector("#prompt-list");
const promptCount = document.querySelector("#prompt-count");
const libraryTitle = document.querySelector("#library-title");
const exportButton = document.querySelector('[data-transfer="export"]');
const importInput = document.querySelector('[data-transfer="import"]');
const transferStatus = document.querySelector('[data-transfer="status"]');

/** UI state that isn't part of the stored library. */
const view = {
  editingNoteId: null,
  confirmingDeleteId: null,
  newPromptId: null,
  /** Unsent "Nova nota" text per prompt id, so re-renders never lose typing. */
  noteDrafts: new Map(),
  /** Unsaved text of the note being edited, so re-rendering its card keeps the typing. */
  noteEditDraft: null,
};

const composer = initComposer(form, {
  panel: document.querySelector("#composer"),
  toggle: document.querySelector("#composer-toggle"),
  onSubmit: savePrompt,
  onFill: updateCheckup,
});

const viewer = initPromptViewer(document.querySelector("#prompt-viewer"), {
  getPrompt: store.getPrompt,
  getTrigger: (promptId) => findInCard(promptId, '[data-action="open"]'),
});

// ---------- Rendering ----------

function renderApp() {
  const prompts = store.listPrompts();
  renderLibrary(promptList, prompts, view);
  promptCount.textContent = prompts.length;
  if (prompts.length === 0 && composer.editingId() === null) composer.open({ focus: false });
  exportButton.disabled = prompts.length === 0;
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

function findMissingFields({ title, model, content }) {
  return [
    [title, "o título", "#prompt-title"],
    [model, "o modelo", "#prompt-model"],
    [content, "o prompt", "#prompt-content"],
  ].filter(([value]) => !value);
}

/** Validates and stores the composer's fields; returns true when the prompt was saved. */
function savePrompt(fields) {
  const missing = findMissingFields(fields);
  if (missing.length > 0) {
    showError(`Preencha ${formatList(missing.map(([, label]) => label))} para salvar.`);
    document.querySelector(missing[0][2]).focus();
    return false;
  }

  const prompt = createPrompt(fields);
  view.newPromptId = prompt.id;
  const saved = attempt(() => store.addPrompts([prompt]), "Não foi possível salvar o prompt.");
  if (saved) announce(`“${fields.title}” salvo na biblioteca`);
  return saved;
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
    const { noteId } = control.closest("[data-note-id]").dataset;
    if (view.noteEditDraft?.noteId !== noteId) view.noteEditDraft = null;
    view.editingNoteId = noteId;
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
    // The store notifies synchronously, so clear the draft before writing; restore it if the write fails.
    const typed = noteForm.elements.note.value;
    view.noteDrafts.delete(promptId);
    const added = attempt(
      () => store.updatePrompt(promptId, (prompt) => ({ ...prompt, notes: [...prompt.notes, createNote(content)] })),
      "Não foi possível salvar a nota.",
    );
    if (!added) view.noteDrafts.set(promptId, typed);
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
    // The store notifies synchronously, so leave edit mode before writing; restore it if the write fails.
    const draft = view.noteEditDraft;
    view.editingNoteId = null;
    view.noteEditDraft = null;
    const saved = attempt(
      () => store.updatePrompt(promptId, (prompt) => ({
        ...prompt,
        notes: prompt.notes.map((note) => (note.id === noteId ? { ...note, content } : note)),
      })),
      "Não foi possível salvar a edição.",
    );
    if (saved) {
      findInCard(promptId, `[data-note-id="${CSS.escape(noteId)}"] [data-action="edit-note"]`).focus();
    } else {
      view.editingNoteId = noteId;
      view.noteEditDraft = draft;
    }
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
  view.noteEditDraft = null;
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

function handleLibraryInput(event) {
  const { target } = event;
  if (target.matches(".note-edit-form textarea")) {
    view.noteEditDraft = { noteId: target.closest("[data-note-id]").dataset.noteId, text: target.value };
  } else if (target.matches(".note-form textarea")) {
    const promptId = target.closest("[data-prompt-id]").dataset.promptId;
    if (target.value) view.noteDrafts.set(promptId, target.value);
    else view.noteDrafts.delete(promptId);
  }
}

function handleLibrarySubmit(event) {
  event.preventDefault();
  const noteForm = event.target;
  const promptId = noteForm.closest("[data-prompt-id]").dataset.promptId;
  formActions[noteForm.dataset.action](promptId, noteForm);
}

// ---------- Export and import ----------

function exportLibrary() {
  const now = new Date();
  const json = serializeLibrary(store.listPrompts(), now.toISOString());
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(now);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  announce("Biblioteca exportada");
}

async function importLibrary() {
  const [file] = importInput.files;
  if (!file) return;
  transferStatus.textContent = "";
  try {
    const incoming = parseLibraryFile(await file.text());
    const { fresh, duplicates } = partitionImport(store.listPrompts(), incoming);
    if (fresh.length > 0 && !attempt(() => store.addPrompts(fresh), "Não foi possível importar.")) {
      // attempt() already reported to the library column and the console; repeat it where the user is looking.
      transferStatus.textContent = `Não foi possível importar. ${STORAGE_HINT}`;
      return;
    }
    // The footer status is a role="status" region, so this is announced as well as shown.
    transferStatus.textContent = importSummary(fresh.length, duplicates);
  } catch (error) {
    transferStatus.textContent = error.message;
    console.error("Falha ao importar biblioteca:", error);
  } finally {
    // Clearing the value lets the same file be chosen again.
    importInput.value = "";
  }
}

// ---------- Start ----------

form.elements.content.addEventListener("input", updateCheckup);
form.elements.isCode.addEventListener("change", updateCheckup);
promptList.addEventListener("click", handleLibraryClick);
promptList.addEventListener("input", handleLibraryInput);
promptList.addEventListener("submit", handleLibrarySubmit);
promptList.addEventListener("keydown", handleLibraryKeydown);
exportButton.addEventListener("click", exportLibrary);
importInput.addEventListener("change", importLibrary);
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
