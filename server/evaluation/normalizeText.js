export function normalizeText(value = "") {
  return String(value)
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
