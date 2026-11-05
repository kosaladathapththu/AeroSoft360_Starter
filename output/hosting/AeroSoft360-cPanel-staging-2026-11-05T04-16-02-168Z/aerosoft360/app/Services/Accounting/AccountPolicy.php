<?php
namespace App\Services\Accounting;

final class AccountPolicy
{
    public static function active(object $account): bool
    {
        return (bool) ($account->is_active ?? true) && (bool) $account->is_postable;
    }
    public static function cash(object $account): bool
    {
        return $account->type === "asset" &&
            (bool) ($account->is_cash_account ?? str_starts_with($account->code, "10"));
    }
}
