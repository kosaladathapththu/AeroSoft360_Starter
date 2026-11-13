<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('customer_collections', function (Blueprint $table) {
            $table->string('void_reason', 500)->nullable();
            $table->unsignedBigInteger('replaces_collection_id')->nullable()->unique();
        });
        Schema::table('customer_collection_lines', function (Blueprint $table) {
            $table->decimal('balance_before', 18, 2)->nullable();
            $table->decimal('balance_after', 18, 2)->nullable();
            $table->text('invoice_snapshot')->nullable();
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Collection settlement and correction history must be retained.');
    }
};
