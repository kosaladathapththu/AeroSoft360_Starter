<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

final class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        DB::table("accounts")->insert([
            [
                "code" => "1300",
                "name" => "Inventory - Raw Materials",
                "type" => "asset",
                "is_postable" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "code" => "2100",
                "name" => "Goods Received Not Invoiced",
                "type" => "liability",
                "is_postable" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
        ]);
        DB::table("accounting_periods")->insert([
            "name" => "Initial open period",
            "starts_on" => "2026-01-01",
            "ends_on" => "2027-03-31",
            "status" => "open",
            "created_at" => $now,
            "updated_at" => $now,
        ]);
        DB::table("materials")->insert([
            [
                "code" => "SOLE-EVA-01",
                "name" => "EVA Sole",
                "category" => "raw_material",
                "unit" => "PCS",
                "active" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "code" => "BOX-YMAC-L",
                "name" => "Y-MAC Shoe Box Large",
                "category" => "packing",
                "unit" => "PCS",
                "active" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
        ]);
        DB::table("roles")->insert([
            [
                "id" => 1,
                "code" => "administrator",
                "name" => "Administrator",
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "id" => 2,
                "code" => "reporting",
                "name" => "Reporting Only",
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "id" => 3,
                "code" => "stock_operator",
                "name" => "Stock / GRN Operator",
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "id" => 4,
                "code" => "viewer",
                "name" => "Full-System Viewer",
                "created_at" => $now,
                "updated_at" => $now,
            ],
        ]);
        DB::table("permissions")->insert([
            [
                "id" => 1,
                "code" => "workspace.view",
                "name" => "View workspace and reports",
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "id" => 2,
                "code" => "suppliers.manage",
                "name" => "Manage suppliers",
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "id" => 3,
                "code" => "purchases.manage",
                "name" => "Manage purchase orders",
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "id" => 4,
                "code" => "purchases.approve",
                "name" => "Approve purchase orders",
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "id" => 5,
                "code" => "stock.manage",
                "name" => "Manage stock and goods receipts",
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "id" => 6,
                "code" => "accounting.manage",
                "name" => "Manage accounting journals",
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "id" => 7,
                "code" => "admin.manage",
                "name" => "Manage users, roles and permissions",
                "created_at" => $now,
                "updated_at" => $now,
            ],
        ]);
        DB::table("role_permissions")->insert([
            ["role_id" => 1, "permission_id" => 1],
            ["role_id" => 1, "permission_id" => 2],
            ["role_id" => 1, "permission_id" => 3],
            ["role_id" => 1, "permission_id" => 4],
            ["role_id" => 1, "permission_id" => 5],
            ["role_id" => 1, "permission_id" => 6],
            ["role_id" => 1, "permission_id" => 7],
            ["role_id" => 2, "permission_id" => 1],
            ["role_id" => 3, "permission_id" => 1],
            ["role_id" => 3, "permission_id" => 5],
            ["role_id" => 4, "permission_id" => 1],
        ]);
        DB::table("users")->insert([
            [
                "role_id" => 1,
                "name" => "Administrator",
                "email" => "admin@aerosoft360.lk",
                "password" => Hash::make("Admin@123"),
                "active" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "role_id" => 2,
                "name" => "Reporting User",
                "email" => "reports@aerosoft360.lk",
                "password" => Hash::make("Report@123"),
                "active" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "role_id" => 3,
                "name" => "Stock Operator",
                "email" => "stock@aerosoft360.lk",
                "password" => Hash::make("Stock@123"),
                "active" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "role_id" => 4,
                "name" => "System Viewer",
                "email" => "viewer@aerosoft360.lk",
                "password" => Hash::make("Viewer@123"),
                "active" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
        ]);
    }
}
