const LOCALE = "pt-BR";

const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short" });
const listFormat = new Intl.ListFormat(LOCALE, { type: "conjunction" });
const numberFormat = new Intl.NumberFormat(LOCALE);

export const CONFIDENCE_LABELS = {
  high: "estimativa confiável",
  medium: "estimativa aproximada",
  low: "estimativa imprecisa",
};

export const formatDate = (isoDate) => dateFormat.format(new Date(isoDate));
export const formatList = (items) => listFormat.format(items);
export const formatNumber = (value) => numberFormat.format(value);

export function formatTokenRange({ min, max }) {
  const low = formatNumber(Math.round(Math.min(min, max)));
  const high = formatNumber(Math.round(Math.max(min, max)));
  return low === high ? low : `${low}–${high}`;
}

export function countCharacters(text) {
  return Array.from(text).length;
}

export function previewOf(text, wordLimit = 40) {
  const words = text.trim().split(/\s+/);
  return words.length > wordLimit ? `${words.slice(0, wordLimit).join(" ")}…` : words.join(" ");
}
