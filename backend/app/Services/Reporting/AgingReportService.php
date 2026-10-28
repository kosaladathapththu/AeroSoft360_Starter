<?php
namespace App\Services\Reporting;
use Illuminate\Support\Facades\DB;
class AgingReportService {
 public function report(string $asOf):array {
  $paid=collect();
  if(\Illuminate\Support\Facades\Schema::hasTable('payment_vouchers')){
   $paid=DB::table('payment_vouchers')->whereNotNull('goods_receipt_id')->whereNotNull('journal_id')->whereDate('payment_date','<=',$asOf)
    ->where(function($q)use($asOf){$q->where('status','posted')->orWhere(function($q)use($asOf){$q->where('status','void')->whereDate('void_date','>',$asOf);});})
    ->select('goods_receipt_id',DB::raw('SUM(total) as paid'))->groupBy('goods_receipt_id')->pluck('paid','goods_receipt_id');
  }
  $rows=DB::table('goods_receipts as g')->join('suppliers as s','s.id','=','g.supplier_id')->where('g.status','posted')->whereDate('g.received_on','<=',$asOf)
   ->select('g.id','g.number','g.supplier_invoice','g.received_on','g.total','s.code as supplier_code','s.name as supplier_name','s.payment_days')->orderBy('s.name')->orderBy('g.received_on')->get()->map(function($x)use($asOf,$paid){
    $due=date('Y-m-d',strtotime($x->received_on.' +'.$x->payment_days.' days'));
    $days=(int)floor((strtotime($asOf)-strtotime($due))/86400);
    $bucket=$days<=0?'current':($days<=30?'days_1_30':($days<=60?'days_31_60':($days<=90?'days_61_90':'days_90_plus')));
    return ['id'=>$x->id,'receipt'=>$x->number,'invoice'=>$x->supplier_invoice?:$x->number,'supplier_code'=>$x->supplier_code,'supplier'=>$x->supplier_name,'invoice_date'=>$x->received_on,'due_date'=>$due,'days_overdue'=>max(0,$days),'outstanding'=>max(0,round((float)$x->total-(float)$paid->get($x->id,0),2)),'bucket'=>$bucket];
   })->filter(fn($row)=>$row['outstanding']>0)->values()->all();
  $totals=['current'=>0.0,'days_1_30'=>0.0,'days_31_60'=>0.0,'days_61_90'=>0.0,'days_90_plus'=>0.0,'total'=>0.0];
  foreach($rows as $row){$totals[$row['bucket']]+=$row['outstanding'];$totals['total']+=$row['outstanding'];}
  return ['as_of'=>$asOf,'rows'=>$rows,'totals'=>$totals];
 }
 public function excel(array $report):string {$rows=[['SUPUN AEROSOFT (PVT) LTD'],['318, K. Cyril C. Perera Mawatha, Colombo 13'],['Accounts Payable Aging Report'],['As of',$report['as_of']],['Generated',date('Y-m-d H:i')],[],['Supplier','Invoice','Invoice Date','Due Date','Days Overdue','Current','1-30 Days','31-60 Days','61-90 Days','90+ Days','Outstanding']];foreach($report['rows'] as $r){$amount=$r['outstanding'];$rows[]=[$r['supplier_code'].' '.$r['supplier'],$r['invoice'],$r['invoice_date'],$r['due_date'],$r['days_overdue'],$r['bucket']==='current'?$amount:0,$r['bucket']==='days_1_30'?$amount:0,$r['bucket']==='days_31_60'?$amount:0,$r['bucket']==='days_61_90'?$amount:0,$r['bucket']==='days_90_plus'?$amount:0,$amount];}$t=$report['totals'];$rows[]=['TOTAL','','','','',$t['current'],$t['days_1_30'],$t['days_31_60'],$t['days_61_90'],$t['days_90_plus'],$t['total']];return $this->xml($rows,$report['as_of']);}
 private function xml(array $rows,string $asOf):string {$x='<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default"><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14" ss:Color="#17365D"/></Style><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#17365D" ss:Pattern="Solid"/></Style><Style ss:ID="Money"><NumberFormat ss:Format="#,##0.00"/></Style><Style ss:ID="Total"><Font ss:Bold="1"/><Interior ss:Color="#DCEBED" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style></Styles><Worksheet ss:Name="AP Aging"><Table>';for($i=0;$i<11;$i++)$x.='<Column ss:Width="110"/>';foreach($rows as $i=>$row){$x.='<Row>';foreach($row as $v){$style=in_array($i,[0,2],true)?'Title':($i===6?'Header':($i===count($rows)-1?'Total':(is_numeric($v)?'Money':'Default')));$x.='<Cell ss:StyleID="'.$style.'"><Data ss:Type="'.(is_numeric($v)?'Number':'String').'">'.htmlspecialchars((string)$v,ENT_XML1|ENT_QUOTES,'UTF-8').'</Data></Cell>';}$x.='</Row>';}$x.='</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><PageSetup><Header x:Data="&amp;CSupun AeroSoft (Pvt) Ltd" xmlns:x="urn:schemas-microsoft-com:office:excel"/><Footer x:Data="&amp;LAccounts Payable Aging&amp;CPage &amp;P of &amp;N&amp;RAs of '.$asOf.'" xmlns:x="urn:schemas-microsoft-com:office:excel"/></PageSetup><FreezePanes/><FrozenNoSplit/><SplitHorizontal>7</SplitHorizontal><TopRowBottomPane>7</TopRowBottomPane></WorksheetOptions></Worksheet></Workbook>';return $x;}
}
