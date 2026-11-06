# Parent accounts and subaccounts

Chart of Accounts supports multiple nested levels. Use New group to create a non-posting parent, then its + shortcut to add a subaccount, or choose a Parent account in the account editor. Parent and child must have the same account type. Parent groups remain active and do not accept journal postings. Individual posting accounts remain available to the existing payment, collection and accounting workflows.

The chart displays accounts in tree order with indentation, parent paths and rolled-up balances. Group ledgers include the posted journal lines of every descendant and identify the individual account. CSV exports include the parent path. Group balances are subtotals: do not sum them again with their children. Financial statements and cash-flow calculations continue to use the original individual journal lines, so grouping does not double-count or change transactions.

Existing system or used accounts retain their codes, types, posting roles and cash/bank flags. They may be placed under a compatible group with a reasoned audit entry. Existing posting accounts cannot become parents, so create a separate group rather than converting a used cash account into one. No existing accounts were automatically regrouped.

Validation prevents self-parenting, cycles, mixed-type trees, inactive/postable parents and converting a populated group into a posting account. Structural edits are serialized in a transaction. Only migration 2026_11_02_000003_add_account_hierarchy was applied; it adds a nullable parent reference without changing existing balances.
