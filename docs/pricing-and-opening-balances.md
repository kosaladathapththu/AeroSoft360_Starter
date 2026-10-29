# Fixed rates and opening balances

PO and manual invoice article cards show the price-list **Fixed rate / piece** alongside an optional **Given rate / piece**. Leaving the given rate blank uses each size's fixed rate. Giving a rate applies it to the selected sizes/colours for that article. Dispatch invoicing and invoicing from a PO allow a rate per size.

The given rate determines line totals, invoice adjustments, receivables and revenue. The fixed rate is reference information and is not added to the total. New PO fixed prices are saved per size and carried to the sales order and invoice; subsequent catalog changes do not reprice them. Invoice bills, profile item details, product sales reports and PO downloads show both rates. Older records without a price snapshot show “Not recorded”; their historical fixed price is not guessed.

Customer creation, including the New customer option in a PO/sales order, accepts an optional opening amount, balance date, original due date, balance type and equity account. A receivable opening debits 1100 Accounts Receivable and credits the selected equity account (default 3990 Opening Balance Equity). Customer credit reverses those sides. These are brought-forward documents, not new sales or cash payments. Opening receivables can be paid through Collections without sales commission. Customer credit stays separate from unpaid invoices and is not automatically allocated to them.

The customer profile and customer ledger include opening entries by date. Aging uses the original due date. Sales and receipt turnover exclude opening entries. Trial balance, balance sheet and account ledgers include their posted journals. Cash flow excludes cash opening entries from movement totals and includes them in opening cash.

Chart of Accounts → **Opening balances** posts a one-time debit or credit opening for an active balance-sheet account, against 3990. The date must be on/before its first transaction and in an open accounting period. Direct openings to 1100/2100 control accounts are blocked to avoid duplicating party balances. Posted opening documents cannot be changed through normal invoice, receipt or customer-contact edits; use an accountant-reviewed correcting journal when needed.

Checks: `php backend/tests/verify_customer_openings.php`, `php backend/tests/verify_fixed_rates.php`, `node frontend/tests/verify-rates.cjs`.

## Rollout note — 29 October 2026

The full migration queue also ran the previously pending `2026_10_22_000004_seed_temporary_finished_goods_stock` migration. That older migration writes quantity 50 to every finished-goods stock row. The audit history contains an earlier temporary fill to 50 on 22 October, and no finished-goods movements were available, but the exact pre-migration quantities could not be established. No guessed restoration was applied. Verify stock against the source records or a database backup before relying on it for dispatch.
