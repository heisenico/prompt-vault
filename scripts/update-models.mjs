// Refreshes data/models.json, the bundled list behind the model combobox.
// The app itself never touches the network for this; run the script by hand:
//
//   node scripts/update-models.mjs
//
// Source: OpenRouter's public model index (no API key needed).

import { writeFile } from "node:fs/promises";

const SOURCE_URL = "https://openrouter.ai/api/v1/models";
const OUTPUT = new URL("../data/models.json", import.meta.url);
const MODELS_PER_PROVIDER = 6;

// OpenRouter id prefix → label shown in the combobox, in display order.
const PROVIDERS = new Map([
  ["openai", "OpenAI"],
  ["anthropic", "Anthropic"],
  ["google", "Google"],
  ["x-ai", "xAI"],
  ["meta", "Meta"],
  ["deepseek", "DeepSeek"],
  ["mistralai", "Mistral"],
  ["qwen", "Qwen"],
  ["moonshotai", "Moonshot AI"],
  ["z-ai", "Z.ai"],
]);

// Skips aliases (~openai/…), variants (…:batch, …:free) and models that don't read and write text.
function isChatModel({ id, architecture }) {
  return (
    !id.startsWith("~") &&
    !id.includes(":") &&
    architecture.input_modalities.includes("text") &&
    architecture.output_modalities.includes("text")
  );
}

// "OpenAI: GPT-6.1 Terra" → "GPT-6.1 Terra"
const displayName = (name) => name.replace(/^[^:]+:\s*/, "");

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`${SOURCE_URL} respondeu HTTP ${response.status}`);
const { data } = await response.json();

const newestFirst = data.filter(isChatModel).sort((a, b) => b.created - a.created);

const providers = [...PROVIDERS].map(([prefix, name]) => {
  const names = newestFirst.filter(({ id }) => id.startsWith(`${prefix}/`)).map((model) => displayName(model.name));
  return { name, models: [...new Set(names)].slice(0, MODELS_PER_PROVIDER) };
});

const empty = providers.filter(({ models }) => models.length === 0).map(({ name }) => name);
if (empty.length > 0) throw new Error(`Nenhum modelo encontrado para: ${empty.join(", ")}`);

const snapshot = {
  source: SOURCE_URL,
  updatedAt: new Date().toLocaleDateString("sv-SE"), // Local YYYY-MM-DD; toISOString would give the UTC day.
  providers,
};

await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`data/models.json: ${providers.reduce((sum, { models }) => sum + models.length, 0)} modelos de ${providers.length} provedores`);
