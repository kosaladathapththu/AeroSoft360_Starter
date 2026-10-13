<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
class AuthController extends Controller {
 public function login(Request $request):JsonResponse {
  $data=$request->validate(['email'=>['required','email'],'password'=>['required','string']]);
  $user=DB::table('users')->where('email',$data['email'])->where('active',true)->first();
  abort_unless($user&&Hash::check($data['password'],$user->password),422,'The email or password is incorrect.');
  $plain=Str::random(64);DB::table('access_tokens')->insert(['user_id'=>$user->id,'token_hash'=>hash('sha256',$plain),'expires_at'=>now()->addHours(12),'created_at'=>now(),'updated_at'=>now()]);
  return response()->json($this->profile($user->id)+['token'=>$plain]);
 }
 public function me(Request $request):JsonResponse {return response()->json($this->profile($request->attributes->get('auth_user')->id));}
 public function logout(Request $request):JsonResponse {DB::table('access_tokens')->where('token_hash',hash('sha256',$request->bearerToken()))->delete();return response()->json(['message'=>'Signed out.']);}
 private function profile(int $id):array {$u=DB::table('users as u')->join('roles as r','r.id','=','u.role_id')->where('u.id',$id)->select('u.id','u.name','u.email','r.code as role_code','r.name as role_name')->first();$p=DB::table('role_permissions as rp')->join('permissions as p','p.id','=','rp.permission_id')->where('rp.role_id',DB::table('users')->where('id',$id)->value('role_id'))->pluck('p.code')->all();return ['user'=>$u,'permissions'=>$p];}
}
