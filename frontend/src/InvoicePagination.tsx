import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./invoice-pagination.css";

/** Paginate the filtered invoices; exports continue to use the full selection. */
export default function InvoicePagination<T extends { id?: number | string }>({ records, enabled, children }: {
  records: T[]; enabled: boolean; children: (rows: T[]) => ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const selection = records.map((row) => row.id).join(",");
  useEffect(() => setPage(1), [selection, pageSize]);
  useLayoutEffect(() => {
    if (!enabled || !container.current) return;
    const measure = () => {
      const top = container.current!.getBoundingClientRect().top + window.scrollY;
      const rowHeight = Math.max(68, ...Array.from(container.current!.querySelectorAll("tbody tr")).map((row) => row.getBoundingClientRect().height));
      // Fit actual row heights, the table header and navigation into the viewport.
      setPageSize(window.innerWidth < 900 ? 5 : Math.max(1, Math.min(20, Math.floor((window.innerHeight - top - 115) / rowHeight))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.querySelector(".content") || container.current);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [enabled]);
  if (!enabled) return <>{children(records)}</>;
  const pages = Math.max(1, Math.ceil(records.length / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  return <div className="invoice-paginated-list" ref={container}>
    {children(records.slice(start, start + pageSize))}
    <nav className="invoice-pagination" aria-label="Invoice pages">
      <span>{records.length ? `${start + 1}–${Math.min(start + pageSize, records.length)}` : "0"} of {records.length} invoices</span>
      <div>
        <button type="button" disabled={current === 1} onClick={() => setPage(1)} aria-label="First invoice page">First</button>
        <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button>
        <label>Page <select aria-label="Invoice page" value={current} onChange={(event) => setPage(Number(event.target.value))}>
          {Array.from({ length: pages }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
        </select> of {pages}</label>
        <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button>
        <button type="button" disabled={current === pages} onClick={() => setPage(pages)} aria-label="Last invoice page">Last</button>
      </div>
    </nav>
  </div>;
}
