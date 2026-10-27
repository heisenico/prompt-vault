// Markup for the library: prompt cards, their rating and notes, and the
// empty state. Controls carry `data-action`; main.js handles them by delegation.

import { html, render } from "./html.js";
import { icon } from "./icons.js";
import { renderKeyedList } from "./keyed-render.js";
import { CONFIDENCE_LABELS, formatDate, formatTokenRange, previewOf } from "./format.js";

const RATING_VALUES = [1, 2, 3, 4, 5];

/**
 * One persistent <ul> is updated in place (see keyed-render.js) so cards that
 * didn't change keep their DOM, focus and unsaved note drafts. It is swapped
 * with the empty state only when the library goes empty <-> non-empty.
 */
export function renderLibrary(container, prompts, view, { total }) {
  if (prompts.length === 0) {
    render(container, total > 0 ? noResults(view.query) : emptyState());
    return;
  }
  let list = container.querySelector(":scope > ul.prompt-grid");
  if (!list) {
    render(container, html`<ul class="prompt-grid" role="list"></ul>`);
    list = container.firstElementChild;
  }
  renderKeyedList(list, libraryItems(prompts, view));
}

/**
 * What re-renders a card: stored data and card UI state. Drafts (new-note and note-edit) are left out on purpose.
 * Markup is built lazily: keyed-render calls `render()` only for cards it creates or replaces.
 * @returns {Array<{ key: string, signature: string, render: () => { markup: string } }>}
 */
export function libraryItems(prompts, view) {
  return prompts.map((prompt) => {
    const { id } = prompt;
    const editingNoteId = prompt.notes.some((note) => note.id === view.editingNoteId) ? view.editingNoteId : null;
    const confirmingDelete = view.confirmingDeleteId === id;
    const cardError = view.cardError?.promptId === id ? view.cardError.message : null;
    return {
      key: id,
      signature: JSON.stringify([prompt, editingNoteId, confirmingDelete, cardError]),
      render: () => promptCard(prompt, view),
    };
  });
}

function promptCard(prompt, { editingNoteId, confirmingDeleteId, newPromptId, noteDrafts, noteEditDraft }) {
  const { id, title, content } = prompt;
  const titleId = `prompt-${id}-title`;
  return html`
      <article class="prompt-card ${id === newPromptId && "is-new"}" data-prompt-id="${id}" aria-labelledby="${titleId}">
        <header class="card-header">
          <h3 class="card-title" id="${titleId}">${title}</h3>
          <div class="card-actions">
            <button class="icon-button copy-button" type="button" data-action="copy" data-state="idle" aria-label="Copiar ${title}" title="Copiar prompt">
              ${icon("copy", { className: "icon-idle" })}${icon("check", { strokeWidth: 2.5, className: "icon-done" })}
            </button>
            <button class="icon-button delete-button" type="button" data-action="delete" aria-label="Excluir ${title}" title="Excluir prompt">
              ${icon("xmark", { strokeWidth: 2.5 })}
            </button>
          </div>
        </header>
        ${id === confirmingDeleteId && deleteConfirmation(prompt)}
        <p class="prompt-preview">${previewOf(content)}</p>
        <button class="open-button" type="button" data-action="open" aria-haspopup="dialog">
          Ver completo<span class="visually-hidden">: ${title}</span>${icon("expand")}
        </button>
        ${metadataSection(prompt.metadata)}
        ${ratingGroup(prompt)}
        ${notesSection(prompt, editingNoteId, noteDrafts.get(id) ?? "", noteEditDraft)}
      </article>`;
}

function deleteConfirmation({ id, title }) {
  const messageId = `prompt-${id}-delete-message`;
  return html`
    <div class="delete-confirm" role="group" aria-labelledby="${messageId}">
      <p id="${messageId}">Excluir “${title}”? Isso não pode ser desfeito.</p>
      <div class="delete-confirm-actions">
        <button class="text-button" type="button" data-action="cancel-delete">Cancelar</button>
        <button class="danger-button" type="button" data-action="confirm-delete">Excluir</button>
      </div>
    </div>`;
}

