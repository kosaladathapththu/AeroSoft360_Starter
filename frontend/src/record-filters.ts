import { matchesSearch } from "./search";

export type RecordField = { key: string; label: string; kind?: "text" | "number" | "date" };
export type RecordCondition = { key: string; value: string; from: string; to: string };

/** Inclusive calendar ranges; UTC is used only for arithmetic on date-only strings. */
export function dateRangePreset(preset: string, today: string): { from: string; to: string } {
  const date = new Date(`${today}T00:00:00Z`);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  const start = new Date(date);
  if (preset === "today") return { from: today, to: today };
  if (preset === "last7" || preset === "last30") {
    start.setUTCDate(start.getUTCDate() - (preset === "last7" ? 6 : 29));
    return { from: iso(start), to: today };
  }
  if (preset === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  if (preset === "previousMonth") {
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0));
    return { from: iso(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))), to: iso(end) };
  }
  return { from: "", to: "" };
}

const hiddenField = /(^id$|_id$|password|token|secret|created_at|updated_at|deleted_at)/i;
const dateField = /(^date$|_date$|_on$|_at$|period_start|period_end|valid_until)/;
const numericField =
  /amount|total|quantity|balance|outstanding|price|rate|salary|debit|credit|cost|pieces|received|issued|days|months|limit|value/;

export function recordFields(records: Record<string, unknown>[]): RecordField[] {
  const keys = [...new Set(records.flatMap((row) => Object.keys(row)))];
  return keys
    .filter(
      (key) =>
        !hiddenField.test(key) &&
        (records.some(
          (row) =>
            row[key] !== null &&
            row[key] !== undefined &&
            ["string", "number", "boolean"].includes(typeof row[key]),
        ) ||
          records.every((row) => row[key] === null || row[key] === undefined)),
    )
    .map((key) => {
      const values = records
        .map((row) => row[key])
        .filter((value) => value !== null && value !== "" && value !== undefined);
      const kind = dateField.test(key)
        ? "date"
        : numericField.test(key) && values.every((v) => Number.isFinite(Number(v)))
          ? "number"
          : "text";
      return { key, label: key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()), kind };
    });
}

// Compare date strings without constructing a Date: UTC conversion can shift a business day.
export function filterRecords<T extends Record<string, any>>(
  records: T[],
  query: string,
  conditions: RecordCondition[],
  fields: RecordField[],
): T[] {
  return records.filter(
    (row) =>
      matchesSearch(row, query) &&
      conditions.every((condition) => {
        const field = fields.find((candidate) => candidate.key === condition.key);
        if (!field) return true;
        const value = row[field.key];
        if (condition.value === "__blank__")
          return value === null || value === undefined || value === "";
        if (field.kind === "date" || field.kind === "number") {
          if (!condition.from && !condition.to) return true;
          if (value === null || value === undefined || value === "") return false;
          const compare = field.kind === "date" ? String(value).slice(0, 10) : Number(value);
          if (field.kind === "number" && !Number.isFinite(compare)) return false;
          return (
            (!condition.from ||
              compare >= (field.kind === "date" ? condition.from : Number(condition.from))) &&
            (!condition.to ||
              compare <= (field.kind === "date" ? condition.to : Number(condition.to)))
          );
        }
        if (!condition.value) return true;
        // Dropdown choices use an exact value; free text uses the same all-word search as the app.
        return condition.value.startsWith("=")
          ? String(value ?? "") === condition.value.slice(1)
          : matchesSearch(value, condition.value);
      }),
  );
}
