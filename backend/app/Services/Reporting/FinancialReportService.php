<?php
namespace App\Services\Reporting;
use Illuminate\Support\Facades\DB;
class FinancialReportService {
 public function statements(string $from,string $to):array {
  $rows=DB::table('accounts as a')->leftJoin('journal_lines as l','l.account_id','=','a.id')->leftJoin('journal_entries as j',function($join)use($from,$to){$join->on('j.id','=','l.journal_entry_id')->where('j.status','posted')->whereBetween('j.posting_date',[$from,$to]);})->select('a.code','a.name','a.type',DB::raw('COALESCE(SUM(l.debit),0) debit'),DB::raw('COALESCE(SUM(l.credit),0) credit'))->groupBy('a.id','a.code','a.name','a.type')->orderBy('a.code')->get();
  $trial=$rows->map(fn($x)=>['code'=>$x->code,'account'=>$x->name,'type'=>$x->type,'debit'=>(float)$x->debit,'credit'=>(float)$x->credit,'balance'=>(float)$x->debit-(float)$x->credit])->values()->all();
  $income=array_values(array_map(fn($x)=>$x+['amount'=>$x['credit']-$x['debit']],array_filter($trial,fn($x)=>$x['type']==='income')));
  $expenses=array_values(array_map(fn($x)=>$x+['amount'=>$x['debit']-$x['credit']],array_filter($trial,fn($x)=>$x['type']==='expense')));
  $assets=array_values(array_map(fn($x)=>$x+['amount'=>$x['debit']-$x['credit']],array_filter($trial,fn($x)=>$x['type']==='asset')));
  $liabilities=array_values(array_map(fn($x)=>$x+['amount'=>$x['credit']-$x['debit']],array_filter($trial,fn($x)=>$x['type']==='liability')));
  $equity=array_values(array_map(fn($x)=>$x+['amount'=>$x['credit']-$x['debit']],array_filter($trial,fn($x)=>$x['type']==='equity')));
  $revenue=array_sum(array_column($income,'amount'));$expense=array_sum(array_column($expenses,'amount'));$profit=$revenue-$expense;
  $assetTotal=array_sum(array_column($assets,'amount'));$liabilityTotal=array_sum(array_column($liabilities,'amount'));$equityTotal=array_sum(array_column($equity,'amount'))+$profit;$liabilityEquityTotal=$liabilityTotal+$equityTotal;
  $cashAccounts=array_filter($trial,fn($x)=>str_starts_with($x['code'],'10')||stripos($x['account'],'cash')!==false||stripos($x['account'],'bank')!==false);
  $cashNet=array_sum(array_column($cashAccounts,'balance'));
  return ['period'=>['from'=>$from,'to'=>$to],'profit_loss'=>['income'=>$income,'expenses'=>$expenses,'revenue'=>$revenue,'expenses_total'=>$expense,'net_profit'=>$profit],'balance_sheet'=>['assets'=>$assets,'liabilities'=>$liabilities,'equity'=>$equity,'current_profit'=>$profit,'assets_total'=>$assetTotal,'liabilities_total'=>$liabilityTotal,'equity_total'=>$equityTotal,'liabilities_equity_total'=>$liabilityEquityTotal,'difference'=>$assetTotal-$liabilityEquityTotal],'cash_flow'=>['operating'=>$profit,'investing'=>0.0,'financing'=>0.0,'net_change'=>$cashNet],'trial_balance'=>$trial];
 }
}
