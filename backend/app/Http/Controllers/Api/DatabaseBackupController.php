<?php
namespace App\Http\Controllers\Api;

use App\Services\DatabaseBackupService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class DatabaseBackupController
{
    public function download(Request $request, DatabaseBackupService $service)
    {
        $backup = $service->create();
        try {
            DB::table('audit_logs')->insert([
                'event'=>'database.backup_download', 'entity_type'=>'database', 'entity_id'=>0,
                'payload'=>json_encode(['actor_id'=>$request->attributes->get('auth_user')->id, 'filename'=>$backup['filename']]),
                'created_at'=>now(),
            ]);
            return response()->download($backup['path'], $backup['filename'], [
                'Content-Type'=>'application/octet-stream', 'Cache-Control'=>'private, no-store, max-age=0',
                'Pragma'=>'no-cache', 'X-Content-Type-Options'=>'nosniff',
            ])->deleteFileAfterSend(true);
        } catch (\Throwable $exception) { ($backup['cleanup'])(); throw $exception; }
    }
}
