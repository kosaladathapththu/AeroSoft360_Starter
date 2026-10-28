import { useEffect, useState } from "react";
import { financeRequest } from "./finance-utils";

export default function GlobalSearchRecords({
  api,
  token,
  query,
  open,
}: {
  api: string;
  token: string;
  query: string;
  open: (page: string, query: string) => void;
}) {
  const [state, setState] = useState<{
    query: string;
    rows: any[];
    error: string;
    loading: boolean;
  }>({ query: "", rows: [], error: "", loading: false });
  useEffect(() => {
    let active = true;
    setState({ query, rows: [], error: "", loading: true });
    const timer = window.setTimeout(() => {
      financeRequest(api, token, `search?q=${encodeURIComponent(query)}`)
        .then((result) => {
          if (active) setState({ query, rows: result.results, error: "", loading: false });
        })
        .catch((error) => {
          if (active) setState({ query, rows: [], error: error.message, loading: false });
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [api, token, query]);
  return (
    <div>
      <p>Business records · up to 5 per type</p>
      {state.query !== query || state.loading ? (
        <p role="status">Searching records…</p>
      ) : state.error ? (
        <p role="alert">{state.error}</p>
      ) : state.rows.length ? (
        state.rows.map((row) => (
          <button key={`${row.page}-${row.id}`} onClick={() => open(row.page, row.query)}>
            <b>{row.label}</b>
            <small>
              {row.page}
              {row.description ? ` · ${row.description}` : ""}
            </small>
          </button>
        ))
      ) : (
        <p>No matching records.</p>
      )}
    </div>
  );
}
