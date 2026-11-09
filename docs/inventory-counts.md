# Inventory counts and Excel updates

Inventory Overview lists every article, including articles with no stock. View shows its sizes; Edit stock assigns quantities on a normal page. A reason is required and changes create stock movements. Missing sizes must be configured in Pricing List first. Existing real quantities are not reset. The temporary fill button and API have been removed.

## Excel workflow

1. Open Inventory > Bulk Inventory Import, or Excel import / update on Inventory Overview.
2. Choose Articles / finished goods or Raw materials / batches.
3. Download the Excel template containing current records and counts.
4. Fill new_quantity. Blank means unchanged, 0 means set to zero. Article quantities are whole pieces per article and size, across colours.
5. Keep the code, size and current quantity unchanged. For a new raw batch supply its batch name, current quantity 0, and positive unit cost. Keep existing batch costs unchanged.
6. Upload the .xlsx file, review current count, new count and difference, and enter a reason.
7. Apply reviewed stock counts. Refresh inventory views to see the results.

The importer validates the complete file before applying it. Unknown items, duplicate article/size or material/batch rows, formulas in quantity cells, negative counts and stale current counts are rejected. Blank rows are skipped. Maximum 5,000 reviewed rows and 2 MB per workbook. A request reference prevents a retry from applying movements twice. Transactions roll back all changes if a row or journal fails.

Finished goods follow the existing quantity movement ledger. Raw changes also post the existing inventory-adjustment journal at batch cost and require an open accounting period. No sale prices or invoices are changed.

The older CSV positive-addition import is retained separately and explicitly labelled: each new CSV import adds stock. Use the Excel count update for replacements.

Search by article/item name or code is available in inventory selectors, purchase order lines, stock ledgers, quotation sizes and classification assignment. Existing page record searches remain available.

## Validation

Run backend/tests/verify_inventory_counts.php with PHP. It creates an isolated SQLite memory database and does not change real inventory.
