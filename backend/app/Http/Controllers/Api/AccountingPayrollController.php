<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Accounting\PostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class AccountingPayrollController extends Controller
{
    public function updatePayrollRun(
        Request $request,
        int $payrollRun,
        PayrollReportController $payroll,
        PostingService $posting,
    ): JsonResponse {
        return DB::transaction(function () use ($request, $payrollRun, $payroll, $posting) {
            $existing = DB::table("payroll_runs")->lockForUpdate()->find($payrollRun);
            abort_unless($existing, 404, "Payroll run not found.");
            $response = $payroll->updatePayrollRun($request, $payrollRun);
            $run = $response->getData(true);
            if ($run["status"] === "posted") {
                $gross = (float) $run["gross_total"];
                $deductions = (float) $run["deduction_total"];
                $net = (float) $run["net_total"];
                $journalId = $posting->post(
                    "payroll_run",
                    (int) $run["id"],
                    $run["period_end"],
                    "Payroll {$run["number"]}",
                    [
                        [
                            "account_code" => "5100",
                            "debit" => $gross,
                            "credit" => 0,
                            "description" => "Payroll and direct labour expense",
                        ],
                        [
                            "account_code" => "2210",
                            "debit" => 0,
                            "credit" => $deductions,
                            "description" => "Payroll deductions payable",
                        ],
                        [
                            "account_code" => "2250",
                            "debit" => 0,
                            "credit" => $net,
                            "description" => "Net salaries payable",
                        ],
                    ],
                );
                $run["journal_id"] = $journalId;
                DB::table("audit_logs")->insert([
                    "event" => "payroll.posted",
                    "entity_type" => "payroll_run",
                    "entity_id" => $payrollRun,
                    "payload" => json_encode(["journal_id" => $journalId, "gross" => $gross]),
                    "created_at" => now(),
                ]);
            }
            return response()->json($run);
        });
    }
}
