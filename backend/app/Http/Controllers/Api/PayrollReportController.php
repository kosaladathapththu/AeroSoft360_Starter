<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use App\Services\Reporting\FinancialReportService;
use App\Services\Reporting\ExcelStatementExporter;
class PayrollReportController extends Controller {
 public function payroll():JsonResponse {return response()->json(['employees'=>DB::table('employees')->orderBy('employee_no')->get(),'runs'=>DB::table('payroll_runs')->latest('period_end')->get()->map(function($run){$run->items=DB::table('payroll_items as i')->join('employees as e','e.id','=','i.employee_id')->where('i.payroll_run_id',$run->id)->select('i.*','e.employee_no','e.name','e.department')->get();return $run;})]);}
 public function reports():JsonResponse {
  $stock=DB::table('stock_balances')->selectRaw('COALESCE(SUM(quantity*unit_cost),0) value')->value('value');
  return response()->json([
   'summary'=>['suppliers'=>DB::table('suppliers')->count(),'purchase_orders'=>DB::table('purchase_orders')->count(),'purchase_value'=>(float)DB::table('purchase_orders')->sum('total'),'stock_value'=>(float)$stock,'employees'=>DB::table('employees')->where('status','active')->count(),'latest_payroll'=>(float)(DB::table('payroll_runs')->latest('period_end')->value('net_total')??0),'journals'=>DB::table('journal_entries')->count()],
   'payroll_by_department'=>DB::table('payroll_items as i')->join('employees as e','e.id','=','i.employee_id')->select('e.department',DB::raw('SUM(i.net_salary) total'))->groupBy('e.department')->get(),
   'purchase_by_status'=>DB::table('purchase_orders')->select('status',DB::raw('COUNT(*) records'),DB::raw('SUM(total) total'))->groupBy('status')->get(),
  ]);
 }
 public function financialStatements(Request $request,FinancialReportService $service):JsonResponse {$data=$request->validate(['from'=>['nullable','date'],'to'=>['nullable','date']]);$from=$data['from']??now()->startOfYear()->toDateString();$to=$data['to']??now()->toDateString();return response()->json($service->statements($from,$to));}
 public function exportFinancialStatements(Request $request,FinancialReportService $service,ExcelStatementExporter $exporter) {$data=$request->validate(['from'=>['nullable','date'],'to'=>['nullable','date'],'report'=>['nullable','in:all,summary,profit_loss,balance_sheet,cash_flow,trial_balance']]);$from=$data['from']??now()->startOfYear()->toDateString();$to=$data['to']??now()->toDateString();$report=$data['report']??'all';$xml=$exporter->make($service->statements($from,$to),$report);$label=str_replace('_','-',ucwords($report,'_'));return response($xml,200,['Content-Type'=>'application/vnd.ms-excel; charset=UTF-8','Content-Disposition'=>'attachment; filename="AeroSoft360_'.$label.'_'.$to.'.xls"','Cache-Control'=>'no-store']);}
}
