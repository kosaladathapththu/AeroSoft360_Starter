<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
 public function up():void {
  Schema::table('accounts',function(Blueprint $t){$t->boolean('is_active')->default(true);$t->boolean('is_cash_account')->default(false);$t->boolean('is_system')->default(false);$t->string('cash_flow_activity',20)->default('unclassified');$t->string('description',500)->nullable();});
  DB::table('accounts')->where('type','asset')->where('code','like','10%')->update(['is_cash_account'=>true]);
  DB::table('accounts')->whereIn('type',['expense','income'])->orWhereIn('code',['1100','1300','2100','2210','2250','2260','2300'])->update(['cash_flow_activity'=>'operating']);
  DB::table('accounts')->where('type','equity')->update(['cash_flow_activity'=>'financing']);
  DB::table('accounts')->whereIn('code',['1000','1100','1300','2100','2210','2250','2260','2300','4000','5000','5100','5200','5300','5400','5500'])->update(['is_system'=>true]);
  Schema::table('customer_receipts',fn(Blueprint $t)=>$t->foreignId('payment_account_id')->nullable()->constrained('accounts'));
  DB::table('customer_receipts')->update(['payment_account_id'=>DB::table('accounts')->where('code','1000')->value('id')]);
 }
 public function down():void {
  Schema::table('customer_receipts',function(Blueprint $t){$t->dropForeign(['payment_account_id']);$t->dropColumn('payment_account_id');});
  Schema::table('accounts',fn(Blueprint $t)=>$t->dropColumn(['is_active','is_cash_account','is_system','cash_flow_activity','description']));
 }
};
