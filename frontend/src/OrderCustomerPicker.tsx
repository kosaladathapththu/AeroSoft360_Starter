import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { matchesSearch } from "./search";
import { displayCode } from "./representative-reference";
import "./order-customer-picker.css";

export default function OrderCustomerPicker({ customers, selectedId, select, help = "Choose a customer to see balances and pending orders." }: {
  customers: any[]; selectedId: number; select: (id: number) => void; help?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const selected = customers.find((row) => Number(row.id) === selectedId);
  const [query, setQuery] = useState(selected?.name || "");
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = customers.filter((row) => matchesSearch([row.name, row.code, displayCode(row), row.phone], filter));
  const options = matches.slice(0, 80);
  useEffect(() => {
    input.current?.setCustomValidity(selectedId ? "" : "Choose a customer from the list.");
  }, [selectedId, query]);
  useEffect(() => { if (selectedId) setQuery(selected?.name || ""); }, [selectedId, selected?.name]);
  const choose = (row: any) => {
    select(Number(row.id)); setQuery(row.name); setFilter(""); setOpen(false); setActive(0);
  };
  return <div className="easy-customer-picker customer-dropdown" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <label htmlFor={id}>Customer</label>
    <div className="customer-dropdown-control">
      <Search size={18} aria-hidden="true" />
      <input id={id} ref={input} type="text" value={query} required autoComplete="off" spellCheck={false}
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
        aria-activedescendant={open && options[active] ? `${id}-option-${active}` : undefined}
        placeholder="Search customer name, code or phone"
        onFocus={(event) => { setOpen(true); setFilter(""); setActive(0); event.currentTarget.select(); }}
        onChange={(event) => { setQuery(event.target.value); setFilter(event.target.value); select(0); setActive(0); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            const next = Math.max(0, Math.min(options.length - 1, active + (event.key === "ArrowDown" ? 1 : -1)));
            setActive(next);
            document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: "nearest" });
          }
          if (event.key === "Enter" && open) { event.preventDefault(); if (options[active]) choose(options[active]); }
        }} />
      <button type="button" aria-label={open ? "Close customer list" : "Open customer list"} aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()} onClick={() => {
          if (open) setOpen(false); else { input.current?.focus(); setFilter(""); setActive(0); setOpen(true); }
        }}><ChevronDown size={18} /></button>
    {open && <div className="customer-dropdown-menu">
      <div className="customer-dropdown-count">{matches.length} matching customers{matches.length > 80 ? " · first 80 shown, type to narrow" : ""}</div>
      <div role="listbox" id={`${id}-list`} aria-label="Customers">
        {options.map((row, index) => <button type="button" role="option" id={`${id}-option-${index}`} key={row.id}
          aria-selected={Number(row.id) === selectedId} className={index === active ? "highlighted" : ""}
          onMouseDown={(event) => event.preventDefault()} onClick={() => choose(row)}>
          <span><b>{row.name}</b><small>{displayCode(row)}{row.phone ? ` · ${row.phone}` : ""}</small></span>
          {Number(row.id) === selectedId && <Check size={17} />}
        </button>)}
        {!options.length && <p>No customers found. Try another name, code or phone.</p>}
      </div>
    </div>}
    </div>
    <small className="customer-dropdown-help">{help}</small>
  </div>;
}
