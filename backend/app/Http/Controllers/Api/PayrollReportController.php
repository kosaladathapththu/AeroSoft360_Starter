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
 public function storeEmployee(Request $request):JsonResponse {$data=$this->employeeData($request);$id=DB::table('employees')->insertGetId($data+['created_at'=>now(),'updated_at'=>now()]);return response()->json(DB::table('employees')->find($id),201);}
 public function updateEmployee(Request $request,int $employee):JsonResponse {abort_unless(DB::table('employees')->where('id',$employee)->exists(),404,'Employee not found.');$data=$this->employeeData($request,$employee);DB::table('employees')->where('id',$employee)->update($data+['updated_at'=>now()]);return response()->json(DB::table('employees')->find($employee));}
 public function deleteEmployee(int $employee):JsonResponse {abort_if(DB::table('payroll_items')->where('employee_id',$employee)->exists(),422,'Employee has payroll history and cannot be deleted. Set the employee to inactive instead.');abort_unless(DB::table('employees')->where('id',$employee)->delete()===1,404,'Employee not found.');return response()->json(['message'=>'Employee deleted.']);}
 public function updatePayrollRun(Request $request,int $payrollRun):JsonResponse {$data=$request->validate(['period_start'=>['required','date'],'period_end'=>['required','date','after_or_equal:period_start'],'status'=>['required','in:draft,approved,posted,void']]);abort_unless(DB::table('payroll_runs')->where('id',$payrollRun)->update($data+['updated_at'=>now()])===1,404,'Payroll run not found.');return response()->json(DB::table('payroll_runs')->find($payrollRun));}
 public function deletePayrollRun(int $payrollRun):JsonResponse {DB::transaction(function()use($payrollRun){DB::table('payroll_items')->where('payroll_run_id',$payrollRun)->delete();abort_unless(DB::table('payroll_runs')->where('id',$payrollRun)->delete()===1,404,'Payroll run not found.');});return response()->json(['message'=>'Payroll run deleted.']);}
 private function employeeData(Request $request,?int $id=null):array {return $request->validate(['employee_no'=>['required','string','max:30',\Illuminate\Validation\Rule::unique('employees','employee_no')->ignore($id)],'name'=>['required','string','max:255'],'department'=>['required','string','max:80'],'designation'=>['required','string','max:80'],'basic_salary'=>['required','numeric','gte:0'],'status'=>['required','in:active,inactive']]);}
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
