<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
 public function up(): void {
  Schema::table('aero_products',function(Blueprint $t){$t->foreignId('unit_id')->nullable()->constrained('aero_units');$t->string('product_type',30)->default('finished_good');});
  Schema::create('aero_inventory_batches',function(Blueprint $t){$t->id();$t->foreignId('product_variant_id')->constrained('aero_product_variants');$t->string('batch_no');$t->date('received_on');$t->decimal('unit_cost',20,4);$t->string('status',30)->default('available');$t->timestamps();$t->unique(['product_variant_id','batch_no']);});
  Schema::create('aero_stock_movements',function(Blueprint $t){$t->id();$t->foreignId('batch_id')->constrained('aero_inventory_batches');$t->foreignId('location_id')->constrained('aero_locations');$t->string('movement_type',40);$t->decimal('quantity',20,4);$t->decimal('unit_cost',20,4);$t->string('source_type',100);$t->unsignedBigInteger('source_id');$t->string('event_key',180)->unique();$t->text('reason')->nullable();$t->foreignId('created_by')->constrained('users');$t->timestamp('occurred_at');$t->timestamps();$t->index(['batch_id','location_id','occurred_at']);});
  Schema::create('aero_purchase_orders',function(Blueprint $t){$t->id();$t->string('po_no')->unique();$t->foreignId('supplier_id')->constrained('aero_suppliers');$t->date('order_date');$t->date('expected_date')->nullable();$t->string('status',30)->default('draft');$t->char('currency',3)->default('LKR');$t->decimal('total',20,4)->default(0);$t->foreignId('created_by')->constrained('users');$t->timestamps();});
  Schema::create('aero_purchase_order_lines',function(Blueprint $t){$t->id();$t->foreignId('purchase_order_id')->constrained('aero_purchase_orders');$t->foreignId('product_variant_id')->constrained('aero_product_variants');$t->decimal('quantity',20,4);$t->decimal('unit_price',20,4);$t->decimal('tax_amount',20,4)->default(0);$t->timestamps();});
  Schema::create('aero_goods_receipts',function(Blueprint $t){$t->id();$t->string('grn_no')->unique();$t->foreignId('purchase_order_id')->constrained('aero_purchase_orders');$t->date('received_on');$t->string('status',30)->default('draft');$t->foreignId('received_by')->constrained('users');$t->timestamps();});
  Schema::create('aero_goods_receipt_lines',function(Blueprint $t){$t->id();$t->foreignId('goods_receipt_id')->constrained('aero_goods_receipts');$t->foreignId('purchase_order_line_id')->constrained('aero_purchase_order_lines');$t->foreignId('batch_id')->nullable()->constrained('aero_inventory_batches');$t->decimal('accepted_quantity',20,4)->default(0);$t->decimal('rejected_quantity',20,4)->default(0);$t->string('quality_status',30)->default('pending');$t->timestamps();});
 }
 public function down(): void {foreach(['aero_goods_receipt_lines','aero_goods_receipts','aero_purchase_order_lines','aero_purchase_orders','aero_stock_movements','aero_inventory_batches'] as $table) Schema::dropIfExists($table);Schema::table('aero_products',function(Blueprint $t){$t->dropConstrainedForeignId('unit_id');$t->dropColumn('product_type');});}
};
