import { useEffect, useState } from "react";
import { financeRequest, financeToday } from "./finance-utils";
import { WorkflowGo, purchaseSteps } from "./workflow";
import { WorkflowTable } from "./BusinessWorkflowsPage";

export default function PurchasingOverview({
  api,
  token,
  orders,
  go,
}: {
  api: string;
  token: string;
  orders: any[];
  go: WorkflowGo;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    financeRequest(api, token, `business-workflows?as_of=${financeToday()}`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, token]);
  const unbilled =
    data?.receipts.filter(
      (r: any) =>
        r.status === "posted" &&
        !data.supplier_invoices.some((i: any) => i.goods_receipt_id === r.id),
    ) || [];
  const unpaid =
    data?.supplier_invoices.filter(
      (i: any) =>
        Number(data.receipts.find((r: any) => r.id === i.goods_receipt_id)?.outstanding) > 0,
    ) || [];
  const waiting = [
    orders.filter((o) => o.status === "draft").length,
    orders.filter((o) => ["approved", "part_received"].includes(o.status)).length,
    unbilled.length,
    unpaid.length,
  ];
  return (
    <>
      <div className="heading">
        <div>
          <span>PURCHASING WORKSPACE</span>
          <h1>Purchasing — step by step</h1>
          <p>
            Order goods, receive the delivery, register the supplier bill, then pay. Start from the
            next unfinished step.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="workflow-home-grid">
        {purchaseSteps.map((step, index) => (
          <article key={step.page}>
            <small>STEP {index + 1}</small>
            <h2>{step.label}</h2>
            <strong>{index > 1 && !data ? "…" : waiting[index]}</strong>
            <p>
              {
                [
                  "Draft orders awaiting approval",
                  "Approved orders awaiting goods",
                  "Posted GRNs awaiting a supplier bill",
                  "Registered bills with an outstanding balance",
                ][index]
              }
            </p>
            <button onClick={() => go(step.page)}>Open {step.label.toLowerCase()}</button>
          </article>
        ))}
      </div>
      <div className="workflow-shortcuts workflow-setup" aria-label="Purchasing shortcuts">
        <span>Setup and returns</span>
        <button onClick={() => go("Suppliers")}>Suppliers</button>
        <button onClick={() => go("Raw Material Stock")}>Materials and stock</button>
        <button onClick={() => go("Purchase Returns")}>Purchase Returns</button>
      </div>
      {data && (
        <>
          <h2>Deliveries waiting for a purchase invoice</h2>
          <WorkflowTable
            values={unbilled}
            columns={[
              ["number", "GRN"],
              ["supplier", "Supplier"],
              ["received_on", "Received date"],
              ["total", "Amount", "money"],
            ]}
            actions={(r) => (
              <button
                onClick={() => go("Supplier Invoices", { receiptId: r.id, action: "invoice" })}
              >
                Register invoice
              </button>
            )}
          />
          <h2>Purchase invoices waiting for payment</h2>
          <WorkflowTable
            values={unpaid.map((i: any) => ({
              ...i,
              outstanding: data.receipts.find((r: any) => r.id === i.goods_receipt_id)?.outstanding,
            }))}
            columns={[
              ["invoice_number", "Purchase invoice"],
              ["supplier", "Supplier"],
              ["receipt", "GRN"],
              ["due_date", "Due date"],
              ["outstanding", "Outstanding", "money"],
            ]}
            actions={(i) => (
              <button
                onClick={() =>
                  go("Payment Vouchers", { receiptId: i.goods_receipt_id, action: "payment" })
                }
              >
                Prepare supplier payment
              </button>
            )}
          />
        </>
      )}
      <p className="report-note">
        The current purchase-invoice register links one supplier bill to one GRN. Partial deliveries
        can create several GRNs; combining multiple GRNs into a single invoice is not supported yet.
      </p>
    </>
  );
}
