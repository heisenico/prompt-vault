import * as store from "./store.js";
import { createNote, createPrompt, revisePrompt } from "./prompt-model.js";
import { renderLibrary } from "./library-view.js";
import { isSortOrder, queryLibrary } from "./library-query.js";
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
const SORT_KEY = "prompt-vault-sort";
const DEFAULT_SORT = "recent";
const RESULT_ANNOUNCE_DELAY = 400;

const form = document.querySelector("#prompt-form");
const checkup = document.querySelector("#prompt-checkup");
const promptList = document.querySelector("#prompt-list");
const promptCount = document.querySelector("#prompt-count");
const libraryTitle = document.querySelector("#library-title");
const exportButton = document.querySelector('[data-transfer="export"]');
const importInput = document.querySelector('[data-transfer="import"]');
const transferStatus = document.querySelector('[data-transfer="status"]');
const searchInput = document.querySelector("#library-search");
const sortSelect = document.querySelector("#library-sort");
const promptViewer = document.querySelector("#prompt-viewer");

/** An unreadable or unknown stored sort falls back to "recent", and says so in the console. */
function readStoredSort() {
  try {
    const stored = localStorage.getItem(SORT_KEY);
    if (stored === null) return DEFAULT_SORT;
    if (isSortOrder(stored)) return stored;
    console.error(`Ordenação salva inválida (${JSON.stringify(stored)}); usando "${DEFAULT_SORT}".`);
  } catch (error) {
    console.error("Falha ao ler a ordenação salva:", error);
  }
  return DEFAULT_SORT;
}

