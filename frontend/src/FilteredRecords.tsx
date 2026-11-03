import { ReactNode, useId, useState } from "react";
import { Download, Filter, RotateCcw, Search, X } from "lucide-react";
import { financeCsv } from "./finance-utils";
import { filterRecords, recordFields, RecordCondition, RecordField } from "./record-filters";
import "./record-filters.css";

type Props<T> = {
  records: T[];
  fields?: RecordField[];
  title?: string;
  children: (rows: T[], active: boolean) => ReactNode;
};

/** Filters source records before rendering, so row actions keep the original IDs and values. */
export default function FilteredRecords<T extends Record<string, any>>({
  records,
  fields: configuredFields,
  title = "records",
  children,
}: Props<T>) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [conditions, setConditions] = useState<RecordCondition[]>([]);
  const fields = configuredFields || recordFields(records);
  const rows = filterRecords(records, query, conditions, fields);
  const active = Boolean(query.trim() || conditions.some((c) => c.value || c.from || c.to));
  const patch = (index: number, update: Partial<RecordCondition>) =>
    setConditions((current) =>
      current.map((condition, i) => (i === index ? { ...condition, ...update } : condition)),
    );
  return (
    <>
      <section className="record-filters" aria-label={`Search and filter ${title}`}>
        <div className="record-filter-main">
          <label className="record-search" htmlFor={`${id}-search`}>
            Search {title}
            <span>
              <Search aria-hidden="true" />
              <input
                id={`${id}-search`}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by any words, name or reference"
              />
            </span>
          </label>
          <button
            type="button"
            disabled={!fields.length || conditions.length >= fields.length}
            onClick={() =>
              setConditions((current) => [
                ...current,
                {
                  key: (fields.find((f) => !current.some((c) => c.key === f.key)) || fields[0]).key,
                  value: "",
                  from: "",
                  to: "",
                },
              ])
            }
          >
            <Filter aria-hidden="true" /> Add filter
          </button>
          <button
            type="button"
            disabled={!query && !conditions.length}
            onClick={() => {
              setQuery("");
              setConditions([]);
            }}
          >
            <RotateCcw aria-hidden="true" /> Reset
          </button>
          <button
            type="button"
            disabled={!rows.length || !fields.length}
            onClick={() =>
              financeCsv(`${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-filtered.csv`, [
                fields.map((f) => f.label),
                ...rows.map((row) => fields.map((f) => row[f.key])),
              ])
            }
          >
            <Download aria-hidden="true" /> Download matching rows
          </button>
        </div>
        {conditions.map((condition, index) => {
          const field = fields.find((f) => f.key === condition.key);
          const choices = [
            ...new Set(
              records
                .map((r) => r[condition.key])
                .filter((v) => v !== null && v !== undefined && v !== "")
                .map(String),
            ),
          ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
          return (
            <div className="record-filter-rule" key={index}>
              <label>
                Filter by
                <select
                  value={condition.key}
                  onChange={(event) =>
                    patch(index, { key: event.target.value, value: "", from: "", to: "" })
                  }
                >
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              {field?.kind === "date" || field?.kind === "number" ? (
                <>
                  <label className="record-filter-missing">
                    <span>Missing value</span>
                    <select
                      value={condition.value}
                      onChange={(event) =>
                        patch(index, { value: event.target.value, from: "", to: "" })
                      }
                    >
                      <option value="">Use range</option>
                      <option value="__blank__">Not set</option>
                    </select>
                  </label>
                  <label>
                    {field.kind === "date" ? "From date" : "Minimum"}
                    <input
                      type={field.kind === "date" ? "date" : "number"}
                      step="any"
                      disabled={condition.value === "__blank__"}
                      value={condition.from}
                      max={condition.to || undefined}
                      onChange={(event) => patch(index, { from: event.target.value })}
                    />
                  </label>
                  <label>
                    {field.kind === "date" ? "To date" : "Maximum"}
                    <input
                      type={field.kind === "date" ? "date" : "number"}
                      step="any"
                      disabled={condition.value === "__blank__"}
                      value={condition.to}
                      min={condition.from || undefined}
                      onChange={(event) => patch(index, { to: event.target.value })}
                    />
                  </label>
                </>
              ) : (
                <label>
                  Matching value
                  {choices.length <= 40 ? (
                    <select
                      value={condition.value}
                      onChange={(event) => patch(index, { value: event.target.value })}
                    >
                      <option value="">All values</option>
                      <option value="__blank__">Not set</option>
                      {choices.map((choice) => (
                        <option key={choice} value={`=${choice}`}>
                          {choice.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={condition.value}
                      placeholder="Type words to match"
                      onChange={(event) => patch(index, { value: event.target.value })}
                    />
                  )}
                </label>
              )}
              <button
                type="button"
                aria-label={`Remove ${field?.label || "field"} filter`}
                onClick={() => setConditions((current) => current.filter((_, i) => i !== index))}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          );
        })}
        <p role="status">
          Showing <strong>{rows.length}</strong> of <strong>{records.length}</strong> {title} in the
          current selection.
          {active &&
            " Matching rows are filtered below; page summaries and other exports retain their selected-period scope."}
        </p>
        {conditions.some(
          (c) =>
            c.from &&
            c.to &&
            (fields.find((f) => f.key === c.key)?.kind === "number"
              ? Number(c.from) > Number(c.to)
              : c.from > c.to),
        ) && <p role="alert">The start or minimum must not exceed the end or maximum.</p>}
      </section>
      {active && (
        <p className="record-filter-summary">
          <strong>Filtered {title}:</strong>{" "}
          {[
            query.trim() ? `Search: ${query.trim()}` : "",
            ...conditions.map((condition) => {
              const label = fields.find((field) => field.key === condition.key)?.label;
              if (!label) return "";
              if (condition.value === "__blank__") return `${label}: not set`;
              if (condition.value) return `${label}: ${condition.value.replace(/^=/, "")}`;
              if (condition.from || condition.to)
                return `${label}: ${condition.from || "any"} to ${condition.to || "any"}`;
              return "";
            }),
          ]
            .filter(Boolean)
            .join("; ")}
        </p>
      )}
      {children(rows, active)}
      {!rows.length && records.length > 0 && (
        <p className="record-filter-empty" role="status">
          No matching {title}. Change your search or reset the filters.
        </p>
      )}
    </>
  );
}
