<?php

namespace App\Http\Controllers\Api;

use App\Services\Reporting\CustomerProfileService;
use Illuminate\Http\Request;

final class CustomerProfileController
{
    public function show(Request $r, int $id, CustomerProfileService $service)
    {
        $d = $r->validate(['as_of'=>'nullable|date']);
        return response()->json($service->profile($id, $d['as_of'] ?? now()->timezone('Asia/Colombo')->toDateString()));
    }
}
