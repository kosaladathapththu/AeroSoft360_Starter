<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void
    {
        Schema::create(
            "employees",
            fn(Blueprint $t) => tap($t, function ($t) {
                $t->id();
                $t->string("employee_no", 30)->unique();
                $t->string("name");
                $t->string("department", 80);
                $t->string("designation", 80);
                $t->decimal("basic_salary", 18, 2);
                $t->string("status", 20)->default("active");
                $t->timestamps();
            }),
        );
        Schema::create(
            "payroll_runs",
            fn(Blueprint $t) => tap($t, function ($t) {
                $t->id();
                $t->string("number")->unique();
                $t->date("period_start");
                $t->date("period_end");
                $t->string("status", 20)->default("draft");
                $t->decimal("gross_total", 18, 2)->default(0);
                $t->decimal("deduction_total", 18, 2)->default(0);
                $t->decimal("net_total", 18, 2)->default(0);
                $t->timestamps();
            }),
        );
        Schema::create(
            "payroll_items",
            fn(Blueprint $t) => tap($t, function ($t) {
                $t->id();
                $t->foreignId("payroll_run_id")->constrained()->cascadeOnDelete();
                $t->foreignId("employee_id")->constrained();
                $t->decimal("basic_salary", 18, 2);
                $t->decimal("allowances", 18, 2)->default(0);
                $t->decimal("overtime", 18, 2)->default(0);
                $t->decimal("incentive", 18, 2)->default(0);
                $t->decimal("epf_employee", 18, 2)->default(0);
                $t->decimal("other_deductions", 18, 2)->default(0);
                $t->decimal("net_salary", 18, 2);
                $t->timestamps();
                $t->unique(["payroll_run_id", "employee_id"]);
            }),
        );
    }
    public function down(): void
    {
        Schema::dropIfExists("payroll_items");
        Schema::dropIfExists("payroll_runs");
        Schema::dropIfExists("employees");
    }
};
