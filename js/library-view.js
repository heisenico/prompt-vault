// Markup for the library: prompt cards, their rating and notes, and the
// empty state. Controls carry `data-action`; main.js handles them by delegation.

import { html, render } from "./html.js";
import { icon } from "./icons.js";
import { CONFIDENCE_LABELS, formatDate, formatTokenRange, previewOf } from "./format.js";

const RATING_VALUES = [1, 2, 3, 4, 5];

export function renderLibrary(container, prompts, cardState) {
  const view = prompts.length
    ? html`<ul class="prompt-grid" role="list">${prompts.map((prompt) => promptCard(prompt, cardState))}</ul>`
    : emptyState();
  render(container, view);
}

function promptCard(prompt, { editingNoteId, confirmingDeleteId, newPromptId }) {
  const { id, title, content } = prompt;
  const titleId = `prompt-${id}-title`;
  return html`
    <li>
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
        ${notesSection(prompt, editingNoteId)}
      </article>
    </li>`;
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

function notesSection({ id, notes }, editingNoteId) {
  const headingId = `prompt-${id}-notes`;
  const inputId = `prompt-${id}-new-note`;
  return html`
    <section class="notes-section" aria-labelledby="${headingId}">
      <h4 class="notes-title" id="${headingId}">Notas</h4>
      ${notes.length > 0 && html`
        <ul class="notes-list" role="list">
          ${notes.map((note) => (note.id === editingNoteId ? noteEditor(note) : noteItem(note)))}
        </ul>`}
      <form class="note-form" data-action="add-note">
        <label class="note-input-label" for="${inputId}">Nova nota</label>
        <textarea class="note-input" id="${inputId}" name="note" rows="2" placeholder="O que funcionou? O que ajustar?"></textarea>
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

function noteEditor({ id, content }) {
  const inputId = `note-${id}-editor`;
  return html`
    <li class="note-item" data-note-id="${id}">
      <form class="note-edit-form" data-action="save-note">
        <label class="visually-hidden" for="${inputId}">Editar nota</label>
        <textarea class="note-input" id="${inputId}" name="note" rows="2" required>${content}</textarea>
        <div class="note-actions">
          <button class="text-button is-tinted" type="submit">Salvar</button>
          <button class="text-button" type="button" data-action="cancel-note">Cancelar</button>
        </div>
      </form>
    </li>`;
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
