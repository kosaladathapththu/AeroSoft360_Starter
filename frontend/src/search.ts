// Match every search word, ignoring punctuation and spacing in names and document codes.
export function searchWords(value: string): string[] {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) || []
  );
}

export function matchesSearch(record: unknown, query: string): boolean {
  const words = searchWords(query);
  if (!words.length) return true;
  const values = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.map(values).join(" ");
    if (typeof value === "object") return Object.values(value).map(values).join(" ");
    return String(value);
  };
  const text = searchWords(values(record)).join(" ");
  return words.every((word) => text.includes(word));
}
