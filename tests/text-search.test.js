import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, matchesAllTerms } from "../js/text-search.js";

test("normalize strips accents and case", () => {
  assert.equal(normalize("Gêmini AÇÃO"), "gemini acao");
});

test("every term must match, in any order", () => {
  assert.equal(matchesAllTerms("Anthropic Claude Opus 5.5", "opus  claude"), true);
  assert.equal(matchesAllTerms("Anthropic Claude Opus 5.5", "opus gpt"), false);
});

test("blank query matches everything", () => {
  assert.equal(matchesAllTerms("qualquer coisa", "   "), true);
});

test("regex characters match literally", () => {
  assert.equal(matchesAllTerms("Templates em C++", "c++"), true);
  assert.equal(matchesAllTerms("abc", "a.c"), false);
  assert.doesNotThrow(() => matchesAllTerms("x", "(["));
});
