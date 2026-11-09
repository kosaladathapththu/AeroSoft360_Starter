import { useState } from "react";
import { financeRequest } from "./finance-utils";

export default function InventoryCountImport({api,token}: {api:string;token:string}) {
  const [kind,setKind]=useState("finished");
  const [rows,setRows]=useState<any[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[reason,setReason]=useState(""),[key,setKey]=useState("");
  async function download() {
    setBusy(true); setMessage("");
    try {
      const response=await fetch(api+"/inventory-count/template?kind="+kind,{headers:{Authorization:"Bearer "+token}});
      if(!response.ok) throw new Error("Unable to download stock template.");
      const url=URL.createObjectURL(await response.blob()); const link=document.createElement("a");
      link.href=url;link.download=kind==="raw"?"Material_Stock_Counts.xlsx":"Article_Stock_Counts.xlsx";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(error){setMessage((error as Error).message);} finally{setBusy(false);}
  }
  async function preview(file:File) {
    setRows([]);setMessage("");setBusy(true);
    try {
      const body=new FormData();body.append("file",file);
      const response=await fetch(api+"/inventory-count/preview",{method:"POST",headers:{Authorization:"Bearer "+token,Accept:"application/json"},body});
      const result=await response.json();
      if(!response.ok) throw new Error(Object.values(result.errors||{}).flat().join(" ")||result.message||"Unable to read workbook.");
      setRows(result.rows);setKey(crypto.randomUUID());
    }catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
  }
  return <section className="inventory-count-import" style={{background:"white",border:"1px solid #bdcec7",borderRadius:12,padding:20,marginBottom:20}}>
    <h2>Update inventory from Excel</h2><label>Inventory type<select value={kind} disabled={busy} onChange={e=>{setKind(e.target.value);setRows([]);setMessage("");}}><option value="finished">Articles / finished goods</option><option value="raw">Raw materials / batches</option></select></label>
    <p>Download current articles and sizes. Fill the yellow New quantity column, then upload and review. Blank leaves stock unchanged; 0 clears that size. Quantities replace current counts, rather than adding them again.</p>
    <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap",margin:"16px 0"}}>
      <button type="button" disabled={busy} onClick={download}>Download Excel template</button>
      <label>Upload completed template <input type="file" accept=".xlsx" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file)void preview(file);event.target.value="";}}/></label>
    </div>
    <small>Stock is tracked per article and size across colours. Configure missing sizes in Pricing List first. Raw material differences also post inventory adjustment journals.</small>
    {message&&<p role="status">{message}</p>}
    {busy&&<p role="status">Processing...</p>}
    {rows.length>0&&<><h3>Review {rows.length} stock counts</h3><div style={{maxHeight:360,overflow:"auto"}}><table><thead><tr>{["Article","Size","Current","New quantity","Change"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.code+":"+row.size}><td>{row.code} / {row.name}</td><td>{row.size}</td><td>{row.expected}</td><td><b>{row.quantity}</b></td><td>{row.difference>0?"+":""}{row.difference}</td></tr>)}</tbody></table></div>
      <label>Reason for update<input value={reason} maxLength={255} onChange={e=>setReason(e.target.value)} placeholder="Physical stock count / opening inventory"/></label>
      <button type="button" disabled={busy||reason.trim().length<3} onClick={async()=>{
        setBusy(true);setMessage("");try{const result=await financeRequest(api,token,"inventory-count/apply",{rows:rows.map(({code,size,expected,quantity,kind,unit_cost})=>({code,size,expected,quantity,kind,unit_cost})),reason,import_key:key},"POST");setMessage(result.message);setRows([]);}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
      }}>Apply reviewed stock counts</button><button type="button" disabled={busy} onClick={()=>setRows([])}>Discard preview</button>
    </>}
  </section>;
}
