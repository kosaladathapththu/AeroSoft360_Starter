<?php
namespace App\Http\Middleware;
use Closure;
use Illuminate\Http\Request;
class RequirePermission
{
    public function handle(Request $request, Closure $next, string $permission)
    {
        abort_unless(
            in_array($permission, $request->attributes->get("permissions", []), true),
            403,
            "You do not have permission for this action.",
        );
        return $next($request);
    }
}
