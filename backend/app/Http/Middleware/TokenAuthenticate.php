<?php
namespace App\Http\Middleware;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
class TokenAuthenticate {
 public function handle(Request $request, Closure $next) {
  $plain=$request->bearerToken(); abort_unless($plain,401,'Authentication required.');
  $token=DB::table('access_tokens')->where('token_hash',hash('sha256',$plain))->where('expires_at','>',now())->first();
  abort_unless($token,401,'Your session is invalid or expired.');
  $user=DB::table('users as u')->join('roles as r','r.id','=','u.role_id')->where('u.id',$token->user_id)->where('u.active',true)->select('u.id','u.name','u.email','u.sales_rep_id','r.code as role_code','r.name as role_name')->first();
  abort_unless($user,401,'User account is unavailable.');
  $permissions=DB::table('role_permissions as rp')->join('permissions as p','p.id','=','rp.permission_id')->join('users as u','u.role_id','=','rp.role_id')->where('u.id',$user->id)->pluck('p.code')->all();
  $request->attributes->set('auth_user',$user);$request->attributes->set('permissions',$permissions);
  DB::table('access_tokens')->where('id',$token->id)->update(['last_used_at'=>now()]);
  return $next($request);
 }
}
