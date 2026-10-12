<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class SystemStatusController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['application' => 'AeroSoft360', 'status' => 'starter', 'version' => '0.1.0']);
    }
}
