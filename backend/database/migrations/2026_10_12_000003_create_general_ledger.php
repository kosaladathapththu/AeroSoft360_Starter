<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up(): void {
  Schema::create('aero_gl_accounts',function(Blueprint $t){$t->id();$t->string('code')->unique();$t->string('name');$t->string('type',30);$t->foreignId('parent_id')->nullable()->constrained('aero_gl_accounts');$t->boolean('postable')->default(true);$t->timestamps();});
  Schema::create('aero_fiscal_periods',function(Blueprint $t){$t->id();$t->string('code')->unique();$t->date('starts_on');$t->date('ends_on');$t->boolean('is_closed')->default(false);$t->timestamps();});
  Schema::create('aero_journal_entries',function(Blueprint $t){$t->id();$t->string('journal_no')->unique();$t->string('source_type',100);$t->string('source_id',100);$t->string('event_key',180)->unique();$t->foreignId('period_id')->constrained('aero_fiscal_periods');$t->date('posted_on');$t->string('status')->default('posted');$t->foreignId('posted_by')->nullable()->constrained('users')->nullOnDelete();$t->timestamps();$t->unique(['source_type','source_id','event_key'],'aero_journal_source_unique');});
  Schema::create('aero_journal_lines',function(Blueprint $t){$t->id();$t->foreignId('journal_entry_id')->constrained('aero_journal_entries');$t->foreignId('account_id')->constrained('aero_gl_accounts');$t->decimal('debit',20,4)->default(0);$t->decimal('credit',20,4)->default(0);$t->string('memo')->nullable();$t->timestamps();});
 }
 public function down(): void {foreach(['aero_journal_lines','aero_journal_entries','aero_fiscal_periods','aero_gl_accounts'] as $table) Schema::dropIfExists($table);}
};
