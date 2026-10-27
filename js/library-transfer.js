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
  try {
    return parseStoredPrompts(JSON.stringify(list)).prompts;
  } catch (error) {
    // parseStoredPrompts words its errors for localStorage ("salvo"); an import file isn't that.
    const reason = error.message.replace(/^Prompt salvo inválido: /, "");
    throw new Error(`Arquivo não reconhecido: ${reason}`, { cause: error });
  }
}

/** "1 importado, 2 já existiam" */
export function importSummary(added, duplicates) {
  const imported = added === 1 ? "importado" : "importados";
  const existed = duplicates === 1 ? "já existia" : "já existiam";
  return `${added} ${imported}, ${duplicates} ${existed}`;
}

/** Splits incoming prompts into new ones and duplicates: ids already in the library or repeated within the file. */
export function partitionImport(existing, incoming) {
  const knownIds = new Set(existing.map(({ id }) => id));
  const fresh = [];
  for (const prompt of incoming) {
    if (knownIds.has(prompt.id)) continue;
    knownIds.add(prompt.id);
    fresh.push(prompt);
  }
  return { fresh, duplicates: incoming.length - fresh.length };
}

export function exportFileName(date) {
  const pad = (number) => String(number).padStart(2, "0");
  return `prompt-vault-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
