# Real receivables import

Imported on 2 November 2026 from the supplied AR workbook: 343 unpaid invoice balances, 159 customers, LKR 23,120,293.00. The source SHA-256 is 19f61211e1970a38389974a536ca2a64e78f1ac5b6674109847a95fabb7ea703.

Original invoice dates (28 March 2024 through 17 October 2026) and representative names are retained. All source credit-day fields were blank; the user confirmed that they should remain blank. Missing addresses, telephone numbers, credit limits and commission terms have not been invented. New customers have no configured credit limit; new representative commission rates are zero.

Each debt is an opening receivable, posted on 2 November 2026 as a debit to 1100 Accounts Receivable and a credit to 3990 Opening Balance Equity. This avoids recording historical debts as fresh sales, cash receipts, commission earnings or stock movements. Historical accounting periods were not reopened. Original invoice dates describe the source debts; these ledger openings become effective on the import posting date.

Three source invoice numbers are reused across different customers. Every row is retained with a stable AR reference containing its source invoice number and a digest. The audit trail records the original number, worksheet row and source values. Repeated identical imports are skipped; changed source values for an already imported invoice require reconciliation.

Customers, Invoices, Debtors Aging and customer profile/ledger views include these balances. Unknown due dates appear under Terms not set. Editing a customer's credit days later computes due dates for that customer's opening invoices whose due dates are still blank; previously agreed due dates remain unchanged. The changes are audited.

The four existing customers and two existing invoices were preserved. Their LKR 378,000 outstanding balance remains separate from the imported LKR 23,120,293, so the combined system receivable balance is LKR 23,498,293.

The import command is receivables:import. It defaults to preview only; posting requires an explicit posting date and --commit. Source copies, before-images and reconciliation results are stored privately in backend/storage/app/ar-import and are excluded from version control. Only migration 2026_11_02_000001_allow_unknown_receivable_terms was applied for this import.

Validation: every imported customer profile and the AR ledger reconciled to the source total; all 343 imported aging rows retained unknown terms. Original invoice values were checked unchanged. Isolated tests cover repeat imports, unknown terms, journal rollback, later term entry and overdue classification. No browser automation was used.
