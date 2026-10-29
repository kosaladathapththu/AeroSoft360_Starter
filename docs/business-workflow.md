# Day-to-day workflow

## Sales

Start from **Dashboard → Create sales order**. Use a quotation first when making an offer. Record a customer PO when the customer supplied one; those are optional starting documents. A quotation can create a linked customer PO and sales order without re-entering the items.

Confirm the customer, fixed/given prices and required quantities in the sales order. **Dispatch & invoice** records the actual supplied quantities, reduces stock and creates the invoice. Partial dispatches leave the remaining order quantity open. View/print the invoice bill, then use Collections to record payments against the outstanding balance. Aging and eligible commissions follow the invoice and collection records. Immediate counter transactions use Point of Sale, which creates an invoice and payment together.

Pricing List and customer setup are preparation tasks, not transaction stages between an order and invoice.

## Purchasing

Open **Purchasing → Purchasing Overview** for the next unfinished steps:

1. **Purchase Orders:** create a draft with one or more material lines, review it and approve it.
2. **Goods Received (GRN):** choose an approved order and record the quantities actually delivered and their batches. One delivery can contain several PO lines. Partial receipts leave the order open. Posted GRNs are listed separately from orders awaiting receipt.
3. **Purchase Invoices:** register the supplier bill against a posted GRN. The GRN reference, supplier and received value carry forward. The bill number and due date feed subsequent supplier review/aging. Invoice registration does not duplicate the stock or liability already posted by the receipt.
4. **Supplier payment:** use the next-action button to prepare a supplier payment voucher for the same receipt, review the account/date/amount and post the voucher. Partial payments leave an outstanding balance.

Receipt status is computed from actual deliveries. A manual PO status edit cannot mark an unreceived order as received or reset a received order to draft. GRNs cannot precede their PO date.

The current invoice register supports one supplier invoice per GRN. It does not combine several GRNs into one bill or support supplier invoice price variances. Resolve receipt/order differences before registering the invoice. Existing direct invoices and receipt-linked payments remain available; the step strip describes the normal guided route, not every exception such as deposits or advance payments.

Use Purchase Returns for supported unpaid returns. Inventory tools are in their own navigation group; account/ledger/report setup stays in Finance & Reports.

Verification: `php backend/tests/verify_purchasing_lineup.php` runs the isolated connected-workflow checks plus PO approval → partial/final GRNs → supplier invoice → payment checks. It never uses the configured business database.
