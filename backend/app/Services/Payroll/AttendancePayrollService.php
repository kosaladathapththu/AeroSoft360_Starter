<?php

namespace App\Services\Payroll;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;

class AttendancePayrollService
{
    public function import(UploadedFile $file, string $from, string $to): array
    {
        $sheet = IOFactory::load($file->getRealPath())
            ->getActiveSheet()
            ->toArray(null, true, true, false);
        $headers = array_map(
            fn($value) => strtolower(trim(str_replace([" ", "-"], "_", strval($value)))),
            $sheet[0] ?? [],
        );
        foreach (["employee_no", "date", "status"] as $header) {
            if (!in_array($header, $headers, true)) {
                throw ValidationException::withMessages([
                    "file" => "Missing required column: $header",
                ]);
            }
        }
        $rows = [];
        $warnings = [];
        foreach (array_slice($sheet, 1) as $index => $values) {
            $row = array_combine($headers, array_pad($values, count($headers), null));
            if (empty($row["employee_no"])) {
                continue;
            }
            $employee = DB::table("employees")
                ->where("employee_no", trim($row["employee_no"]))
                ->first();
            if (!$employee) {
                $warnings[] =
                    "Row " . ($index + 2) . ": employee " . $row["employee_no"] . " not found.";
                continue;
            }
            $date = is_numeric($row["date"])
                ? Date::excelToDateTimeObject($row["date"])->format("Y-m-d")
                : date("Y-m-d", strtotime($row["date"]));
            $state = strtolower(trim($row["status"]));
            $paid = in_array($state, ["present", "paid_leave", "holiday", "off", "half_day"], true)
                ? ($state === "half_day"
                    ? 0.5
                    : 1)
                : 0;
            $noPay = in_array($state, ["absent", "no_pay", "nopay"], true)
                ? 1
                : ($state === "half_day"
                    ? 0.5
                    : 0);
            $rows[] = [
                "employee_id" => $employee->id,
                "attendance_date" => $date,
                "attendance_status" => $state,
                "paid_days" => $paid,
                "no_pay_days" => $noPay,
                "overtime_hours" => (float) ($row["overtime_hours"] ?? ($row["ot_hours"] ?? 0)),
            ];
        }
        if (!$rows) {
            throw ValidationException::withMessages([
                "file" => "No valid attendance records were found.",
            ]);
        }
        $id = DB::transaction(function () use ($file, $from, $to, $rows, $warnings) {
            $id = DB::table("attendance_imports")->insertGetId([
                "file_name" => $file->getClientOriginalName(),
                "period_start" => $from,
                "period_end" => $to,
                "record_count" => count($rows),
                "status" => "validated",
                "warnings" => json_encode($warnings),
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            foreach ($rows as $row) {
                DB::table("attendance_records")->insert(
                    $row + [
                        "attendance_import_id" => $id,
                        "created_at" => now(),
                        "updated_at" => now(),
                    ],
                );
            }
            return $id;
        });
        return ["import" => DB::table("attendance_imports")->find($id), "warnings" => $warnings];
    }

    public function calculate(int $importId): object
    {
        return DB::transaction(function () use ($importId) {
            $import = DB::table("attendance_imports")->lockForUpdate()->find($importId);
            abort_unless($import, 404, "Attendance import not found.");
            abort_if(
                DB::table("payroll_runs")->where("attendance_import_id", $importId)->exists(),
                422,
                "Payroll has already been calculated for this attendance import.",
            );
            $employeeIds = DB::table("attendance_records")
                ->where("attendance_import_id", $importId)
                ->distinct()
                ->pluck("employee_id");
            $employees = DB::table("employees")
                ->where("status", "active")
                ->whereIn("id", $employeeIds)
                ->get();
            abort_if(
                $employees->isEmpty(),
                422,
                "No active employees were matched in this attendance import.",
            );
            $runId = DB::table("payroll_runs")->insertGetId([
                "attendance_import_id" => $importId,
                "number" =>
                    "PAY-" .
                    date("Y-m", strtotime($import->period_end)) .
                    "-" .
                    str_pad(
                        (string) (DB::table("payroll_runs")->count() + 1),
                        3,
                        "0",
                        STR_PAD_LEFT,
                    ),
                "period_start" => $import->period_start,
                "period_end" => $import->period_end,
                "status" => "draft",
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            $gross = $deductions = $net = 0;
            foreach ($employees as $employee) {
                $attendance = DB::table("attendance_records")
                    ->where("attendance_import_id", $importId)
                    ->where("employee_id", $employee->id)
                    ->selectRaw(
                        "COALESCE(SUM(paid_days),0) paid, COALESCE(SUM(no_pay_days),0) no_pay, COALESCE(SUM(overtime_hours),0) overtime",
                    )
                    ->first();
                $daily = round(
                    $employee->basic_salary / max(1, (float) $employee->monthly_working_days),
                    2,
                );
                $noPayAmount = round($daily * $attendance->no_pay, 2);
                $hourly = $employee->basic_salary / max(1, (float) $employee->standard_month_hours);
                $otAmount = round(
                    $hourly * $employee->overtime_multiplier * $attendance->overtime,
                    2,
                );
                $epf = round($employee->basic_salary * ($employee->epf_rate / 100), 2);
                $commission = $this->commissionFor(
                    $employee->name,
                    $import->period_start,
                    $import->period_end,
                );
                $itemGross =
                    $employee->basic_salary +
                    $employee->fixed_allowance +
                    $employee->fixed_incentive +
                    $commission +
                    $otAmount;
                $itemDeduction = $epf + $employee->fixed_deduction + $noPayAmount;
                $itemNet = $itemGross - $itemDeduction;
                DB::table("payroll_items")->insert([
                    "payroll_run_id" => $runId,
                    "employee_id" => $employee->id,
                    "paid_days" => $attendance->paid,
                    "no_pay_days" => $attendance->no_pay,
                    "no_pay_amount" => $noPayAmount,
                    "overtime_hours" => $attendance->overtime,
                    "basic_salary" => $employee->basic_salary,
                    "allowances" => $employee->fixed_allowance,
                    "overtime" => $otAmount,
                    "incentive" => $employee->fixed_incentive,
                    "commission" => $commission,
                    "epf_employee" => $epf,
                    "other_deductions" => $employee->fixed_deduction,
                    "net_salary" => $itemNet,
                    "created_at" => now(),
                    "updated_at" => now(),
                ]);
                $gross += $itemGross;
                $deductions += $itemDeduction;
                $net += $itemNet;
            }
            DB::table("payroll_runs")
                ->where("id", $runId)
                ->update([
                    "gross_total" => $gross,
                    "deduction_total" => $deductions,
                    "net_total" => $net,
                    "updated_at" => now(),
                ]);
            DB::table("attendance_imports")
                ->where("id", $importId)
                ->update(["status" => "processed", "updated_at" => now()]);
            return DB::table("payroll_runs")->find($runId);
        });
    }

    private function commissionFor(string $employeeName, string $from, string $to): float
    {
        $repId = DB::table("sales_representatives")
            ->whereRaw("LOWER(name) = ?", [strtolower(trim($employeeName))])
            ->value("id");
        if (!$repId) {
            return 0;
        }
        $automatic = (float) DB::table("receipt_allocations as a")
            ->join("customer_receipts as r", "r.id", "=", "a.receipt_id")
            ->where("r.sales_rep_id", $repId)
            ->whereBetween("r.receipt_date", [$from, $to])
            ->where("a.commission_status", "eligible")
            ->sum("a.commission_amount");
        $manual = Schema::hasTable("manual_commissions")
            ? (float) DB::table("manual_commissions")
                ->where("sales_rep_id", $repId)
                ->whereBetween("commission_date", [$from, $to])
                ->where("status", "eligible")
                ->sum("commission_amount")
            : 0;
        return round($automatic + $manual, 2);
    }
}
