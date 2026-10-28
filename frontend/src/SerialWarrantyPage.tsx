import { useCallback, useEffect, useRef, useState } from "react";
import { FileDown, Plus, Printer, RefreshCw } from "lucide-react";
import { financeCsv, financeRequest, financeToday as today } from "./finance-utils";
import { printReport } from "./report-print";
import { SimpleForm, WorkflowModal, WorkflowTable } from "./BusinessWorkflowsPage";
import InvoiceBill from "./InvoiceBill";

export default function SerialWarrantyPage({
  api,
  token,
  permissions,
  search,
  go,
}: {
  api: string;
  token: string;
  permissions: string[];
  search: string;
  go: (page: string) => void;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [modal, setModal] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [bill, setBill] = useState<number | null>(null),
    [filter, setFilter] = useState("all");
  const output = useRef<HTMLDivElement>(null);
  const canStock = permissions.includes("stock.manage"),
    canAccounts = permissions.includes("accounting.manage");
  const load = useCallback(
    async () => setData(await financeRequest(api, token, "serial-warranties")),
    [api, token],
  );
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const save = async (path: string, body: any, method = "POST") => {
    setBusy(true);
    try {
      await financeRequest(api, token, path, body, method);
      await load();
      setModal(null);
    } finally {
      setBusy(false);
    }
  };
  const coverage = (s: any) =>
    s.status !== "sold"
      ? "Not issued"
      : !s.warranty_ends_on
        ? "No warranty"
        : s.warranty_ends_on < today()
          ? "Expired"
          : "In warranty";
  const serials = (data?.serials || []).filter(
    (s: any) =>
      (filter === "all" || s.status === filter || coverage(s) === filter) &&
      JSON.stringify(s).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="heading">
        <div>
          <span>PRODUCT TRACEABILITY</span>
          <h1>Serials &amp; Warranty</h1>
          <p>
            Track existing stock units, invoice ownership, warranty coverage and service claims.
          </p>
        </div>
        <button onClick={() => load().catch((e) => setError(e.message))}>
          <RefreshCw /> Refresh
        </button>
      </div>
      <div className="workflow-links">
        {["Finished Goods Stock", "Pricing List", "Categories", "Invoices", "Stock Ledgers"].map(
          (name) => (
            <button key={name} onClick={() => go(name)}>
              {name} →
            </button>
          ),
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!data ? (
        <p>{error ? "Use Refresh to retry." : "Loading serials and claims..."}</p>
      ) : (
        <>
          <div className="finance-toolbar">
            {canStock && (
              <button className="primary" onClick={() => setModal({ kind: "register" })}>
                <Plus /> Register serials
              </button>
            )}
            <label>
              Show
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                {["all", "available", "sold", "In warranty", "Expired"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                if (output.current)
                  printReport({
                    key: "serial_warranty",
                    title: "Serials and Warranty",
                    group: "Inventory traceability",
                    from: today(),
                    to: today(),
                    source: output.current,
                  });
              }}
            >
              <Printer /> Print / PDF
            </button>
            <button
              onClick={() =>
                financeCsv(`Serial_Warranty_${today()}.csv`, [
                  [
                    "Serial",
                    "Article",
                    "Size",
                    "Status",
                    "Invoice",
                    "Customer",
                    "Warranty start",
                    "Warranty end",
                    "Coverage",
                  ],
                  ...serials.map((s: any) => [
                    s.serial_number,
                    s.code,
                    s.size_label,
                    s.status,
                    s.invoice,
                    s.customer,
                    s.warranty_starts_on,
                    s.warranty_ends_on,
                    coverage(s),
                  ]),
                ])
              }
            >
              <FileDown /> Download serials
            </button>
          </div>
          <p className="report-note">
            Registration describes existing stock; it does not add units or accounting entries. In
            Categories / Brands / Units, enable “Require serials when invoicing” for an article to
            enforce one serial per invoiced piece. Registered available serials are issued
            automatically in registration order. Older invoices can be linked explicitly, limited to
            their original product/size quantity.
          </p>
          <div ref={output}>
            <WorkflowTable
              values={serials.map((s: any) => ({ ...s, coverage: coverage(s) }))}
              columns={[
                ["serial_number", "Serial"],
                ["code", "Article"],
                ["size_label", "Size"],
                ["status", "Status"],
                ["invoice", "Invoice"],
                ["customer", "Customer"],
                ["warranty_ends_on", "Warranty until"],
                ["coverage", "Coverage"],
              ]}
              actions={(s) => (
                <>
                  {s.sales_invoice_id && (
                    <button onClick={() => setBill(s.sales_invoice_id)}>
                      Invoice / warranty proof
                    </button>
                  )}
                  {s.status === "available" && canAccounts && (
                    <button onClick={() => setModal({ kind: "attach", row: s })}>
                      Attach to invoice
                    </button>
                  )}
                  {s.status === "sold" && canStock && (
                    <button onClick={() => setModal({ kind: "claim", row: s })}>
                      Record claim
                    </button>
                  )}
                </>
              )}
            />
            <h2>Warranty claims</h2>
            <p className="report-note">
              Claims record service outcomes. They do not issue replacement stock or refunds
              automatically; those must be handled through the corresponding stock/accounting
              workflow.
            </p>
            <WorkflowTable
              values={data.claims.filter((c: any) =>
                JSON.stringify(c).toLowerCase().includes(search.toLowerCase()),
              )}
              columns={[
                ["serial_number", "Serial"],
                ["invoice", "Invoice"],
                ["customer", "Customer"],
                ["claim_date", "Claim date"],
                ["issue", "Issue"],
                ["status", "Status"],
                ["resolution", "Update / outcome"],
                ["resolved_on", "Updated on"],
              ]}
              actions={(c) =>
                canStock && ["open", "in_progress"].includes(c.status) ? (
                  <button onClick={() => setModal({ kind: "resolve", row: c })}>
                    Update with reason
                  </button>
                ) : null
              }
            />
          </div>
        </>
      )}
      {modal && (
        <WorkflowModal
          title={
            modal.kind === "register"
              ? "Register product serials"
              : `${modal.kind} · ${modal.row?.serial_number || ""}`
          }
          busy={busy}
          close={() => setModal(null)}
        >
          {modal.kind === "register" && (
            <SerialRegister
              data={data}
              busy={busy}
              save={(body) => save("product-serials", body)}
            />
          )}
          {modal.kind === "attach" && (
            <SimpleForm
              busy={busy}
              label="Attach existing serial"
              submit={(f) =>
                save("product-serials/attach", {
                  serial_ids: [modal.row.id],
                  sales_invoice_id: Number(f.get("sales_invoice_id")),
                })
              }
            >
              <p>
                {modal.row.code} · Size {modal.row.size_label}. This will not change the invoice
                amount or stock quantity.
              </p>
              <InvoiceSelect invoices={data.invoices} />
            </SimpleForm>
          )}
          {modal.kind === "claim" && (
            <SimpleForm
              busy={busy}
              label="Open warranty claim"
              submit={(f) =>
                save("warranty-claims", {
                  product_serial_id: modal.row.id,
                  claim_date: f.get("claim_date"),
                  issue: f.get("issue"),
                })
              }
            >
              <p>
                {modal.row.customer} · {modal.row.invoice} · Warranty {modal.row.warranty_starts_on}{" "}
                to {modal.row.warranty_ends_on || "not covered"}
              </p>
              <label>
                Claim date
                <input
                  name="claim_date"
                  type="date"
                  min={modal.row.warranty_starts_on}
                  max={today()}
                  required
                  defaultValue={today()}
                />
              </label>
              <label>
                Issue
                <textarea name="issue" required maxLength={1000} />
              </label>
            </SimpleForm>
          )}
          {modal.kind === "resolve" && (
            <SimpleForm
              busy={busy}
              label="Save claim update"
              submit={(f) =>
                save(
                  `warranty-claims/${modal.row.id}`,
                  {
                    status: f.get("status"),
                    resolution: f.get("resolution"),
                    resolved_on: f.get("resolved_on"),
                  },
                  "PUT",
                )
              }
            >
              <p>{modal.row.issue}</p>
              <label>
                Status
                <select name="status">
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label>
                Update date
                <input
                  name="resolved_on"
                  type="date"
                  min={modal.row.claim_date}
                  max={today()}
                  defaultValue={today()}
                  required
                />
              </label>
              <label>
                Update / resolution reason
                <textarea name="resolution" maxLength={1000} required />
              </label>
            </SimpleForm>
          )}
        </WorkflowModal>
      )}
      {bill && <InvoiceBill id={bill} api={api} token={token} close={() => setBill(null)} />}
    </>
  );
}

function InvoiceSelect({ invoices, optional = false }: { invoices: any[]; optional?: boolean }) {
  return (
    <label>
      {optional ? "Existing invoice (leave blank for available stock)" : "Invoice"}
      <select name="sales_invoice_id" required={!optional}>
        <option value="">
          {optional ? "Available stock, not yet invoiced" : "Select invoice"}
        </option>
        {invoices.map((i: any) => (
          <option key={i.id} value={i.id}>
            {i.number} · {i.customer} · {i.invoice_date}
          </option>
        ))}
      </select>
    </label>
  );
}

function SerialRegister({
  data,
  busy,
  save,
}: {
  data: any;
  busy: boolean;
  save: (body: any) => Promise<any>;
}) {
  const [article, setArticle] = useState("");
  return (
    <SimpleForm
      busy={busy}
      label="Register without changing stock"
      submit={(f) =>
        save({
          article_id: Number(article),
          size_label: f.get("size_label"),
          received_on: f.get("received_on"),
          warranty_months: Number(f.get("warranty_months")),
          sales_invoice_id: Number(f.get("sales_invoice_id")) || null,
          serial_numbers: String(f.get("serial_numbers"))
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean),
        })
      }
    >
      <label>
        Article
        <select required value={article} onChange={(e) => setArticle(e.target.value)}>
          <option value="">Choose article</option>
          {data.articles.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Size
        <select name="size_label" required key={article}>
          <option value="">Choose size</option>
          {data.sizes
            .filter((s: any) => s.article_id === Number(article))
            .map((s: any) => (
              <option key={s.size_label} value={s.size_label}>
                {s.size_label}
              </option>
            ))}
        </select>
      </label>
      <div className="form-row">
        <label>
          Serial received date
          <input name="received_on" type="date" required defaultValue={today()} />
        </label>
        <label>
          Warranty months (0 = none)
          <input
            name="warranty_months"
            type="number"
            min="0"
            max="120"
            step="1"
            defaultValue="12"
            required
          />
        </label>
      </div>
      <InvoiceSelect invoices={data.invoices} optional />
      <label>
        Serial numbers · one per line
        <textarea
          name="serial_numbers"
          rows={8}
          required
          placeholder={"SHOE-000001\nSHOE-000002"}
        />
      </label>
    </SimpleForm>
  );
}