/** UI state that isn't part of the stored library. */
const view = {
  query: "",
  sort: readStoredSort(),
  editingNoteId: null,
  confirmingDeleteId: null,
  newPromptId: null,
  /** Unsent "Nova nota" text per prompt id, so re-renders never lose typing. */
  noteDrafts: new Map(),
  /** Unsaved text of the note being edited, so re-rendering its card keeps the typing. */
  noteEditDraft: null,
  /** Ids of cards whose "Avaliar e anotar" is open, kept in step by handleLibraryToggle. Never part of a card's signature. */
  expandedIds: new Set(),
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

/** The prompts the library currently shows, in order. */
function visiblePrompts(all = store.listPrompts()) {
  return queryLibrary(all, view);
}

function renderApp() {
  const all = store.listPrompts();
  renderLibrary(promptList, visiblePrompts(all), view, { total: all.length });
  promptCount.textContent = all.length;
  if (all.length === 0 && composer.editingId() === null) composer.open({ focus: false });
  exportButton.disabled = all.length === 0;
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

/** Reports and focuses the first missing field; returns true when all are present. */
function hasRequiredFields(fields) {
  const missing = findMissingFields(fields);
  if (missing.length === 0) return true;
  showError(`Preencha ${formatList(missing.map(([, label]) => label))} para salvar.`);
  document.querySelector(missing[0][2]).focus();
  return false;
}

/** Builds a prompt, reporting validation errors (not as storage failures); returns null when invalid. */
function build(make) {
  try {
    return make();
  } catch (error) {
    showError(error.message);
    console.error("Prompt inválido:", error);
    return null;
  }
}

/**
 * Saves the composer's fields as a new prompt, or as an edit of `editingId`.
 * Returns false on failure, else `{ focus }` for the composer to focus (null = its toggle).
 */
function savePrompt(fields, editingId) {
  if (!hasRequiredFields(fields)) return false;
  if (editingId) return saveEdit(editingId, fields);

  const prompt = build(() => createPrompt(fields));
  if (!prompt) return false;
  view.newPromptId = prompt.id;
  // The store notifies synchronously, so clear the search first or the new prompt could be filtered out.
  const previousQuery = view.query;
  clearSearch({ render: false });
  const saved = attempt(() => store.addPrompts([prompt]), "Não foi possível salvar o prompt.");
  if (!saved) {
    view.query = previousQuery;
    searchInput.value = previousQuery;
  }
  if (!saved) return false;
  announce(`“${fields.title}” salvo na biblioteca`);
  return { focus: null };
}

/** An edit keeps the active search, so the edited card may no longer match it. */
function saveEdit(promptId, fields) {
  const revised = build(() => revisePrompt(store.getPrompt(promptId), fields));
  if (!revised) return false;
  const saved = attempt(
    () => store.updatePrompt(promptId, () => revised),
    "Não foi possível salvar as alterações.",
  );
  if (!saved) return false;

  const card = findInCard(promptId, '[data-action="copy"]');
  announce(card ? `“${fields.title}” atualizado` : `“${fields.title}” atualizado. Ele não aparece na busca atual.`);
  return { focus: card ?? searchInput };
}

function updateCheckup() {
  renderCheckup(checkup, form.elements.content.value, form.elements.isCode.checked);
}

// ---------- Card actions ----------

const cardActions = {
  open(promptId, control) {
    const sequence = visiblePrompts().map(({ id }) => id);
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

  "edit-prompt"(promptId) {
    composer.edit(store.getPrompt(promptId));
  },

  // Deleting is two steps: the "Excluir prompt" button asks, and only the confirm button deletes.
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
    view.expandedIds.delete(promptId);
    const ids =store.listPrompts().map(({ id }) => id);
    const neighbourId = ids[ids.indexOf(promptId) + 1] ?? ids[ids.indexOf(promptId) - 1];

    if (!attempt(() => store.deletePrompt(promptId), "Não foi possível excluir o prompt.")) return;
    announce(`“${title}” excluído`);
    if (promptId === composer.editingId()) {
      // Back to "Novo prompt" with its saved draft; reset() leaves the panel open, so close it
      // unless the library is now empty (an empty library shows the composer open).
      composer.reset();
      if (store.listPrompts().length > 0) composer.close();
    }
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

  "clear-search"() {
    clearSearch();
    searchInput.focus();
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

/** `toggle` doesn't bubble, so this is registered in the capture phase. No re-render: the DOM already matches. */
function handleLibraryToggle(event) {
  if (!event.target.matches("details.card-more")) return;
  const promptId = event.target.closest("[data-prompt-id]").dataset.promptId;
  if (event.target.open) {
    view.expandedIds.add(promptId);
    return;
  }
  view.expandedIds.delete(promptId);
  // Closing hides a pending delete confirmation or note edit; drop that state so it can't
  // be orphaned behind a closed <details> (and force it open on a later render).
  const editingHere = store.getPrompt(promptId)?.notes.some((note) => note.id === view.editingNoteId);
  if (view.confirmingDeleteId !== promptId && !editingHere) return;
  if (view.confirmingDeleteId === promptId) view.confirmingDeleteId = null;
  if (editingHere) {
    view.editingNoteId = null;
    view.noteEditDraft = null;
  }
  renderApp();
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

// ---------- Search and sort ----------

let resultsTimer = null;

function clearSearch({ render = true } = {}) {
  view.query = "";
  searchInput.value = "";
  clearTimeout(resultsTimer);
  if (render) renderApp();
}

/** Debounced, so typing doesn't queue a stream of announcements. */
function announceResults() {
  clearTimeout(resultsTimer);
  if (!view.query.trim()) return;
  resultsTimer = setTimeout(() => {
    announce(`${visiblePrompts().length} de ${store.listPrompts().length} prompts`);
  }, RESULT_ANNOUNCE_DELAY);
}

function handleSearchInput() {
  view.query = searchInput.value;
  renderApp();
  announceResults();
}

function handleSearchKeydown(event) {
  if (event.key === "Escape" && searchInput.value !== "") {
    event.preventDefault();
    clearSearch();
  }
}

function handleSortChange() {
  const { value } = sortSelect;
  if (!isSortOrder(value)) throw new RangeError(`Ordenação desconhecida: ${value}`);
  view.sort = value;
  try {
    localStorage.setItem(SORT_KEY, value);
  } catch (error) {
    console.error("Falha ao salvar a ordenação:", error);
  }
  renderApp();
  announceResults();
}

/** "/" focuses the search unless the user is typing somewhere or a dialog is open. */
function handleShortcutKeydown(event) {
  if (event.key !== "/" || event.defaultPrevented) return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  if (event.target.closest("input, textarea, select, [contenteditable]")) return;
  if (promptViewer.open) return;
  event.preventDefault();
  searchInput.focus();
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
promptList.addEventListener("toggle", handleLibraryToggle, true);
promptList.addEventListener("click", handleLibraryClick);
promptList.addEventListener("input", handleLibraryInput);
promptList.addEventListener("submit", handleLibrarySubmit);
promptList.addEventListener("keydown", handleLibraryKeydown);
searchInput.addEventListener("input", handleSearchInput);
searchInput.addEventListener("keydown", handleSearchKeydown);
sortSelect.addEventListener("change", handleSortChange);
document.addEventListener("keydown", handleShortcutKeydown);
sortSelect.value = view.sort;
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
