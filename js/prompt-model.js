// What a prompt is: how one is created, estimated, timestamped, and how
// stored data is validated and upgraded from older versions of the app.

const MAX_MODEL_LENGTH = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);
const LEGACY_MODEL = "Não informado";

// ---------- Creating ----------

export function createPrompt({ title, model, content, isCode }) {
  assertModelName(model);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    content,
    isCode,
    rating: null,
    notes: [],
    metadata: {
      model: model.trim(),
      createdAt: now,
      updatedAt: now,
      tokenEstimate: estimateTokens(content, isCode),
    },
  };
}

export function createNote(content) {
  return { id: crypto.randomUUID(), content };
}

export function touch(prompt) {
  return { ...prompt, metadata: { ...prompt.metadata, updatedAt: new Date().toISOString() } };
}

/**
 * Brackets the token count between a word-based floor (~0.75 tokens/word)
 * and a character-based ceiling (~4 chars/token). Code tokenizes denser.
 */
export function estimateTokens(text, isCode = false) {
  const trimmed = text.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const characterCount = Array.from(text).length;
  const multiplier = isCode ? 1.3 : 1;
  const min = 0.75 * wordCount * multiplier;
  const max = 0.25 * characterCount * multiplier;
  return { min, max, confidence: confidenceFor((min + max) / 2) };
}

function confidenceFor(estimatedTokens) {
  if (estimatedTokens < 1000) return "high";
  if (estimatedTokens <= 5000) return "medium";
  return "low";
}

function assertModelName(model) {
  if (typeof model !== "string" || !model.trim()) {
    throw new Error("O nome do modelo deve ser um texto não vazio.");
  }
  if (model.length > MAX_MODEL_LENGTH) {
    throw new Error(`O nome do modelo deve ter no máximo ${MAX_MODEL_LENGTH} caracteres.`);
  }
}

// ---------- Reading stored data ----------

/**
 * Parses the stored JSON into prompts. Throws on anything malformed rather
 * than guessing, so corrupted data is reported instead of silently dropped.
 * `upgraded` is true when older records gained fields and should be re-saved.
 */
export function parseStoredPrompts(json) {
  const stored = JSON.parse(json);
  check(Array.isArray(stored), "os dados salvos não são uma lista");

  let upgraded = false;
  const prompts = stored.map((record) => {
    assertCoreFields(record);
    const prompt = upgradeRecord(record);
    if (Object.keys(prompt).length !== Object.keys(record).length) upgraded = true;
    assertValidPrompt(prompt);
    return prompt;
  });
  return { prompts, upgraded };
}

/** Fills fields added after the first version of the app. */
function upgradeRecord(record) {
  return {
    rating: null,
    notes: [],
    isCode: false,
    ...record,
    metadata: record.metadata ?? legacyMetadata(record.content),
  };
}

function legacyMetadata(content) {
  const now = new Date().toISOString();
  return { model: LEGACY_MODEL, createdAt: now, updatedAt: now, tokenEstimate: estimateTokens(content) };
}

function assertCoreFields(record) {
  check(record !== null && typeof record === "object", "registro não é um objeto");
  check(typeof record.id === "string", "id ausente");
  check(typeof record.title === "string", "título ausente");
  check(typeof record.content === "string", "conteúdo ausente");
}

function assertValidPrompt({ rating, notes, isCode, metadata }) {
  check(rating === null || (Number.isInteger(rating) && rating >= 1 && rating <= 5), "avaliação inválida");
  check(Array.isArray(notes), "notas não são uma lista");
  for (const note of notes) {
    check(typeof note?.id === "string" && typeof note.content === "string", "nota inválida");
  }
  check(typeof isCode === "boolean", "isCode inválido");
  assertValidMetadata(metadata);
}

function assertValidMetadata(metadata) {
  check(metadata !== null && typeof metadata === "object", "metadados ausentes");
  const { model, createdAt, updatedAt, tokenEstimate } = metadata;
  check(typeof model === "string" && model.trim() && model.length <= MAX_MODEL_LENGTH, "modelo inválido");
  check(isISODate(createdAt), "createdAt inválido");
  check(isISODate(updatedAt), "updatedAt inválido");
  check(Date.parse(updatedAt) >= Date.parse(createdAt), "updatedAt anterior a createdAt");
  check(
    Number.isFinite(tokenEstimate?.min) &&
      tokenEstimate.min >= 0 &&
      Number.isFinite(tokenEstimate.max) &&
      CONFIDENCE_LEVELS.has(tokenEstimate.confidence),
    "estimativa de tokens inválida",
  );
}

function isISODate(value) {
  return typeof value === "string" && ISO_DATE.test(value) && new Date(value).toISOString() === value;
}

function check(condition, problem) {
  if (!condition) throw new Error(`Prompt salvo inválido: ${problem}.`);
}
