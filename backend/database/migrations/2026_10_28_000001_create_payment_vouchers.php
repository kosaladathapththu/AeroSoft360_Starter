<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
 public function up(): void {
  Schema::create('payment_vouchers', function(Blueprint $t) {
   $t->id(); $t->string('number',40)->nullable()->unique(); $t->string('kind',20);
   $t->date('payment_date'); $t->string('payee',160); $t->string('payment_method',20);
   $t->foreignId('payment_account_id')->constrained('accounts');
   $t->foreignId('goods_receipt_id')->nullable()->constrained('goods_receipts');
   $t->string('reference',100)->nullable(); $t->string('description',500);
   $t->decimal('total',18,2); $t->string('status',20)->default('draft');
   $t->foreignId('journal_id')->nullable()->constrained('journal_entries');
   $t->foreignId('reversal_journal_id')->nullable()->constrained('journal_entries');
   $t->unsignedBigInteger('created_by')->nullable(); $t->unsignedBigInteger('posted_by')->nullable();
   $t->timestamp('posted_at')->nullable(); $t->date('void_date')->nullable();
   $t->timestamp('voided_at')->nullable(); $t->unsignedBigInteger('voided_by')->nullable();
   $t->string('void_reason',500)->nullable(); $t->timestamps();
   $t->index(['goods_receipt_id','status','payment_date']);
  });
  Schema::create('payment_voucher_lines', function(Blueprint $t) {
   $t->id(); $t->foreignId('payment_voucher_id')->constrained()->cascadeOnDelete();
   $t->foreignId('account_id')->constrained('accounts'); $t->string('description',255);
   $t->decimal('amount',18,2); $t->timestamps();
  });
 }
 public function down(): void { Schema::dropIfExists('payment_voucher_lines'); Schema::dropIfExists('payment_vouchers'); }
};
