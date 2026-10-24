export async function copyText(text) {
  // The Clipboard API only exists in secure contexts (https:// or localhost).
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard API indisponível: abra o app em https:// ou localhost.");
  }
  await navigator.clipboard.writeText(text);
}
