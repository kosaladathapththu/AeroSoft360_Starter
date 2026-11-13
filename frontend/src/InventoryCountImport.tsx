import { useEffect, useRef, useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";
import { financeRequest } from "./finance-utils";
import "./inventory-count-import.css";

type CountRow = { code: string; name: string; size: string; expected: number; quantity: number; difference: number; kind?: string; unit_cost?: number };

export default function InventoryCountImport({ api, token }: { api: string; token: string }) {
  const [kind, setKind] = useState("finished");
  const [rows, setRows] = useState<CountRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState("");
  const [key, setKey] = useState("");
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (rows.length) {
      reviewHeading.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      reviewHeading.current?.focus({ preventScroll: true });
    }
  }, [rows]);
  const groups = Array.from(rows.reduce((map, row) => {
    const group = map.get(row.code) || [];
    group.push(row);
    map.set(row.code, group);
    return map;
  }, new Map<string, CountRow[]>()));

  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage(""); setFailed(false);
    try { await action(); }
    catch (error) { setFailed(true); setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function download() {
    await run(async () => {
      const response = await fetch(api + "/inventory-count/template?kind=" + kind, { headers: { Authorization: "Bearer " + token } });
      if (!response.ok) throw new Error("Unable to download. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = kind === "raw" ? "Material_Stock_Counts.xlsx" : "Article_Stock_Counts.xlsx";
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  async function preview(selectedFile: File) {
    setRows([]);
    await run(async () => {
      const body = new FormData(); body.append("file", selectedFile);
      const response = await fetch(api + "/inventory-count/preview", { method: "POST", headers: { Authorization: "Bearer " + token, Accept: "application/json" }, body });
      const result = await response.json();
      if (!response.ok) throw new Error(Object.values(result.errors || {}).flat().join(" ") || result.message || "Unable to read this file. Download a fresh template and try again.");
      setRows(result.rows); setKey(crypto.randomUUID()); if (result.message) setMessage(result.message);
    });
  }

  return <section className="inventory-count-import">
    <header className="count-import-heading"><div><h2>Update stock from Excel</h2><p>Choose your completed file to review changes automatically, then confirm the update.</p></div>
      <label>Stock type<select value={kind} disabled={busy} onChange={event => { setKind(event.target.value); setRows([]); setFile(null); setMessage(""); }}><option value="finished">Articles / finished goods</option><option value="raw">Raw materials</option></select></label>
    </header>
    <div className="count-import-steps">
      <section><span className="count-step-number">1</span><h3>Download template</h3><p>{kind === "finished" ? "Only three columns: Article code, Category, Stock." : "Current materials and batches are already listed."}</p><button type="button" className="count-download" disabled={busy} onClick={download}><Download size={18}/> Download Excel</button></section>
      <section><span className="count-step-number">2</span><h3>Edit Stock totals</h3><p>Enter the final stock count. <strong>Blank = keep current stock.</strong> Enter <strong>0</strong> to clear stock.</p><small>{kind === "finished" ? "One total quantity per article. No sizes. Current totals are already filled in." : "Fill new_quantity. Keep existing batch costs unchanged."}</small></section>
      <section><span className="count-step-number">3</span><h3>Upload your file</h3><label className="count-file">Completed Excel file<input ref={fileInput} key={kind} type="file" accept=".xlsx" disabled={busy} onChange={event => {
        const selectedFile = event.target.files?.[0];
        setRows([]); setMessage(""); setFailed(false); setReason("");
        setFile(selectedFile || null);
        if (selectedFile) void preview(selectedFile);
        event.target.value = "";
      }}/></label><small>The file is reviewed automatically. Check the details below and confirm.</small></section>
    </div>
    <p className="count-import-hint">Counts replace existing quantities; uploading does not add the same stock again. Article stock is one total across all sizes and colours.</p>
    {busy && <p role="status">Processing, please wait...</p>}
    {message && <div className={failed ? "count-feedback count-error" : "count-feedback count-success"} role={failed ? "alert" : "status"}>{message}</div>}
    {rows.length > 0 && <section className="count-review"><h3 ref={reviewHeading} tabIndex={-1}>Ready to confirm - {groups.length} {kind === "raw" ? "materials" : "articles"}</h3><p><strong>{file?.name}</strong> reviewed successfully. Check the current stock, new stock and changes below.</p><p>Stock updates only when you select <strong>Confirm stock update</strong>.</p>
      <div className="count-review-table"><table><thead><tr><th>Article code / item</th>{kind === "raw" ? <th>Batch: current to new count</th> : <><th>Current stock</th><th>New stock</th></>}<th>Change</th></tr></thead><tbody>{groups.map(([code, entries]) => <tr key={code}><td><strong>{code}</strong><small>{entries[0].name}</small></td>{kind === "raw" ? <td><div className="count-size-changes">{entries.map(row => <span key={row.size}><b>{row.size}</b>: {row.expected} &rarr; <strong>{row.quantity}</strong></span>)}</div></td> : <><td>{entries[0].expected}</td><td><strong>{entries[0].quantity}</strong></td></>}<td>{entries.reduce((sum, row) => sum + Number(row.difference), 0)}</td></tr>)}</tbody></table></div>
      <div className="count-save-row"><label>Reason for update<input value={reason} maxLength={255} onChange={event => setReason(event.target.value)} placeholder="e.g. Physical stock count"/></label><button type="button" className="count-upload" disabled={busy || reason.trim().length < 3} onClick={() => run(async () => {
        const result = await financeRequest(api, token, "inventory-count/apply", { rows: rows.map(({ code, size, expected, quantity, kind, unit_cost }) => ({ code, size, expected, quantity, kind, unit_cost })), reason, import_key: key }, "POST");
        setMessage(result.message); setRows([]); setFile(null); setReason(""); if (fileInput.current) fileInput.current.value = "";
      })}><CheckCircle2 size={18}/> Confirm stock update</button><button type="button" disabled={busy} onClick={() => { setRows([]); setFile(null); setReason(""); }}>Cancel review</button></div>
    </section>}
  </section>;
}
