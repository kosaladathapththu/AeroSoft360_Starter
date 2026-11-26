import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
const dir=path.dirname(fileURLToPath(import.meta.url));
const source='AeroSoft360_Database_2026-11-20_130649.sql';
const sql=await fs.readFile('C:/Users/ASUS/Downloads/'+source,'utf8');
function table(name){
 const definition=sql.slice(sql.indexOf('CREATE TABLE `'+name+'`'));
 const cols=[...definition.slice(0,definition.indexOf('\n)')).matchAll(/^\s+`([^`]+)`/gm)].map(m=>m[1]);
 const marker='INSERT INTO `'+name+'` VALUES', start=sql.indexOf(marker);if(start<0)return [];
 const data=sql.slice(start+marker.length);let out=[],row=[],value='',quote=false,quoted=false,active=false;
 for(let i=0;i<data.length;i++){const c=data[i];if(quote){if(c==='\\')value+=data[++i];else if(c==="'"){if(data[i+1]==="'"){value+="'";i++;}else quote=false;}else value+=c;continue;}
 if(c==="'"){quote=true;quoted=true;continue;}if(c===';')break;
 if(c==='('){active=true;row=[];value='';quoted=false;}else if(active&&(c===','||c===')')){row.push(!quoted&&value.trim()==='NULL'?null:value.trim());value='';quoted=false;if(c===')'){if(row.length!==cols.length)throw Error(name+' column mismatch');out.push(Object.fromEntries(cols.map((k,j)=>[k,row[j]])));active=false;}}else if(active)value+=c;
 }return out;
}
const vouchers=table('payment_vouchers').sort((a,b)=>a.payment_date.localeCompare(b.payment_date)||Number(a.id)-Number(b.id));
const lines=table('payment_voucher_lines'),journalLines=table('journal_lines');
const map=(rows)=>new Map(rows.map(x=>[x.id,x]));
const accounts=map(table('accounts')),journals=map(table('journal_entries')),receipts=map(table('goods_receipts'));
const revisions=table('payment_voucher_revisions');
const excelDate=d=>d?Math.round((Date.parse(d.slice(0,10)+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000):null;
const wb=Workbook.create();const summary=wb.worksheets.add('Summary'),detail=wb.worksheets.add('Vouchers'),lineSheet=wb.worksheets.add('Payment lines');
const title=(s,text,end)=>{s.showGridLines=false;s.getRange(`A1:${end}80`).format.font.name='Arial';s.getRange(`A1:${end}80`).format.font.size=10;s.getRange('A2').values=[[text]];s.getRange('A2').format.font.size=16;s.getRange('A2').format.font.bold=true;s.getRange('A3').values=[['Snapshot: 20 November 2026, 13:06:49 (Asia/Colombo)']];};
title(summary,'Payment vouchers report','G');title(detail,'All payment vouchers (LKR)','U');title(lineSheet,'Original payment line details (LKR)','H');
detail.getRange('A4').values=[['Source: '+source]];
const heads=['Voucher','Payment date','Status','Payee','Purpose','Method','Payment account','Original amount','Cancelled amount','Current voucher amount','Net posted payment','Cancellation date','Cancellation reason','Original journal','Reversal journal','Revision of','Replaced by','Supplier receipt','Reference','Ledger check','Voucher ID'];
detail.getRange('A6:U6').values=[heads];
const rows=vouchers.map((v,i)=>{
 const from=revisions.find(r=>r.replacement_voucher_id===v.id),to=revisions.find(r=>r.original_voucher_id===v.id);
 const original=journals.get(v.journal_id),reversal=journals.get(v.reversal_journal_id);
 const vl=lines.filter(l=>l.payment_voucher_id===v.id);if(Math.round(vl.reduce((s,l)=>s+Number(l.amount),0)*100)!==Math.round(Number(v.total)*100))throw Error('Line mismatch '+v.number);
 let check='Not posted';
 if(v.status==='void'&&v.journal_id){const net={};const jl=journalLines.filter(l=>l.journal_entry_id===v.journal_id||l.journal_entry_id===v.reversal_journal_id);for(const l of jl)net[l.account_id]=(net[l.account_id]||0)+Math.round(Number(l.debit)*100)-Math.round(Number(l.credit)*100);
 check=original?.status==='posted'&&reversal?.status==='posted'&&reversal?.source_type==='payment_voucher_reversal'&&reversal?.source_id===v.id&&jl.length&&Object.values(net).every(n=>n===0)?'Reversed to zero':'CHECK REQUIRED';
 }else if(v.status==='posted')check=original?.status==='posted'?'Posted':'CHECK REQUIRED';
 if(check==='CHECK REQUIRED')throw Error(v.number+' ledger failed');
 return [v.number,excelDate(v.payment_date),v.status==='void'?(to?'Revised':'Cancelled'):v.status==='posted'?'Posted':'Draft',v.payee,v.description,v.payment_method.replaceAll('_',' '),accounts.get(v.payment_account_id)?.name??'',Number(v.total),null,null,null,excelDate(v.void_date),v.void_reason??'',original?.number??'',reversal?.number??'',vouchers.find(x=>x.id===from?.original_voucher_id)?.number??'',vouchers.find(x=>x.id===to?.replacement_voucher_id)?.number??'',receipts.get(v.goods_receipt_id)?.number??'',v.reference??'',check,Number(v.id)];
});
const last=6+rows.length;detail.getRange(`A7:U${last}`).values=rows;
for(let r=7;r<=last;r++){detail.getRange(`I${r}:K${r}`).formulas=[[`=IF(OR(C${r}="Cancelled",C${r}="Revised"),H${r},0)`,`=H${r}-I${r}`,`=IF(C${r}="Posted",H${r},0)`]];}
const lineRows=[];for(const v of vouchers)for(const l of lines.filter(l=>l.payment_voucher_id===v.id)){const a=accounts.get(l.account_id);lineRows.push([v.number,excelDate(v.payment_date),rows.find(r=>r[0]===v.number)[2],a?.code??'',a?.name??'',l.description,Number(l.amount),Number(l.id)]);}
lineSheet.getRange('A4').values=[['Original lines are retained for history. Cancelled lines do not represent current payments.']];
lineSheet.getRange('A6:H6').values=[['Voucher','Payment date','Status','Account code','Account name','Line description','Original line amount','Line ID']];
lineSheet.getRange(`A7:H${6+lineRows.length}`).values=lineRows;
summary.getRange('A5:D5').values=[['Status','Vouchers','Original amounts (LKR)','Net posted payments (LKR)']];
for(const [i,status] of ['Posted','Cancelled','Revised','Draft'].entries()){const r=i+6;summary.getRange(`A${r}`).values=[[status]];summary.getRange(`B${r}:D${r}`).formulas=[[`=COUNTIFS('Vouchers'!C7:C${last},A${r})`,`=SUMIFS('Vouchers'!H7:H${last},'Vouchers'!C7:C${last},A${r})`,`=SUMIFS('Vouchers'!K7:K${last},'Vouchers'!C7:C${last},A${r})`]];}
summary.getRange('A10:D10').values=[['Total',null,null,null]];summary.getRange('B10:D10').formulas=[['=SUM(B6:B9)','=SUM(C6:C9)','=SUM(D6:D9)']];
summary.getRange('A13').values=[['How to reconcile']];summary.getRange('A14').values=[['Net posted payments exclude cancelled/revised vouchers and unposted drafts.']];summary.getRange('A15').values=[['Cancellation reverses the original payment on its cancellation date.']];summary.getRange('A16').values=[['Earlier dated reports may include a payment until its reversal date.']];summary.getRange('A17').values=[['Current voucher amount retains draft values; net posted payment excludes drafts.']];summary.getRange('A19').values=[['Source: '+source]];
for(const [s,end,n] of [[detail,'U',last],[lineSheet,'H',6+lineRows.length]]){s.getRange(`A6:${end}6`).format.fill='#203D50';s.getRange(`A6:${end}6`).format.font.color='#FFFFFF';s.getRange(`A6:${end}6`).format.font.bold=true;s.getRange(`A6:${end}6`).format.wrapText=true;s.getRange(`A6:${end}6`).format.rowHeight=34;s.getRange(`A7:${end}${n}`).format.rowHeight=42;s.getRange(`A7:${end}${n}`).format.verticalAlignment='center';s.getRange(`A7:${end}${n}`).format.wrapText=true;s.getRange(`A6:${end}${n}`).format.columnWidth=20;s.freezePanes.freezeRows(6);s.tables.add(`A6:${end}${n}`,true,s===detail?'VouchersTable':'LinesTable');s.getRange(`B7:B${n}`).setNumberFormat('yyyy-mm-dd');}
detail.getRange(`H7:K${last}`).setNumberFormat('#,##0.00');detail.getRange(`L7:L${last}`).setNumberFormat('yyyy-mm-dd');detail.getRange('D6:E'+last).format.columnWidth=38;detail.getRange('M6:M'+last).format.columnWidth=35;
detail.getRange('H6:K'+last).format.columnWidth=26;
lineSheet.getRange(`G7:G${6+lineRows.length}`).setNumberFormat('#,##0.00');lineSheet.getRange('E6:F'+(6+lineRows.length)).format.columnWidth=38;
summary.getRange('A5:D5').format.fill='#203D50';summary.getRange('A5:D5').format.font.color='#FFFFFF';summary.getRange('A5:D5').format.wrapText=true;summary.getRange('A5:D5').format.rowHeight=38;summary.getRange('A5:D10').format.columnWidth=25;summary.getRange('A5:A10').format.columnWidth=18;summary.getRange('B5:B10').format.columnWidth=13;summary.getRange('C6:D10').setNumberFormat('#,##0.00');summary.getRange('A10:D10').format.font.bold=true;summary.getRange('A10:D10').format.fill='#E5EDF2';summary.getRange('A13').format.font.bold=true;
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'Summary!A5:D10',include:'values,formulas',tableMaxRows:6,tableMaxCols:4})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:10},summary:'Formula errors'})).ndjson);
for(const [s,range,name] of [['Summary','A1:F19','summary'],['Vouchers','A5:K10','vouchers'],['Vouchers','L5:U10','history'],['Payment lines','A5:G10','lines']]){const blob=await wb.render({sheetName:s,range,scale:1.5,format:'png'});await fs.writeFile(path.join(dir,name+'.png'),new Uint8Array(await blob.arrayBuffer()));}
const output=await SpreadsheetFile.exportXlsx(wb);await output.save(path.join(dir,'Payment-Vouchers-Report-2026-11-20.xlsx'));
console.log(JSON.stringify({vouchers:rows.length,lines:lineRows.length,original:rows.reduce((s,r)=>s+r[7],0),posted:rows.filter(r=>r[2]==='Posted').reduce((s,r)=>s+r[7],0)}));
