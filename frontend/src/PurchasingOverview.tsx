import { ArrowRight, ClipboardList, PackageCheck, ReceiptText, Wallet, Users, Boxes, RotateCcw, CheckCircle2 } from "lucide-react";
import "./purchasing-overview.css";
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
  const icons = [ClipboardList, PackageCheck, ReceiptText, Wallet];
  const actions = ["View purchase orders", "Receive goods", "Register supplier bills", "Manage payments"];
  const descriptions = ["Draft orders awaiting approval", "Approved orders awaiting delivery", "Deliveries ready for a supplier bill", "Supplier bills with an unpaid balance"];
  const totalWaiting = waiting.reduce((sum, count) => sum + count, 0);
  return (
    <section className="purchasing-overview">
      <header className="purchase-overview-header">
        <div><span className="purchase-eyebrow">PURCHASING WORKSPACE</span><h1>Purchasing overview</h1><p>From supplier order to payment. See what needs attention and open the right step.</p></div>
        <div className="purchase-attention"><span className="purchase-attention-dot"/><div><strong>{data ? totalWaiting : "..."}</strong><span>items awaiting action</span></div></div>
      </header>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="purchase-stage-grid">
        {purchaseSteps.map((step, index) => {
          const Icon = icons[index];
          return <article className={"purchase-stage purchase-stage-" + index} key={step.page}>
            <div className="purchase-stage-top"><span className="purchase-stage-icon"><Icon size={23}/></span><span className="purchase-stage-number">STEP 0{index + 1}</span></div>
            <h2>{step.label}</h2>
            <div className="purchase-stage-count"><strong>{index > 1 && !data ? "..." : waiting[index]}</strong><span>{index === 0 ? "orders to approve" : index === 1 ? "orders to receive" : index === 2 ? "deliveries to bill" : "bills to pay"}</span></div>
            <p>{descriptions[index]}</p>
            <button type="button" onClick={() => go(step.page)}>{actions[index]}<ArrowRight size={17}/></button>
          </article>;
        })}
      </div>
      <nav className="purchase-tools" aria-label="Purchasing shortcuts">
        <span>Quick access</span>
        <button type="button" onClick={() => go("Suppliers")}><Users size={17}/>Suppliers</button>
        <button type="button" onClick={() => go("Raw Material Stock")}><Boxes size={17}/>Materials & stock</button>
        <button type="button" onClick={() => go("Purchase Returns")}><RotateCcw size={17}/>Purchase returns</button>
      </nav>
      {data && <div className="purchase-work-queues">
        <section className="purchase-queue">
          <header><div className="purchase-queue-title"><ReceiptText size={21}/><div><h2>Ready for invoicing</h2><p>Received deliveries awaiting a supplier bill</p></div></div><span className="purchase-queue-badge">{unbilled.length}</span></header>
          {unbilled.length ? <WorkflowTable values={unbilled} columns={[["number", "GRN"], ["supplier", "Supplier"], ["received_on", "Received date"], ["total", "Amount", "money"]]}
            actions={(r) => <button onClick={() => go("Supplier Invoices", {receiptId:r.id,action:"invoice"})}>Register invoice <ArrowRight size={15}/></button>}/>
            : <div className="purchase-empty"><CheckCircle2 size={25}/><div><strong>No deliveries waiting</strong><p>Received goods will appear here when a supplier bill is needed.</p></div></div>}
        </section>
        <section className="purchase-queue">
          <header><div className="purchase-queue-title"><Wallet size={21}/><div><h2>Ready for payment</h2><p>Registered supplier bills with a balance remaining</p></div></div><span className="purchase-queue-badge">{unpaid.length}</span></header>
          {unpaid.length ? <WorkflowTable values={unpaid.map((i:any)=>({...i,outstanding:data.receipts.find((r:any)=>r.id===i.goods_receipt_id)?.outstanding}))}
            columns={[["invoice_number","Purchase invoice"],["supplier","Supplier"],["receipt","GRN"],["due_date","Due date"],["outstanding","Outstanding","money"]]}
            actions={(i)=><button onClick={()=>go("Payment Vouchers",{receiptId:i.goods_receipt_id,action:"payment"})}>Prepare payment <ArrowRight size={15}/></button>}/>
            : <div className="purchase-empty"><CheckCircle2 size={25}/><div><strong>No supplier bills waiting</strong><p>Unpaid purchase invoices will appear here for payment.</p></div></div>}
        </section>
      </div>}
      <details className="purchase-workflow-note"><summary>How deliveries and supplier bills connect</summary><p>Each purchase invoice links to one GRN. Partial deliveries can create several GRNs; combining multiple GRNs into a single invoice is not supported yet.</p></details>
    </section>
  );
}
