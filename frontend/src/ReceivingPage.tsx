import { useCallback, useEffect, useState } from "react";
import { financeMoney as money, financeRequest, financeToday } from "./finance-utils";
import { matchesSearch } from "./search";
import { WorkflowTable, WorkflowModal } from "./BusinessWorkflowsPage";
import { WorkflowGo } from "./workflow";

export default function ReceivingPage({
  api,
  token,
  orders,
  permissions,
  search,
  go,
  onChanged,
  initialOrderId,
}: {
  api: string;
  token: string;
  orders: any[];
  permissions: string[];
  search: string;
  go: WorkflowGo;
  onChanged: () => void;
  initialOrderId?: number;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  const [orderId, setOrderId] = useState<number | null>(initialOrderId || null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<any>(null),
    [view, setView] = useState<any>(null);
  const load = useCallback(
    async () =>
      setData(await financeRequest(api, token, `business-workflows?as_of=${financeToday()}`)),
    [api, token],
  );
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    if (initialOrderId) setOrderId(initialOrderId);
  }, [initialOrderId]);
  const waiting = orders.filter((o) => ["approved", "part_received"].includes(o.status));
  const order = orders.find((o) => o.id === orderId);
  const invoiceFor = (id: number) =>
    data?.supplier_invoices.find((i: any) => Number(i.goods_receipt_id) === Number(id));
  return (
    <>
      <div className="heading">
        <div>
          <span>PURCHASING · STEP 2</span>
          <h1>Goods Received (GRN)</h1>
          <p>
            Choose an approved purchase order and record only the goods that arrived. Partial
            deliveries stay open.
          </p>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <div className="workflow-success" role="status">
          <b>{notice.number} posted.</b>
          <span>Next: register the supplier invoice when the bill arrives.</span>
          <button
            onClick={() => go("Supplier Invoices", { receiptId: notice.id, action: "invoice" })}
          >
            Register purchase invoice
          </button>
        </div>
      )}
      <h2>Purchase orders awaiting goods</h2>
      <WorkflowTable
        values={waiting.filter((o) => matchesSearch(o, search))}
        columns={[
          ["number", "Purchase order"],
          ["supplier_name", "Supplier"],
          ["order_date", "Order date"],
          ["expected_date", "Expected"],
          ["total", "Order total", "money"],
          ["status", "Status"],
        ]}
        actions={(o) =>
          permissions.includes("stock.manage") ? (
            <button
              onClick={() => {
                setOrderId(o.id);
                setError("");
              }}
            >
              Receive goods
            </button>
          ) : (
            <span>Awaiting warehouse receipt</span>
          )
        }
      />
      <h2>Posted goods receipts</h2>
      <p className="report-note">
        A GRN records a delivery. A purchase invoice records the supplier's bill. Each receipt
        remains linked to its purchase order.
      </p>
      {!data ? (
        <p role="status">Loading receipt history…</p>
      ) : (
        <WorkflowTable
          values={data.receipts
            .map((g: any) => ({
              ...g,
              po_number:
                orders.find((o) => o.id === g.purchase_order_id)?.number ||
                `PO #${g.purchase_order_id}`,
              invoice_number: invoiceFor(g.id)?.invoice_number || "Awaiting supplier invoice",
            }))
            .filter((g: any) => matchesSearch(g, search))}
          columns={[
            ["number", "GRN"],
            ["po_number", "Purchase order"],
            ["supplier", "Supplier"],
            ["received_on", "Received date"],
            ["total", "Received value", "money"],
            ["invoice_number", "Purchase invoice"],
            ["status", "Status"],
          ]}
          actions={(g) => (
            <>
              <button onClick={() => setView(g)}>View items</button>
              {g.status === "posted" &&
                (invoiceFor(g.id) ? (
                  <button
                    onClick={() =>
                      go("Supplier Invoices", { query: invoiceFor(g.id)?.invoice_number })
                    }
                  >
                    View purchase invoice
                  </button>
                ) : (
                  permissions.includes("purchases.manage") && (
                    <button
                      onClick={() =>
                        go("Supplier Invoices", { receiptId: g.id, action: "invoice" })
                      }
                    >
                      Register invoice
                    </button>
                  )
                ))}
            </>
          )}
        />
      )}
      {order && permissions.includes("stock.manage") && (
        <WorkflowModal
          title={`Receive goods — ${order.number}`}
          busy={busy}
          close={() => setOrderId(null)}
        >
          <ReceiptForm
            key={order.id}
            order={order}
            busy={busy}
            error={error}
            save={async (body) => {
              setBusy(true);
              setError("");
              try {
                const receipt = await financeRequest(
                  api,
                  token,
                  `purchase-orders/${order.id}/receive`,
                  body,
                  "POST",
                );
                setOrderId(null);
                setNotice(receipt);
                onChanged();
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </WorkflowModal>
      )}
      {view && (
        <WorkflowModal
          title={`${view.number} — received items`}
          busy={false}
          close={() => setView(null)}
        >
          <p>
            {view.supplier} · {view.received_on} · {view.po_number}
          </p>
          <WorkflowTable
            values={view.lines}
            columns={[
              ["code", "Material"],
              ["name", "Description"],
              ["batch_number", "Batch"],
              ["quantity", "Received quantity"],
              ["unit_cost", "Unit cost", "money"],
              ["line_total", "Amount", "money"],
            ]}
          />
        </WorkflowModal>
      )}
    </>
  );
}

function ReceiptForm({
  order,
  busy,
  error,
  save,
}: {
  order: any;
  busy: boolean;
  error: string;
  save: (body: any) => Promise<void>;
}) {
  const available = order.lines.filter(
    (l: any) => Number(l.quantity) > Number(l.received_quantity),
  );
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const total = available.reduce(
    (sum: number, l: any) => sum + Number(quantities[l.id] || 0) * Number(l.unit_cost),
    0,
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({
          received_on: f.get("received_on"),
          lines: available
            .filter((l: any) => Number(quantities[l.id] || 0) > 0)
            .map((l: any) => ({
              purchase_order_line_id: l.id,
              quantity: Number(quantities[l.id]),
              batch_number: f.get(`batch_${l.id}`),
            })),
        });
      }}
    >
      <p>{order.supplier_name} · Leave items at zero if they have not arrived.</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <fieldset disabled={busy}>
        <label>
          Received date
          <input
            name="received_on"
            type="date"
            min={order.order_date}
            defaultValue={financeToday()}
            required
          />
        </label>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Ordered</th>
                <th>Already received</th>
                <th>Remaining</th>
                <th>Receive now</th>
                <th>Batch</th>
              </tr>
            </thead>
            <tbody>
              {available.map((l: any) => (
                <tr key={l.id}>
                  <td>
                    {l.material_code}
                    <br />
                    {l.material_name}
                  </td>
                  <td>{l.quantity}</td>
                  <td>{l.received_quantity}</td>
                  <td>{Number(l.quantity) - Number(l.received_quantity)}</td>
                  <td>
                    <input
                      aria-label={`Receive quantity for ${l.material_code}`}
                      type="number"
                      min="0"
                      max={Number(l.quantity) - Number(l.received_quantity)}
                      step="0.0001"
                      value={quantities[l.id] || ""}
                      placeholder="0"
                      onChange={(e) => setQuantities((q) => ({ ...q, [l.id]: e.target.value }))}
                    />
                  </td>
                  <td>
                    <input
                      name={`batch_${l.id}`}
                      aria-label={`Batch for ${l.material_code}`}
                      required={Number(quantities[l.id] || 0) > 0}
                      maxLength={80}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Received value: <b>{money(total)}</b>
        </p>
        <button
          className="primary"
          disabled={busy || !available.some((l: any) => Number(quantities[l.id] || 0) > 0)}
        >
          Post goods receipt
        </button>
      </fieldset>
    </form>
  );
}
