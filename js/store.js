// The prompt library: an in-memory Map mirrored to localStorage.
// Every change is written to storage first, so a failed write (quota,
// private mode) throws before memory and the UI drift out of sync.

import { parseStoredPrompts, touch } from "./prompt-model.js";
import { ALL_NOTEBOOKS } from "./notebooks.js";

const STORAGE_KEY = "prompt-vault-prompts";

const prompts = new Map();
const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadPrompts() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return;

  let parsed;
  try {
    parsed = parseStoredPrompts(stored);
  } catch (error) {
    // The next save would overwrite the unreadable data, so keep a copy first.
    const backupKey = `${STORAGE_KEY}-backup-${Date.now()}`;
    localStorage.setItem(backupKey, stored);
    throw new Error(`Dados ilegíveis copiados para "${backupKey}".`, { cause: error });
  }

  const { prompts: loaded, upgraded } = parsed;
  if (upgraded) {
    commit(loaded);
  } else {
    replaceInMemory(loaded);
    notify();
  }
}

export function getPrompt(id) {
  return prompts.get(id);
}

/** Newest first, optionally narrowed to one notebook. */
export function listPrompts(notebook = ALL_NOTEBOOKS) {
  return [...prompts.values()]
    .filter((prompt) => notebook === ALL_NOTEBOOKS || prompt.notebook === notebook)
    .sort((a, b) => Date.parse(b.metadata.createdAt) - Date.parse(a.metadata.createdAt));
}

export function countByNotebook() {
  const counts = new Map([[ALL_NOTEBOOKS, prompts.size]]);
  for (const { notebook } of prompts.values()) {
    counts.set(notebook, (counts.get(notebook) ?? 0) + 1);
  }
  return counts;
}

export function addPrompts(newPrompts) {
  commit([...newPrompts, ...prompts.values()]);
}

export function updatePrompt(id, change) {
  commit([...prompts.values()].map((prompt) => (prompt.id === id ? touch(change(prompt)) : prompt)));
}

export function deletePrompt(id) {
  commit([...prompts.values()].filter((prompt) => prompt.id !== id));
}

function commit(nextPrompts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPrompts));
  replaceInMemory(nextPrompts);
  notify();
}

function replaceInMemory(nextPrompts) {
  prompts.clear();
  for (const prompt of nextPrompts) prompts.set(prompt.id, prompt);
}

function notify() {
  for (const listener of listeners) listener();
}
