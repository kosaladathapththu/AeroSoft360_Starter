<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up(): void {
  Schema::create('aero_products',function(Blueprint $t){$t->id();$t->string('code')->unique();$t->string('name');$t->string('category')->nullable();$t->boolean('is_active')->default(true);$t->timestamps();});
  Schema::create('aero_product_variants',function(Blueprint $t){$t->id();$t->foreignId('product_id')->constrained('aero_products');$t->string('sku')->unique();$t->string('size',32);$t->string('color',80);$t->timestamps();$t->unique(['product_id','size','color']);});
  Schema::create('aero_production_batches',function(Blueprint $t){$t->id();$t->string('batch_no')->unique();$t->foreignId('product_id')->constrained('aero_products');$t->string('status')->default('draft');$t->date('started_on')->nullable();$t->timestamps();});
 }
 public function down(): void {foreach(['aero_production_batches','aero_product_variants','aero_products'] as $table) Schema::dropIfExists($table);}
};
