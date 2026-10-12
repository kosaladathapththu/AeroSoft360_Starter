import { useState } from 'react';
import { LayoutDashboard, Factory, Boxes, ShoppingCart, Truck, Receipt, Landmark, Users, ChartColumn, Settings, Search, Bell, ChevronRight, Menu, Plus, X, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Module = { label: string; icon: LucideIcon; detail: string };
type Capability = { title: string; description: string; status: 'Foundation' | 'Planned' | 'Needs approval' };
const modules: Module[] = [
  { label:'Dashboard', icon: LayoutDashboard, detail:'Company-wide operational overview' },
  { label:'Manufacturing', icon: Factory, detail:'Production orders, batches, stages and BOMs' },
  { label:'Inventory', icon: Boxes, detail:'Raw material lots and finished goods' },
  { label:'Purchasing', icon: Truck, detail:'Suppliers, purchase orders, GRNs and payable invoices' },
  { label:'Sales & Reps', icon: ShoppingCart, detail:'Orders, invoices, representatives and credit control' },
  { label:'Collections', icon: Receipt, detail:'Receipts, cheque clearance and verified cash handovers' },
  { label:'Financial Accounting', icon: Landmark, detail:'General Ledger, journals, statements and banking' },
  { label:'HR & Payroll', icon: Users, detail:'Employees, attendance imports, payroll and approvals' },
  { label:'Management Accounting', icon: ChartColumn, detail:'Budgets, batch costs and profitability' },
  { label:'Settings & Roles', icon: Settings, detail:'Editable roles, approval rules and business settings' },
];
const quick = [ { title:'Sales today',value:'—',note:'Awaiting live data' }, {title:'Production output',value:'—',note:'Awaiting live data'}, {title:'Inventory value',value:'—',note:'Awaiting live data'}, {title:'Outstanding AR',value:'—',note:'Awaiting live data'} ];
const workflow = [ {title:'Material purchasing',description:'Supplier → PO → GRN → Supplier invoice'}, {title:'Production',description:'BOM → Material issue → Stage updates → QA'}, {title:'Sales',description:'Finished stock → Dispatch → Invoice'}, {title:'Finance',description:'Payment → Verified receipt → Journal posting'} ];
const capabilities: Record<string, Capability[]> = {
  Manufacturing: [
    {title:'Versioned BOMs',description:'Variant quantities, unit conversions, wastage and effective dates.',status:'Foundation'},
    {title:'Production batches',description:'Stage input, accepted output, rejection, rework and WIP history.',status:'Foundation'},
    {title:'Batch costing',description:'Material, labour and overhead allocation requires approved accounting rules.',status:'Needs approval'},
  ],
  Inventory: [
    {title:'Batch stock ledger',description:'Immutable movements by SKU, batch, warehouse, location and stock type.',status:'Foundation'},
    {title:'Stock controls',description:'Reservations, quarantine, damaged goods and negative-stock prevention.',status:'Foundation'},
    {title:'Specific batch valuation',description:'Selected in the SRS but requires accounting-policy validation by material class.',status:'Needs approval'},
  ],
  Purchasing: [
    {title:'Purchase orders',description:'Supplier, prices, expected dates, approval and partial receipt tracking.',status:'Foundation'},
    {title:'GRN and quality checks',description:'Accepted/rejected quantities and receipt batch creation.',status:'Foundation'},
    {title:'Three-way matching',description:'PO, GRN and supplier invoice tolerance workflow.',status:'Planned'},
  ],
  'Sales & Reps': [
    {title:'Configurable sets',description:'Expand approved templates into exact size and colour variant quantities.',status:'Foundation'},
    {title:'Order-to-invoice flow',description:'Customer PO, sales order, dispatch and invoice without repeated entry.',status:'Planned'},
    {title:'Returns and credit',description:'Full-set or selected-piece returns with quality disposition.',status:'Planned'},
  ],
  Collections: [
    {title:'Receipt allocation',description:'Allocate one receipt across invoices and retain unallocated advances.',status:'Foundation'},
    {title:'100-day commission',description:'Proportional commission on eligible cleared collections.',status:'Foundation'},
    {title:'Cheque edge cases',description:'Eligibility date and post-dishonour treatment need business sign-off.',status:'Needs approval'},
  ],
  'Financial Accounting': [
    {title:'General ledger',description:'Balanced, idempotent journals with source references and fiscal periods.',status:'Foundation'},
    {title:'Period control',description:'Locking, backdating approval and traceable reversals.',status:'Planned'},
    {title:'Financial statements',description:'Trial Balance, P&L, Balance Sheet and cash-flow classifications.',status:'Planned'},
  ],
  'HR & Payroll': [
    {title:'Attendance rules',description:'Configurable weekday, Saturday and Sunday calculations from the July workbook.',status:'Foundation'},
    {title:'Payroll workflow',description:'HR review, Finance approval, posting, payment and immutable corrections.',status:'Planned'},
    {title:'Statutory bases',description:'EPF, ETF and APIT bases must be approved before production use.',status:'Needs approval'},
  ],
  'Management Accounting': [
    {title:'Cost centres',description:'Hierarchical departments, allocation bases and actual-versus-budget views.',status:'Planned'},
    {title:'Margin analysis',description:'Batch, product, customer, representative and channel profitability.',status:'Planned'},
    {title:'Cash forecast',description:'Editable forecast kept separate from posted actual cash flow.',status:'Planned'},
  ],
  'Settings & Roles': [
    {title:'Role permissions',description:'Server-side view, create, edit, submit, approve, post and export actions.',status:'Foundation'},
    {title:'Approval policies',description:'Effective-dated steps, thresholds and separation of duties.',status:'Foundation'},
    {title:'Company settings',description:'Timezone, currency, taxes, numbering and configurable business rules.',status:'Foundation'},
  ],
};
export default function App(){
 const [page,setPage]=useState('Dashboard'); const [menu,setMenu]=useState(false);const [filter,setFilter]=useState('');const [modal,setModal]=useState(false); const [saved,setSaved]=useState(false);
 const current=modules.find(m=>m.label===page)!;
 const openModal=()=>{setSaved(false);setModal(true)};
 return <div className="shell">
   <aside className={'sidebar '+(menu?'open':'')}>
     <div className="identity"><span className="logo">A</span><div><strong>AeroSoft<span>360</span></strong><small>Manufacturing ERP</small></div><button className="mobile-close" onClick={()=>setMenu(false)} aria-label="Close menu"><X size={18}/></button></div>
     <div className="section-label">WORKSPACE</div><nav>{modules.map(m=><button key={m.label} onClick={()=>{setPage(m.label);setMenu(false);setSaved(false)}} className={'nav '+(page===m.label?'active':'')}><m.icon size={18}/><span>{m.label}</span>{page===m.label&&<ChevronRight size={15} />}</button>)}</nav>
     <div className="sidebar-bottom"><div className="avatar">SA</div><div><strong>Super Admin</strong><small>Prototype access</small></div></div>
   </aside>
   <main className="main"><header className="topbar"><button className="hamburger" aria-label="Open menu" onClick={()=>setMenu(true)}><Menu size={22}/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> <b>{page}</b></div><div className="top-actions"><div className="search"><Search size={16}/><input placeholder="Search modules" value={filter} onChange={e=>setFilter(e.target.value)}/></div><Bell size={19}/><span className="user-bubble">SA</span></div></header>
     <section className="body"><div className="heading"><div><div className="eyebrow">AEROSOFT360 / {page.toUpperCase()}</div><h1>{page==='Dashboard'?'Business Overview':page}</h1><p>{page==='Dashboard'?'Track manufacturing, sales, stock and financial performance in one place.':current.detail}</p></div><button className="primary" onClick={openModal}><Plus size={17}/> New Record</button></div>
     <div className="notice"><CheckCircle2 size={18}/><div><b>Project starter — no live company data</b><span> UI layout and database scaffolding are prepared. Financial posting and approval workflows are not yet connected.</span></div></div>
     {page==='Dashboard'?<><div className="stats">{quick.map((s,i)=><div className="stat" key={s.title}><span>{s.title}</span><strong>{s.value}</strong><small>{s.note}</small><span className={'spark spark-'+i}/></div>)}</div><div className="columns"><div className="panel"><div className="panel-title"><h2>ERP Business Flow</h2><span>Controlled transaction path</span></div><div className="flow-list">{workflow.map((w,i)=><div className="flow-item" key={w.title}><div className="num">{String(i+1).padStart(2,'0')}</div><div><b>{w.title}</b><p>{w.description}</p></div><ChevronRight size={16}/></div>)}</div></div><div className="panel"><div className="panel-title"><h2>Quick Access</h2><span>Module shortcuts</span></div><div className="shortcuts">{modules.slice(1,7).map(m=><button key={m.label} onClick={()=>setPage(m.label)}><m.icon size={20}/><span>{m.label}</span><ChevronRight size={15}/></button>)}</div></div></div></>:<><div className="panel module-panel"><div className="panel-title"><h2>{page} delivery scope</h2><span>BRS/SRS aligned</span></div><p>{current.detail}. Confirmed rules are implemented as foundations; unresolved policy choices remain explicitly approval-gated.</p><div className="capability-list">{(capabilities[page]??[]).map(item=><article key={item.title}><div><b>{item.title}</b><p>{item.description}</p></div><span className={'status '+item.status.toLowerCase().replace(' ','-')}>{item.status}</span></article>)}</div><div className="module-tags"><span>Role-based permissions</span><span>Audit trail</span><span>Approval workflow</span><span>Central accounting</span></div></div></>}
     {filter.trim()&&<div className="panel search-results"><h2>Matching modules</h2>{modules.filter(m=>m.label.toLowerCase().includes(filter.toLowerCase())).map(m=><button key={m.label} onClick={()=>{setPage(m.label);setFilter('')}}>{m.label} →</button>)}</div>}
     <footer>© AeroSoft360 · Phase 1 starter · No live ERP operations</footer></section>
   </main>
   {modal&&<div className="backdrop" onClick={()=>setModal(false)}><div role="dialog" aria-modal="true" aria-label="New record" className="modal" onClick={e=>e.stopPropagation()}><button className="close" aria-label="Close" onClick={()=>setModal(false)}><X size={18}/></button><h2>New {page==='Dashboard'?'Record':page+' Record'}</h2><p>The record editor will be connected after the backend APIs and authorization rules are implemented.</p><div className="field"><label>Reference / Name</label><input placeholder="Enter reference"/></div>{saved&&<div className="success">Prototype only — no record was saved.</div>}<button className="primary" onClick={()=>setSaved(true)}>Try prototype</button></div></div>}
 </div>;
}
