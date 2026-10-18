<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

final class AccessController extends Controller
{
    public function index(): JsonResponse
    {
        $users=DB::table('users as u')->join('roles as r','r.id','=','u.role_id')->select('u.id','u.role_id','u.name','u.email','u.active','u.created_at','r.name as role_name','r.code as role_code')->orderBy('u.name')->get();
        $permissions=DB::table('permissions')->orderBy('code')->get();
        $rolePermissions=DB::table('role_permissions')->get()->groupBy('role_id');
        $roles=DB::table('roles')->orderBy('name')->get()->map(function($role)use($rolePermissions){$role->permission_ids=$rolePermissions->get($role->id,collect())->pluck('permission_id')->values();return $role;});
        return response()->json(compact('users','roles','permissions'));
    }

    public function storeUser(Request $request): JsonResponse
    {
        $data=$request->validate(['name'=>'required|string|max:160','email'=>'required|email|max:160|unique:users,email','role_id'=>'required|exists:roles,id','password'=>'required|string|min:8','active'=>'required|boolean']);
        $data['password']=Hash::make($data['password']);$data['created_at']=now();$data['updated_at']=now();
        $id=DB::table('users')->insertGetId($data);return response()->json(DB::table('users')->find($id),201);
    }

    public function updateUser(Request $request,int $id): JsonResponse
    {
        $data=$request->validate(['name'=>'required|string|max:160','email'=>['required','email','max:160',Rule::unique('users','email')->ignore($id)],'role_id'=>'required|exists:roles,id','password'=>'nullable|string|min:8','active'=>'required|boolean']);
        $current=(int)$request->attributes->get('auth_user')->id;abort_if($current===$id&&!$data['active'],422,'You cannot deactivate your own account.');
        if(empty($data['password']))unset($data['password']);else$data['password']=Hash::make($data['password']);$data['updated_at']=now();DB::table('users')->where('id',$id)->update($data);return response()->json(DB::table('users')->find($id));
    }

    public function deleteUser(Request $request,int $id): JsonResponse
    {
        abort_if((int)$request->attributes->get('auth_user')->id===$id,422,'You cannot delete your own account.');
        abort_unless(DB::table('users')->where('id',$id)->delete(),404,'User not found.');return response()->json(['message'=>'User deleted.']);
    }

    public function storeRole(Request $request): JsonResponse
    {
        $data=$this->roleData($request);$id=DB::transaction(function()use($data){$id=DB::table('roles')->insertGetId(['code'=>$data['code'],'name'=>$data['name'],'created_at'=>now(),'updated_at'=>now()]);$this->syncPermissions($id,$data['permission_ids']);return$id;});return response()->json(DB::table('roles')->find($id),201);
    }

    public function updateRole(Request $request,int $id): JsonResponse
    {
        $role=DB::table('roles')->find($id);abort_unless($role,404,'Role not found.');$data=$this->roleData($request,$id);DB::transaction(function()use($data,$id,$role){DB::table('roles')->where('id',$id)->update(['code'=>$role->code==='administrator'?'administrator':$data['code'],'name'=>$data['name'],'updated_at'=>now()]);$permissionIds=$data['permission_ids'];if($role->code==='administrator'){$adminPermission=DB::table('permissions')->where('code','admin.manage')->value('id');if($adminPermission)$permissionIds[]=$adminPermission;}$this->syncPermissions($id,$permissionIds);});return response()->json(DB::table('roles')->find($id));
    }

    public function deleteRole(int $id): JsonResponse
    {
        $role=DB::table('roles')->find($id);abort_unless($role,404,'Role not found.');abort_if($role->code==='administrator',422,'The Administrator role cannot be deleted.');abort_if(DB::table('users')->where('role_id',$id)->exists(),422,'Move users to another role before deleting this role.');DB::table('roles')->where('id',$id)->delete();return response()->json(['message'=>'Role deleted.']);
    }

    private function roleData(Request $request,?int $id=null): array
    {
        return $request->validate(['code'=>['required','alpha_dash','max:40',Rule::unique('roles','code')->ignore($id)],'name'=>'required|string|max:160','permission_ids'=>'required|array','permission_ids.*'=>'integer|exists:permissions,id']);
    }
    private function syncPermissions(int $roleId,array $permissionIds): void
    {
        DB::table('role_permissions')->where('role_id',$roleId)->delete();foreach(array_unique($permissionIds)as$permissionId)DB::table('role_permissions')->insert(['role_id'=>$roleId,'permission_id'=>$permissionId]);
    }
}
