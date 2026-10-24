// Live hints for the four parts of a well-formed prompt. Matches are whole
// words in pt-BR or English; they suggest, they don't grade.

import { html, render } from "./html.js";
import { icon } from "./icons.js";
import { estimateTokens } from "./prompt-model.js";
import { formatTokenRange } from "./format.js";

function wordPattern(words) {
  return new RegExp(`(?<!\\p{L})(?:${words.join("|")})(?!\\p{L})`, "iu");
}

const PROMPT_CHECKS = [
  {
    label: "Papel",
    pattern: wordPattern(["você é", "atue como", "aja como", "seja um", "seja uma", "you are", "act as"]),
    tip: "Diga quem o modelo deve ser. Ex.: “Você é um editor sênior”.",
  },
  {
    label: "Contexto",
    pattern: wordPattern(["contexto", "cenário", "público", "objetivo", "para que", "context", "audience", "goal"]),
    tip: "Explique o objetivo e para quem é a resposta.",
  },
  {
    label: "Formato",
    pattern: wordPattern(["formato", "tópicos", "lista", "tabela", "json", "markdown", "parágrafos?", "palavras", "format", "bullet points"]),
    tip: "Peça um formato de resposta: lista, tabela, JSON, número de palavras…",
  },
  {
    label: "Exemplo",
    pattern: wordPattern(["exemplos?", "ex\\.", "por exemplo", "examples?"]),
    tip: "Mostre um exemplo do resultado que você espera.",
  },
];

const ALL_PASSED_TIP = "Papel, contexto, formato e exemplo: tudo aqui.";

export function renderCheckup(container, content, isCode) {
  container.hidden = !content.trim();
  if (container.hidden) return;

  const results = PROMPT_CHECKS.map((check) => ({ ...check, passed: check.pattern.test(content) }));
  const firstMissing = results.find(({ passed }) => !passed);

  render(container.querySelector(".checkup-list"), html`${results.map(checkupItem)}`);
  container.querySelector(".checkup-tip").textContent = firstMissing?.tip ?? ALL_PASSED_TIP;
  container.querySelector(".checkup-tokens").textContent =
    `≈ ${formatTokenRange(estimateTokens(content, isCode))} tokens`;
}

function checkupItem({ label, passed }) {
  return html`
    <li class="checkup-item ${passed && "is-passed"}">
      ${passed && icon("check", { strokeWidth: 3 })}
      <span>${label}</span><span class="visually-hidden">: ${passed ? "presente" : "ausente"}</span>
    </li>`;
}
