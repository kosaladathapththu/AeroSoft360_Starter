import { FormEvent, useState } from "react";

export default function ReceivableActionModal({
  row,
  mode,
  save,
  close,
}: {
  row: any;
  mode: "edit" | "delete";
  save: (body: any, method: string) => Promise<void>;
  close: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (!String(fields.reason || "").trim()) {
      setError("Enter a reason.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await save(fields, mode === "delete" ? "DELETE" : "PUT");
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="backdrop">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        onSubmit={submit}
        aria-label={`${mode} receivable`}
      >
        <div className="popup-header">
          <div>
            <span>DEBTORS AGING</span>
            <h2>{mode === "edit" ? "Edit receivable" : "Delete receivable"}</h2>
          </div>
        </div>
        <div className="popup-body">
          <h3>{row.number}</h3>
          <p>{row.customer_name}</p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {mode === "edit" ? (
            <>
              <div className="form-row">
                <label>
                  Invoice date
                  <input
                    name="invoice_date"
                    type="date"
                    required
                    defaultValue={String(row.invoice_date || "").slice(0, 10)}
                    readOnly={!row.is_opening_balance}
                  />
                </label>
                <label>
                  Due date (optional)
                  <input
                    name="due_date"
                    type="date"
                    defaultValue={String(row.due_date || "").slice(0, 10)}
                  />
                  <small>Leave blank if credit terms are not set.</small>
                </label>
              </div>
              <label>
                Receivable amount (LKR)
                <input
                  name="total"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  defaultValue={row.total}
                  readOnly={!row.is_opening_balance}
                />
              </label>
              <p>
                {row.is_opening_balance
                  ? "Changes update the opening receivable and its journal together. The original opening posting date stays unchanged."
                  : "Change sales quantities and rates from Invoices. Here you can correct the due date."}
              </p>
            </>
          ) : (
            <p>
              This removes this receivable and its linked posting. The reason
              and original details remain in the audit history. Records with
              collections, returns or a closed accounting period cannot be
              deleted.
            </p>
          )}
          <label>
            Reason for {mode === "edit" ? "change" : "deletion"}
            <textarea
              name="reason"
              required
              maxLength={1000}
              rows={3}
              placeholder="Explain why this correction is needed"
            />
          </label>
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button type="button" disabled={busy} onClick={close}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy
                ? "Processing…"
                : mode === "edit"
                  ? "Save changes"
                  : "Delete receivable"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
