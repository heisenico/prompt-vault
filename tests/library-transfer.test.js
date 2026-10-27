import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeLibrary, parseLibraryFile, partitionImport, exportFileName, importSummary } from "../js/library-transfer.js";
import { promptFixture } from "./fixtures.js";

test("export then import round-trips", () => {
  const prompts = [promptFixture({ id: "a" }), promptFixture({ id: "b" })];
  assert.deepEqual(parseLibraryFile(serializeLibrary(prompts, "2026-10-26T12:00:00.000Z")), prompts);
});

test("serialized envelope is pretty JSON with app, version and timestamp", () => {
  const text = serializeLibrary([], "2026-10-26T12:00:00.000Z");
  assert.deepEqual(JSON.parse(text), { app: "prompt-vault", version: 1, exportedAt: "2026-10-26T12:00:00.000Z", prompts: [] });
  assert.match(text, /\n  "app"/);
});

test("bare legacy array without metadata is upgraded", () => {
  const legacy = JSON.stringify([{ id: "x", title: "Antigo", content: "texto" }]);
  const [prompt] = parseLibraryFile(legacy);
  assert.equal(prompt.metadata.model, "Não informado");
});

test("unrecognized JSON is rejected with a pt-BR message", () => {
  assert.throws(() => parseLibraryFile('{"foo":1}'), /Arquivo não reconhecido/);
  assert.throws(() => parseLibraryFile("not json"), /Arquivo não reconhecido/);
});

test("invalid JSON keeps the parse error as cause", () => {
  assert.throws(() => parseLibraryFile("not json"), (error) => error.cause instanceof SyntaxError);
});

test("validation errors are reworded for imports and keep the original as cause", () => {
  assert.throws(
    () => parseLibraryFile('[{"id":1}]'),
    (error) => /^Arquivo não reconhecido: /.test(error.message) && !/salvo/.test(error.message) && error.cause instanceof Error,
  );
});

test("importSummary pluralises in pt-BR", () => {
  assert.equal(importSummary(0, 3), "0 importados, 3 já existiam");
  assert.equal(importSummary(1, 2), "1 importado, 2 já existiam");
  assert.equal(importSummary(2, 1), "2 importados, 1 já existia");
});

test("importing the same prompts twice adds nothing", () => {
  const prompts = [promptFixture({ id: "a" }), promptFixture({ id: "b" })];
  assert.deepEqual(partitionImport(prompts, prompts), { fresh: [], duplicates: 2 });
  assert.deepEqual(partitionImport([prompts[0]], prompts), { fresh: [prompts[1]], duplicates: 1 });
});

test("repeated ids inside the incoming file count as duplicates", () => {
  const a = promptFixture({ id: "a" });
  const a2 = promptFixture({ id: "a", title: "Outro" });
  assert.deepEqual(partitionImport([], [a, a2]), { fresh: [a], duplicates: 1 });
});

test("file name uses the local date", () => {
  assert.equal(exportFileName(new Date(2026, 9, 26, 23, 30)), "prompt-vault-2026-10-26.json");
  assert.equal(exportFileName(new Date(2026, 0, 5, 1, 0)), "prompt-vault-2026-01-05.json");
});
