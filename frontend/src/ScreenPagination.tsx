import { ReactNode, useEffect, useRef, useState } from "react";
import "./screen-pagination.css";

/** Screen-only pagination. Render the full filtered data so report aggregates,
 * exports and print output never accidentally use only the visible page. */
export default function ScreenPagination({ children, selection, title }: {
  children: ReactNode; selection: string; title: string;
}) {
  const content = useRef<HTMLDivElement>(null);
  const groups = useRef<HTMLTableRowElement[][]>([]);
  const [count, setCount] = useState(0);
  const [limit, setLimit] = useState(5);
  const [page, setPage] = useState(1);
  const current = Math.min(page, Math.max(1, Math.ceil(count / limit)));
  const offset = (current - 1) * limit;

  useEffect(() => setPage(1), [selection]);
  useEffect(() => {
    const root = content.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      // A nested record list owns its own pagination; only paginate this table.
      const table = Array.from(root.querySelectorAll("table")).find((item) =>
        item.closest(".screen-record-page") === root.parentElement);
      if (!table || !table.tBodies.length) { groups.current = []; setCount(0); return; }
      const next: HTMLTableRowElement[][] = [];
      for (const row of Array.from(table.tBodies[0].rows)) {
        row.removeAttribute("data-screen-page-hidden");
        if (row.matches(".report-totals, [data-pagination-summary]")) continue;
        const isDetail = row.cells.length === 1 && row.cells[0].colSpan > 1;
        if (isDetail && next.length) next[next.length - 1].push(row);
        else if (!isDetail) next.push([row]);
      }
      groups.current = next;
      const rowHeight = Math.max(64, ...next.map((rows) => rows.reduce((height, row) => height + row.getBoundingClientRect().height, 0)));
      const top = table.getBoundingClientRect().top + window.scrollY;
      const header = table.tHead?.getBoundingClientRect().height || 44;
      const footer = (table.tFoot?.getBoundingClientRect().height || 0) + Array.from(table.querySelectorAll("tbody > .report-totals, tbody > [data-pagination-summary]")).reduce((height, row) => height + row.getBoundingClientRect().height, 0);
      const size = window.innerWidth < 900 ? 5 : Math.max(1, Math.min(20, Math.floor((window.innerHeight - top - header - footer - 80) / rowHeight)));
      setCount(next.length);
      setLimit(size);
      const safePage = Math.min(page, Math.max(1, Math.ceil(next.length / size)));
      next.forEach((rows, index) => rows.forEach((row) => {
        if (index < (safePage - 1) * size || index >= safePage * size) row.dataset.screenPageHidden = "true";
      }));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    schedule();
    const mutation = new MutationObserver(schedule);
    mutation.observe(root, { childList: true, subtree: true, characterData: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(root);
    const workspace = document.querySelector(".content");
    if (workspace) resize.observe(workspace);
    window.addEventListener("resize", schedule);
    return () => {
      mutation.disconnect(); resize.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      groups.current.forEach((rows) => rows.forEach((row) => row.removeAttribute("data-screen-page-hidden")));
    };
  }, [children, selection, page]);

  const pages = Math.max(1, Math.ceil(count / limit));
  return <div className="screen-record-page">
    <div ref={content}>{children}</div>
    {count > 0 && <nav className="screen-record-navigation" aria-label={`${title} pages`}>
      <span>{offset + 1}–{Math.min(offset + limit, count)} of {count} {title}</span>
      <div>
        <button type="button" disabled={current === 1} onClick={() => setPage(1)}>First</button>
        <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button>
        <label>Page <select aria-label={`${title} page`} value={current} onChange={(event) => setPage(Number(event.target.value))}>
          {Array.from({ length: pages }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
        </select> of {pages}</label>
        <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button>
        <button type="button" disabled={current === pages} onClick={() => setPage(pages)}>Last</button>
      </div>
    </nav>}
  </div>;
}
