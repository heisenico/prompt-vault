// Export and import of the whole library as a JSON file. Pure: no DOM or storage access.

import { parseStoredPrompts } from "./prompt-model.js";

const APP_ID = "prompt-vault";
const FORMAT_VERSION = 1;

export function serializeLibrary(prompts, exportedAt) {
  return JSON.stringify({ app: APP_ID, version: FORMAT_VERSION, exportedAt, prompts }, null, 2);
}

/** Accepts the export envelope or a bare array of prompts (the stored format). */
export function parseLibraryFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Arquivo não reconhecido: o conteúdo não é JSON.", { cause: error });
  }

  const list = Array.isArray(data) ? data : data?.app === APP_ID ? data.prompts : undefined;
  if (!Array.isArray(list)) {
    throw new Error("Arquivo não reconhecido: não é uma biblioteca do Prompt Vault.");
  }
  return parseStoredPrompts(JSON.stringify(list)).prompts;
}

/** Splits incoming prompts into new ones and ones whose id is already in the library. */
export function partitionImport(existing, incoming) {
  const knownIds = new Set(existing.map(({ id }) => id));
  const fresh = incoming.filter(({ id }) => !knownIds.has(id));
  return { fresh, duplicates: incoming.length - fresh.length };
}

export function exportFileName(date) {
  const pad = (number) => String(number).padStart(2, "0");
  return `prompt-vault-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
