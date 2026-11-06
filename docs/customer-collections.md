# Customer collections and dated cheques

## Record a customer payment

1. Open Sales > Collections > Record collection.
2. Search for and select the customer. Their invoices appear together, oldest first, with invoice dates, salespeople, original bill values and unpaid balances. Settled invoices are shown but cannot be ticked for payment.
3. Enter the total collected, collection date, payment method and collector.
4. Tick the invoices covered by that payment and enter the exact amount in each This payment box. Close invoice fills the full unpaid balance for that invoice. Your amounts are not redistributed when the collected total changes. Each row shows the remaining balance and full/partial settlement. Use Selected balances to fill all ticked balances, or explicitly choose Auto-fill oldest first as a shortcut. All invoice payments must add up to the amount collected. For example, from LKR 180,000 you may close a LKR 97,000 invoice and pay LKR 83,000 toward another invoice, regardless of their dates.
5. Tick Apply in the Commission column only where commission is intended. Choose each invoice's salesperson or the collector as recipient. Existing per-piece and collection-day rules apply; opening balances never earn commission. Eligibility is assessed on the original collection date. A cheque's commission is not released before clearing.
6. Save. The whole collection and all allocations post together. Any invalid invoice, excess amount or closed accounting period rejects the entire collection. Repeated submission of the same request does not duplicate it.

Invoices outside the selected customer cannot be allocated. Searching the invoice table does not change the ticks. All collected money must be allocated; customer advances and unallocated money are not silently created by this screen.

## Cheques

Select Cheque and enter the cheque number, bank/branch and cheque date (including future post-dates). No cash account is selected at receipt: the system uses **1120 - Cheques in Hand**, a non-cash current asset in the chart of accounts. If a Current Assets or Assets non-posting header exists, this account is created under it. Otherwise it is a separate asset account; its code and accounting role are reserved.

Receipt posts Dr Cheques in Hand / Cr Accounts Receivable. The customer debt is provisionally covered, while the cheque remains clearly pending clearance. The customer panel separately shows unpaid invoices and pending cheque value. Holding balances do not count as available cash or bank cash flow.

Open Collections > Cheques & collections to search the register and filter held, cleared, returned or cash/bank collections. The register retains allocated invoice amounts, collector, dates, cheque details and commission recipient/amount. Earlier individual receipts remain in Payment History; they are not automatically converted into new collection records.

### Clear a cheque

Choose Clear, enter the actual clearance date and receiving bank/cash account, then confirm. The clearance date must be on/after both the cheque date and receipt date, and cannot be in the future. An open accounting period is required.

Clearing posts Dr Bank / Cr Cheques in Hand. Eligible ticked commission is posted Dr Commission Expense / Cr Commission Payable and is included in payroll's clearance period. Ticking commission does not bypass the existing eligibility policy.

### Return a cheque

Choose Return, enter the actual return date and a clear reason, then confirm. This works for both an uncleared cheque and a previously cleared cheque. The return cannot precede receipt or clearance and requires an open accounting period.

For a previously cleared cheque, the bank reversal first passes through Cheques in Hand (Dr Cheques / Cr Bank), with any automatically accrued commission reversed. Then Dr Accounts Receivable / Cr Cheques restores the original unpaid invoice allocations. An uncleared return needs only this second step. The returned cheque remains in the register as historical evidence, rather than being counted as a collectible cheque asset and an unpaid invoice at the same time. A replacement payment is recorded as a new collection.

Customer balances, dated aging, dashboard receivables and customer ledger return entries follow the return date. Original receipt/allocation records are retained. Duplicate clearance or return is rejected. Existing closed payroll payments are not rewritten; any already-paid commission recovery is a separate management/payroll decision.

## Compatibility and controls

- POS cheque checkouts use the same holding and clearance workflow and require cheque details; cash/card/bank POS behavior is unchanged.
- New grouped collection receipts cannot be deleted/edited through the old individual receipt or commission actions. This protects the shared allocation and cheque journals. Separate audited manual commission adjustments remain available for management corrections.
- Historical receipts, including earlier cheques that had been recorded directly as cash, are preserved. They require a deliberate accounting review if reclassification is needed; this release does not invent historical clearance dates.
- Cash/bank collections use active, postable cash/bank accounts from the chart of accounts. Cheques in Hand is deliberately excluded from cash-account selectors.

## Installation

The development database has the new migration installed. A private local backup was created first; existing customer, invoice and receipt counts were unchanged.

For hosting, back up the live database and application folders, install the matching code, preserve `.env`, APP_KEY and storage, then run the specific migration using the domain's PHP version:

```sh
cd /home/camymarket/aerosoft360
/opt/cpanel/ea-php82/root/usr/bin/php artisan config:clear
/opt/cpanel/ea-php82/root/usr/bin/php artisan migrate --path=database/migrations/2026_11_06_000001_create_customer_collections.php --force
/opt/cpanel/ea-php82/root/usr/bin/php artisan route:clear
/opt/cpanel/ea-php82/root/usr/bin/php artisan view:clear
```

Stop if account 1120 is already used for another purpose. Resolve the conflict before proceeding. Do not import an old database dump, reset tables, run seeders or regenerate keys. The previously generated hosting ZIP predates this feature; a new matching release package is needed before deploying it.

## Verification

`backend/tests/verify_customer_collections.php` uses an isolated SQLite database to check full/partial payments, idempotency, ownership, stale balances, amount matching, holding-account isolation, early/duplicate clearance, bank/uncleared returns, commission reversal, dated aging, subledger reconciliation and atomic rollback.

`frontend/tests/verify-collection-plan.cjs` checks deterministic oldest-first allocations, cent arithmetic, settled invoices and unallocated money. Browser checks use synthetic customers/invoices and intercept submissions; no real collection is created for verification.
