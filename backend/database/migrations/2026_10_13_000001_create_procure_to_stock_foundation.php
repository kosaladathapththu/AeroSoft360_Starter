<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
 public function up():void {
  Schema::create('suppliers',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->string('code',30)->unique();$t->string('name',160);$t->string('phone',30)->nullable();$t->unsignedSmallInteger('payment_days')->default(30);$t->string('status',20)->default('active');$t->timestamps();}));
  Schema::create('materials',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->string('code',40)->unique();$t->string('name',160);$t->string('category',30);$t->string('unit',20);$t->boolean('active')->default(true);$t->timestamps();}));
  Schema::create('accounts',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->string('code',20)->unique();$t->string('name');$t->string('type',20);$t->boolean('is_postable')->default(true);$t->timestamps();}));
  Schema::create('accounting_periods',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->string('name');$t->date('starts_on');$t->date('ends_on');$t->string('status',20)->default('open');$t->timestamps();}));
  Schema::create('purchase_orders',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->string('number')->unique();$t->foreignId('supplier_id')->constrained();$t->date('order_date');$t->date('expected_date')->nullable();$t->string('status',30)->default('draft');$t->decimal('total',18,2);$t->timestamp('approved_at')->nullable();$t->timestamps();}));
  Schema::create('purchase_order_lines',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();$t->foreignId('material_id')->constrained();$t->decimal('quantity',18,4);$t->decimal('received_quantity',18,4)->default(0);$t->decimal('unit_cost',18,4);$t->decimal('line_total',18,2);$t->timestamps();$t->unique(['purchase_order_id','material_id']);}));
  Schema::create('goods_receipts',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->string('number')->unique();$t->foreignId('purchase_order_id')->constrained();$t->foreignId('supplier_id')->constrained();$t->date('received_on');$t->string('supplier_invoice')->nullable();$t->string('status',20);$t->decimal('total',18,2);$t->timestamp('posted_at');$t->timestamps();}));
  Schema::create('goods_receipt_lines',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->foreignId('goods_receipt_id')->constrained()->cascadeOnDelete();$t->foreignId('purchase_order_line_id')->constrained();$t->foreignId('material_id')->constrained();$t->string('batch_number',80);$t->decimal('quantity',18,4);$t->decimal('unit_cost',18,4);$t->decimal('line_total',18,2);$t->timestamps();}));
  Schema::create('stock_movements',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->foreignId('material_id')->constrained();$t->string('batch_number',80);$t->string('movement_type',40);$t->decimal('quantity',18,4);$t->decimal('unit_cost',18,4);$t->string('source_type');$t->unsignedBigInteger('source_id');$t->string('event_key')->unique();$t->dateTime('occurred_at');$t->timestamp('created_at')->useCurrent();}));
  Schema::create('stock_balances',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->foreignId('material_id')->constrained();$t->string('batch_number',80);$t->decimal('quantity',18,4)->default(0);$t->decimal('unit_cost',18,4);$t->timestamp('updated_at')->nullable();$t->unique(['material_id','batch_number']);}));
  Schema::create('journal_entries',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->string('number')->unique();$t->foreignId('accounting_period_id')->constrained();$t->string('source_type');$t->unsignedBigInteger('source_id');$t->date('posting_date');$t->string('description');$t->string('status',20);$t->timestamp('posted_at');$t->timestamps();$t->unique(['source_type','source_id']);}));
  Schema::create('journal_lines',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->foreignId('journal_entry_id')->constrained()->cascadeOnDelete();$t->foreignId('account_id')->constrained();$t->decimal('debit',18,2)->default(0);$t->decimal('credit',18,2)->default(0);$t->string('description')->nullable();$t->timestamps();}));
  Schema::create('audit_logs',fn(Blueprint $t)=>tap($t,function($t){$t->id();$t->string('event');$t->string('entity_type');$t->unsignedBigInteger('entity_id');$t->json('payload');$t->timestamp('created_at')->useCurrent();}));
 }
 public function down():void {foreach(['audit_logs','journal_lines','journal_entries','stock_balances','stock_movements','goods_receipt_lines','goods_receipts','purchase_order_lines','purchase_orders','accounting_periods','accounts','materials','suppliers'] as $table)Schema::dropIfExists($table);}
};
