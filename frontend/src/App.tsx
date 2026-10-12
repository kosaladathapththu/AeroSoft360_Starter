import { useState } from 'react';
import { LayoutDashboard, Factory, Boxes, ShoppingCart, Truck, Receipt, Landmark, Users, ChartColumn, Settings, Search, Bell, ChevronRight, Menu, Plus, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { systemKpis, systemTables } from './systemData';

type Module = { label: string; icon: LucideIcon; detail: string };
type Capability = { title: string; description: string; status: 'Foundation' | 'Planned' | 'Needs approval' };
const modules: Module[] = [
  { label:'Dashboard', icon: LayoutDashboard, detail:'Company-wide operational overview' },
  { label:'Footwear Production', icon: Factory, detail:'Footwear BOMs, production orders, batches, configurable stages and quality control' },
  { label:'Materials & Inventory', icon: Boxes, detail:'Raw materials, packing, WIP, size/color variants and finished footwear' },
  { label:'Purchasing & GRN', icon: Truck, detail:'Material suppliers, purchase orders, receiving, quality checks and payables' },
  { label:'Sales, Sets & Reps', icon: ShoppingCart, detail:'Footwear sets, size-wise orders, dispatch, invoices, representatives and credit control' },
  { label:'Collections & Commission', icon: Receipt, detail:'Receipts, cheque clearance, rep handovers and 100-day commission' },
  { label:'Finance & General Ledger', icon: Landmark, detail:'General Ledger, journals, statements, banking and tax records' },
  { label:'HR & Payroll', icon: Users, detail:'Employees, attendance imports, payroll and approvals' },
  { label:'Costing & Management', icon: ChartColumn, detail:'Footwear batch costs, budgets, variances and profitability' },
  { label:'Settings & Roles', icon: Settings, detail:'Editable roles, approval rules and business settings' },
];
const navigationGroups = [
  { label: 'Overview', items: ['Dashboard'] },
  { label: 'Footwear Operations', items: ['Footwear Production', 'Materials & Inventory', 'Purchasing & GRN', 'Sales, Sets & Reps', 'Collections & Commission'] },
  { label: 'Finance & People', items: ['Finance & General Ledger', 'HR & Payroll', 'Costing & Management'] },
  { label: 'Administration', items: ['Settings & Roles'] },
];
const workflow = [ {title:'Material purchasing',description:'Supplier → PO → GRN → Supplier invoice'}, {title:'Production',description:'BOM → Material issue → Stage updates → QA'}, {title:'Sales',description:'Finished stock → Dispatch → Invoice'}, {title:'Finance',description:'Payment → Verified receipt → Journal posting'} ];
const capabilities: Record<string, Capability[]> = {
  'Footwear Production': [
    {title:'Versioned BOMs',description:'Variant quantities, unit conversions, wastage and effective dates.',status:'Foundation'},
    {title:'Production batches',description:'Stage input, accepted output, rejection, rework and WIP history.',status:'Foundation'},
    {title:'Batch costing',description:'Material, labour and overhead allocation requires approved accounting rules.',status:'Needs approval'},
  ],
  'Materials & Inventory': [
    {title:'Batch stock ledger',description:'Immutable movements by SKU, batch, warehouse, location and stock type.',status:'Foundation'},
    {title:'Stock controls',description:'Reservations, quarantine, damaged goods and negative-stock prevention.',status:'Foundation'},
    {title:'Specific batch valuation',description:'Selected in the SRS but requires accounting-policy validation by material class.',status:'Needs approval'},
  ],
  'Purchasing & GRN': [
    {title:'Purchase orders',description:'Supplier, prices, expected dates, approval and partial receipt tracking.',status:'Foundation'},
    {title:'GRN and quality checks',description:'Accepted/rejected quantities and receipt batch creation.',status:'Foundation'},
    {title:'Three-way matching',description:'PO, GRN and supplier invoice tolerance workflow.',status:'Planned'},
  ],
  'Sales, Sets & Reps': [
    {title:'Configurable sets',description:'Expand approved templates into exact size and colour variant quantities.',status:'Foundation'},
    {title:'Order-to-invoice flow',description:'Customer PO, sales order, dispatch and invoice without repeated entry.',status:'Planned'},
    {title:'Returns and credit',description:'Full-set or selected-piece returns with quality disposition.',status:'Planned'},
  ],
  'Collections & Commission': [
    {title:'Receipt allocation',description:'Allocate one receipt across invoices and retain unallocated advances.',status:'Foundation'},
    {title:'100-day commission',description:'Proportional commission on eligible cleared collections.',status:'Foundation'},
    {title:'Cheque edge cases',description:'Eligibility date and post-dishonour treatment need business sign-off.',status:'Needs approval'},
  ],
  'Finance & General Ledger': [
    {title:'General ledger',description:'Balanced, idempotent journals with source references and fiscal periods.',status:'Foundation'},
    {title:'Period control',description:'Locking, backdating approval and traceable reversals.',status:'Planned'},
    {title:'Financial statements',description:'Trial Balance, P&L, Balance Sheet and cash-flow classifications.',status:'Planned'},
  ],
  'HR & Payroll': [
    {title:'Attendance rules',description:'Configurable weekday, Saturday and Sunday calculations from the July workbook.',status:'Foundation'},
    {title:'Payroll workflow',description:'HR review, Finance approval, posting, payment and immutable corrections.',status:'Planned'},
    {title:'Statutory bases',description:'EPF, ETF and APIT bases must be approved before production use.',status:'Needs approval'},
  ],
  'Costing & Management': [
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
 const [page,setPage]=useState('Dashboard'); const [menu,setMenu]=useState(false);const [collapsed,setCollapsed]=useState(false);const [filter,setFilter]=useState('');const [modal,setModal]=useState(false); const [saved,setSaved]=useState(false);const [reference,setReference]=useState('');const [createdRows,setCreatedRows]=useState<Record<string,string[][]>>({});
 const openModal=()=>{setSaved(false);setReference('');setModal(true)};
 const saveRecord=()=>{const value=reference.trim();const table=systemTables[page];if(!value||!table)return;const row=[value,...table.columns.slice(1).map(()=> 'New')];setCreatedRows(rows=>({...rows,[page]:[...(rows[page]??[]),row]}));setSaved(true)};
 return <div className={'shell '+(collapsed?'sidebar-collapsed':'')}>
   {menu&&<button className="sidebar-scrim" aria-label="Close navigation" onClick={()=>setMenu(false)}/>}
   <aside className={'sidebar '+(menu?'open ':'')+(collapsed?'collapsed':'')} aria-label="Primary navigation">
     <div className="identity"><img className="brand-logo" src="/assets/ymac-smart-logo.png" alt="Y-MAC SMART"/><button className="mobile-close" onClick={()=>setMenu(false)} aria-label="Close menu"><X size={18}/></button></div>
     <nav className="sidebar-nav">{navigationGroups.map(group=><div className="nav-group" key={group.label}><div className="section-label">{group.label}</div>{group.items.map(label=>{const m=modules.find(item=>item.label===label)!;return <button title={collapsed?m.label:undefined} aria-current={page===m.label?'page':undefined} key={m.label} onClick={()=>{setPage(m.label);setMenu(false);setSaved(false)}} className={'nav '+(page===m.label?'active':'')}><m.icon size={19}/><span>{m.label}</span>{page===m.label&&<ChevronRight className="nav-arrow" size={15}/>}</button>})}</div>)}</nav>
     <div className="sidebar-footer"><div className="sidebar-bottom"><div className="avatar">SA</div><div className="profile-copy"><strong>Super Admin</strong><small>Business workspace</small></div></div><button className="collapse-toggle" onClick={()=>setCollapsed(value=>!value)} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'}>{collapsed?<PanelLeftOpen size={18}/>:<><PanelLeftClose size={18}/><span>Collapse sidebar</span></>}</button></div>
   </aside>
   <main className="main"><header className="topbar"><button className="hamburger" aria-label="Open menu" onClick={()=>setMenu(true)}><Menu size={22}/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> <b>{page}</b></div><div className="top-actions"><div className="search"><Search size={16}/><input placeholder="Search modules" value={filter} onChange={e=>setFilter(e.target.value)}/></div><Bell size={19}/><span className="user-bubble">SA</span></div></header>
     <section className="body"><div className="heading"><div><div className="eyebrow">Y-MAC SMART / {page.toUpperCase()}</div><h1>{page==='Dashboard'?'Footwear Business Overview':page}</h1></div>{page!=='Dashboard'&&<button className="primary" onClick={openModal}><Plus size={17}/> New Record</button>}</div>
     {page==='Dashboard'?<><div className="stats">{systemKpis.map((s,i)=><div className="stat" key={s.title}><span>{s.title}</span><strong>{s.value}</strong><small>{s.note}</small><span className={'spark spark-'+i}/></div>)}</div><div className="columns"><div className="panel"><div className="panel-title"><h2>ERP Business Flow</h2></div><div className="flow-list">{workflow.map((w,i)=><div className="flow-item" key={w.title}><div className="num">{String(i+1).padStart(2,'0')}</div><div><b>{w.title}</b></div><ChevronRight size={16}/></div>)}</div></div><div className="panel"><div className="panel-title"><h2>Quick Access</h2></div><div className="shortcuts">{modules.slice(1,7).map(m=><button key={m.label} onClick={()=>setPage(m.label)}><m.icon size={20}/><span>{m.label}</span><ChevronRight size={15}/></button>)}</div></div></div></>:<div className="panel data-panel"><div className="panel-title"><h2>Records</h2></div><div className="table-scroll"><table><thead><tr>{systemTables[page].columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>{[...systemTables[page].rows,...(createdRows[page]??[])].map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,cellIndex)=><td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div></div>}
     {filter.trim()&&<div className="panel search-results"><h2>Matching modules</h2>{modules.filter(m=>m.label.toLowerCase().includes(filter.toLowerCase())).map(m=><button key={m.label} onClick={()=>{setPage(m.label);setFilter('')}}>{m.label} →</button>)}</div>}
     </section>
   </main>
   {modal&&<div className="backdrop" onClick={()=>setModal(false)}><div role="dialog" aria-modal="true" aria-label="New record" className="modal" onClick={e=>e.stopPropagation()}><button className="close" aria-label="Close" onClick={()=>setModal(false)}><X size={18}/></button><h2>New {page} Record</h2><div className="field"><label>Reference / Name</label><input placeholder="Enter reference" value={reference} onChange={event=>{setReference(event.target.value);setSaved(false)}}/></div>{saved&&<div className="success">Record added to the table.</div>}<button className="primary" disabled={!reference.trim()||saved} onClick={saveRecord}>{saved?'Added':'Add record'}</button></div></div>}
 </div>;
}
