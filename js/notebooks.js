// The two notebooks the library merges. Prompts saved before notebooks
// existed have `notebook: null` and only appear under "Todos".

export const ALL_NOTEBOOKS = "all";

export const NOTEBOOKS = new Map([
  ["pessoal", "Pessoal"],
  ["trabalho", "Trabalho"],
]);

export function notebookLabel(notebook) {
  return NOTEBOOKS.get(notebook) ?? "Sem caderno";
}

export function isNotebook(value) {
  return value === null || NOTEBOOKS.has(value);
}