function metadataSection({ model, createdAt, updatedAt, tokenEstimate }) {
  const range = formatTokenRange(tokenEstimate);
  const confidence = CONFIDENCE_LABELS[tokenEstimate.confidence];
  return html`
    <section class="metadata-section" aria-label="Detalhes do prompt">
      <p class="metadata-model">Modelo: ${model}</p>
      <div class="metadata-timestamps">
        <p>Criado em <time datetime="${createdAt}">${formatDate(createdAt)}</time></p>
        ${updatedAt !== createdAt && html`<p>Editado em <time datetime="${updatedAt}">${formatDate(updatedAt)}</time></p>`}
      </div>
      <p class="token-estimate confidence-${tokenEstimate.confidence}">
        <span aria-hidden="true">≈ ${range} tokens · ${confidence}</span>
        <span class="visually-hidden">Cerca de ${range.replace("–", " a ")} tokens, ${confidence}</span>
      </p>
    </section>`;
}

/** Radio semantics: one tab stop, arrow keys move (and save) the rating. */
function ratingGroup({ title, rating }) {
  const tabStop = rating ?? 1;
  return html`
    <div class="prompt-rating">
      <span class="rating-label" aria-hidden="true">${rating ? `${rating} de 5 estrelas` : "Avalie"}</span>
      <div class="rating-stars" role="radiogroup" aria-label="Avaliação de ${title}">
        ${RATING_VALUES.map(
          (value) => html`
            <button class="rating-star ${rating && value <= rating && "is-selected"}" type="button" role="radio"
              data-action="rate" data-rating="${value}" aria-checked="${value === rating}"
              aria-label="${value} ${value === 1 ? "estrela" : "estrelas"}" tabindex="${value === tabStop ? 0 : -1}">★</button>`,
        )}
      </div>
    </div>`;
}

function notesSection({ id, notes }, editingNoteId, draft, noteEditDraft) {
  const headingId = `prompt-${id}-notes`;
  const inputId = `prompt-${id}-new-note`;
  return html`
    <section class="notes-section" aria-labelledby="${headingId}">
      <h4 class="notes-title" id="${headingId}">Notas</h4>
      ${notes.length > 0 && html`
        <ul class="notes-list" role="list">
          ${notes.map((note) => (note.id === editingNoteId ? noteEditor(note, noteEditDraft) : noteItem(note)))}
        </ul>`}
      <form class="note-form" data-action="add-note">
        <label class="note-input-label" for="${inputId}">Nova nota</label>
        <textarea class="note-input" id="${inputId}" name="note" rows="2" placeholder="O que funcionou? O que ajustar?">
${draft}</textarea>
        <button class="text-button is-tinted" type="submit">Adicionar nota</button>
      </form>
    </section>`;
}

function noteItem({ id, content }) {
  const contentId = `note-${id}-content`;
  return html`
    <li class="note-item" data-note-id="${id}">
      <p class="note-content" id="${contentId}">${content}</p>
      <div class="note-actions">
        <button class="text-button" type="button" data-action="edit-note" aria-describedby="${contentId}">Editar</button>
        <button class="text-button is-danger" type="button" data-action="delete-note" aria-describedby="${contentId}">Excluir</button>
      </div>
    </li>`;
}

/** The first newline after <textarea> is dropped by the parser, so one is always emitted to keep a leading one in the text. */
function noteEditor({ id, content }, noteEditDraft) {
  const inputId = `note-${id}-editor`;
  const text = noteEditDraft?.noteId === id ? noteEditDraft.text : content;
  return html`
    <li class="note-item" data-note-id="${id}">
      <form class="note-edit-form" data-action="save-note">
        <label class="visually-hidden" for="${inputId}">Editar nota</label>
        <textarea class="note-input" id="${inputId}" name="note" rows="2" required>
${text}</textarea>
        <div class="note-actions">
          <button class="text-button is-tinted" type="submit">Salvar</button>
          <button class="text-button" type="button" data-action="cancel-note">Cancelar</button>
        </div>
      </form>
    </li>`;
}

/** Shown when the library has prompts but none match the search. */
export function noResults(query) {
  return html`
    <div class="empty-state">
      ${icon("search", { strokeWidth: 1.5 })}
      <h3>Nada encontrado para “${query}”.</h3>
      <button class="text-button is-tinted" type="button" data-action="clear-search">Limpar busca</button>
    </div>`;
}

function emptyState() {
  return html`
    <div class="empty-state">
      ${icon("tray", { strokeWidth: 1.5 })}
      <h3>Nenhum prompt ainda</h3>
      <p>Salve um prompt que funcionou bem e ele aparece aqui, pronto para copiar.</p>
      <button class="text-button is-tinted" type="button" data-action="load-samples">Carregar exemplos</button>
    </div>`;
}
