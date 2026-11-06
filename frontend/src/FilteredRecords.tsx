import { ReactNode, useId, useState } from "react";
import { Download, Filter, RotateCcw, Search, X } from "lucide-react";
import { financeCsv, financeToday } from "./finance-utils";
import { dateRangePreset, filterRecords, recordFields, RecordCondition, RecordField } from "./record-filters";
import "./record-filters.css";
import { displayReferenceValue } from "./representative-reference";

type Props<T> = {
  records: T[];
  fields?: RecordField[];
  title?: string;
  customerSearch?: boolean;
  children: (rows: T[], active: boolean) => ReactNode;
};

/** Filters source records before rendering, so row actions keep the original IDs and values. */
export default function FilteredRecords<T extends Record<string, any>>({
  records,
  fields: configuredFields,
  title = "records",
  customerSearch = false,
  children,
}: Props<T>) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [conditions, setConditions] = useState<RecordCondition[]>([]);
  const fields = configuredFields || recordFields(records);
  const dateFields = fields.filter((field) => field.kind === "date");
  const [dateKey, setDateKey] = useState("");
  const selectedDate = dateFields.find((field) => field.key === dateKey) || dateFields[0];
  const quickText = ["customer_name", "supplier_name", "rep_name", "status", "sale_type", "is_opening_balance"].map((key) => fields.find((field) => field.key === key)).filter(Boolean) as RecordField[];
  const amountField = fields.find((field) => field.key === "outstanding") || fields.find((field) => field.key === "total" && field.kind === "number");
  const quickKeys = new Set([...quickText.map((field) => field.key), ...(selectedDate ? [selectedDate.key] : []), ...(amountField ? [amountField.key] : [])]);
  const conditionFor = (key: string) => conditions.find((condition) => condition.key === key) || {key, value: "", from: "", to: ""};
  const quickPatch = (key: string, update: Partial<RecordCondition>) => setConditions((current) => {
    const next = { ...(current.find((condition) => condition.key === key) || { key, value: "", from: "", to: "" }), ...update };
    return [...current.filter((condition) => condition.key !== key), ...(next.value || next.from || next.to ? [next] : [])];
  });
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
          {customerSearch && <label className="invoice-customer-search" htmlFor={`${id}-customer`}>
            Customer
            <input id={`${id}-customer`} type="search" list={`${id}-customer-names`} placeholder="Search customer name…"
              value={conditionFor("customer_name").value.replace(/^=/, "")}
              onChange={(event) => quickPatch("customer_name", { value: event.target.value })} />
            <datalist id={`${id}-customer-names`}>{Array.from(new Set(records.map((row) => String(row.customer_name || "")).filter(Boolean))).sort().map((name) => <option key={name} value={name} />)}</datalist>
          </label>}
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
          <button type="button" aria-expanded={expanded} aria-controls={`${id}-options`} onClick={() => setExpanded((value) => !value)}>
            <Filter aria-hidden="true" /> {expanded ? "Hide filters" : "Filters"}{conditions.filter((c) => c.value || c.from || c.to).length > 0 && <span className="record-filter-badge">{conditions.filter((c) => c.value || c.from || c.to).length}</span>}
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
                ...rows.map((row) => fields.map((f) => displayReferenceValue(row[f.key], row, f.key))),
              ])
            }
          >
            <Download aria-hidden="true" /> Download matching rows
          </button>
        </div>
        <div id={`${id}-options`} className="record-filter-options" hidden={!expanded}>
        {(selectedDate || quickText.length > 0 || amountField) && <div className="record-quick-filters">
          {selectedDate && <div className="record-date-range">
            <label>Date field<select value={selectedDate.key} onChange={(event) => setDateKey(event.target.value)}>{dateFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select></label>
            <label>From date<input type="date" value={conditionFor(selectedDate.key).from} max={conditionFor(selectedDate.key).to || undefined} onChange={(event) => quickPatch(selectedDate.key, {value: "", from: event.target.value})} /></label>
            <label>To date<input type="date" value={conditionFor(selectedDate.key).to} min={conditionFor(selectedDate.key).from || undefined} onChange={(event) => quickPatch(selectedDate.key, {value: "", to: event.target.value})} /></label>
            <label>Date shortcut<select value="" onChange={(event) => quickPatch(selectedDate.key, event.target.value === "missing" ? {value: "__blank__", from: "", to: ""} : {value: "", ...dateRangePreset(event.target.value, financeToday())})}>
              <option value="">Choose dates...</option><option value="all">All dates</option><option value="today">Today</option><option value="last7">Last 7 days</option><option value="last30">Last 30 days</option><option value="month">This month</option><option value="previousMonth">Previous month</option><option value="year">This year</option><option value="missing">Date not set</option>
            </select></label>
          </div>}
          <div className="record-quick-values">{quickText.map((field) => {
            const choices = [...new Set(records.map((row) => row[field.key]).filter((value) => value != null && value !== "").map(String))].sort((a,b) => a.localeCompare(b));
            const categorical = ["status", "sale_type", "is_opening_balance"].includes(field.key);
            return <label key={field.key}>{field.key === "rep_name" ? "Salesperson" : field.key === "is_opening_balance" ? "Document source" : field.label}
              {categorical ? <select value={conditionFor(field.key).value} onChange={(event) => quickPatch(field.key, {value: event.target.value})}><option value="">All</option><option value="__blank__">Not set</option>{choices.map((choice) => <option key={choice} value={`=${choice}`}>{field.key === "is_opening_balance" ? (["1", "true"].includes(choice) ? "Opening balances" : "Sales invoices") : choice.replace(/_/g, " ")}</option>)}</select> : <><input type="search" list={`${id}-${field.key}`} placeholder={`All ${field.key === "rep_name" ? "salespeople" : field.label.toLowerCase()}`} value={conditionFor(field.key).value.replace(/^=/, "")} onChange={(event) => quickPatch(field.key, {value: choices.includes(event.target.value) ? `=${event.target.value}` : event.target.value})} /><datalist id={`${id}-${field.key}`}>{choices.map((choice) => <option key={choice} value={choice} />)}</datalist></>}
            </label>;
          })}
          {amountField && <><label>{amountField.label} minimum<input type="number" step="any" value={conditionFor(amountField.key).from} onChange={(event) => quickPatch(amountField.key, {value: "", from: event.target.value})} placeholder="No minimum" /></label><label>{amountField.label} maximum<input type="number" step="any" value={conditionFor(amountField.key).to} onChange={(event) => quickPatch(amountField.key, {value: "", to: event.target.value})} placeholder="No maximum" /></label></>}
          </div>
          <small>Filters combine. Date boundaries are inclusive. Use Add filter for additional fields.</small>
        </div>}
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

        {conditions.map((condition, index) => {
          if (quickKeys.has(condition.key) && !(condition.value === "__blank__" && condition.key === amountField?.key)) return null;
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
        </div>
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
