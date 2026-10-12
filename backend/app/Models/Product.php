<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $table = 'aero_products';
    protected $guarded = [];

    public function productionBatches(): HasMany
    {
        return $this->hasMany(ProductionBatch::class, 'product_id');
    }
}
