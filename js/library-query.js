// Filter and sort for the prompt library. Pure: no DOM or storage access, so it runs under node:test.
import { matchesAllTerms } from "./text-search.js";

export const SORT_ORDERS = Object.freeze(["recent", "rating", "title"]);

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

export function isSortOrder(value) {
  return SORT_ORDERS.includes(value);
}

function byNewest(x, y) {
  return Date.parse(y.metadata.createdAt) - Date.parse(x.metadata.createdAt);
}

function byRating(x, y) {
  if (x.rating === null && y.rating === null) return byNewest(x, y);
  if (x.rating === null) return 1;
  if (y.rating === null) return -1;
  return y.rating - x.rating || byNewest(x, y);
}

function byTitle(x, y) {
  return collator.compare(x.title, y.title);
}

const COMPARATORS = { recent: byNewest, rating: byRating, title: byTitle };

function searchableText(prompt) {
  return [prompt.title, prompt.metadata.model, prompt.content, ...prompt.notes.map((note) => note.content)].join("\n");
}

/** Prompts matching `query` (accent-insensitive, all terms), sorted by `sort`. Returns a new array. */
export function queryLibrary(prompts, { query, sort }) {
  if (!isSortOrder(sort)) throw new RangeError(`Ordem desconhecida: ${sort}`);
  return prompts.filter((prompt) => matchesAllTerms(searchableText(prompt), query)).sort(COMPARATORS[sort]);
}
