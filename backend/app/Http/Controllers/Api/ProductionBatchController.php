<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductionBatch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductionBatchController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(ProductionBatch::query()
            ->with('product:id,code,name')
            ->latest('id')
            ->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $batch = ProductionBatch::create($data)->load('product:id,code,name');

        return response()->json($batch, 201);
    }

    public function update(Request $request, ProductionBatch $productionBatch): JsonResponse
    {
        $data = $request->validate($this->rules($productionBatch->id));
        $productionBatch->update($data);

        return response()->json($productionBatch->fresh()->load('product:id,code,name'));
    }

    public function destroy(ProductionBatch $productionBatch): JsonResponse
    {
        $productionBatch->delete();

        return response()->json(null, 204);
    }

    private function rules(?int $batchId = null): array
    {
        return [
            'batch_no' => ['required', 'string', 'max:100', Rule::unique('aero_production_batches')->ignore($batchId)],
            'product_id' => ['required', 'integer', 'exists:aero_products,id'],
            'planned_quantity' => ['required', 'integer', 'min:1'],
            'accepted_quantity' => ['required', 'integer', 'min:0', 'lte:planned_quantity'],
            'rejected_quantity' => ['required', 'integer', 'min:0', 'lte:planned_quantity'],
            'status' => ['required', Rule::in(['draft', 'materials_reserved', 'in_production', 'qa_complete', 'completed', 'cancelled'])],
            'started_on' => ['nullable', 'date'],
        ];
    }
}
