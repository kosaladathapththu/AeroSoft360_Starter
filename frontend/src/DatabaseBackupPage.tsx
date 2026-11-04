import { useState } from "react";
import { Database, Download, Loader2 } from "lucide-react";

export default function DatabaseBackupPage({ api, token }: { api: string; token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function download() {
    setBusy(true); setError(""); setMessage("");
    try {
      // Request JSON errors; Laravel can still send a binary successful download.
      const response = await fetch(`${api}/admin/database-backup`, {method: "POST", headers: {Authorization: `Bearer ${token}`, Accept: "application/json"}});
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const fallback = response.status === 401 ? "Your session expired. Sign in again before downloading a backup."
          : response.status === 403 ? "Administrator access is required to download a backup."
          : response.status === 429 ? "Too many backup requests. Wait a minute, then try again."
          : `Database backup failed (HTTP ${response.status}). Please retry.`;
        throw new Error(body.message || fallback);
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("The backup file was empty.");
      const filename = /filename="?([^";]+)"?/i.exec(response.headers.get("Content-Disposition") || "")?.[1] || "AeroSoft360_Database_Backup.sql";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("Backup download started. Check your browser downloads and keep the file in a secure location.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <>
    <div className="heading"><div><span>ADMINISTRATION</span><h1>Database backup</h1><p>Download a snapshot of the system database.</p></div></div>
    <section className="opening-balance-toolbar" aria-label="Database backup download">
      <div><b><Database size={18} aria-hidden="true" /> Full database backup</b><small>Includes customers, invoices, inventory, accounts, users and stored login data.</small></div>
      <button className="primary" disabled={busy} onClick={download}>{busy ? <Loader2 size={18} /> : <Download size={18} />}{busy ? "Preparing backup..." : "Download database backup"}</button>
    </section>
    {error && <div className="error" role="alert">{error}</div>}
    {message && <div className="success-message" role="status">{message}</div>}
    <div className="report-note"><p><b>Administrator access only.</b> The file contains confidential business and login data. Store it securely.</p><p>MySQL/MariaDB downloads as SQL; SQLite downloads as a database file. Uploaded attachments, Excel source files and application settings are separate and are not included.</p><p>Backup downloads do not change business records. Database restore is a separate administrator operation.</p></div>
  </>;
}
