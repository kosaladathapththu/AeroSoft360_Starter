# AeroSoft360 release review — 5 November 2026

The current implementation has completed its local release checks. Hosting files have **not** been packaged or deployed. The next stage is production configuration and packaging for the selected host, after replacing the remaining demo passwords.

## Changes in this review

- Added a colourful public home page with six module summaries, a sales-process overview and clear workspace sign-in buttons. The illustration contains no live financial data.
- Added a matching sign-in screen, password visibility control, labelled fields, account-access guidance and clear sign-in errors. Public home and login links support direct navigation and browser back navigation.
- Removed prefilled demo email/password values and the demo-profile message from the login screen. Existing user accounts were preserved.
- Signed-in users continue to their workspace. Signing out returns to the public home page.
- Disabled debug display in the local environment and changed the environment example to default to `APP_DEBUG=false`. Database credentials and other environment settings were preserved.
- Split public-page, React and icon assets into separate build chunks. The application chunk is approximately 423 KB before compression; the previous large-chunk build warning is resolved.
- Added a repeatable release verification script and a frontend test command.
- Updated two isolated backend fixtures to include the implemented account hierarchy and opening-balance schema. Their original business assertions remain in place.

## Confirmed pricing rule

The uploaded price-list selling price is **per piece**, not per complete set. The user confirmed this rule during the review.

`Set total = sum of (fixed price per piece for a size × pieces of that size in the selected template)`

Examples: 75 × 10 = 750; 75 × 12 = 900; 1,075 × 10 = 10,750.

The complete-set panel now shows the piece price, pieces per set, fixed set total and calculation separately. Individual size prices are read-only when ordering a complete set. The invoice can apply a common customer-specific given rate per piece to that set; the fixed price remains visible. Customized orders/invoices show a separate fixed and given price for each size, with template labels where relevant.

Corrected the customized invoice subtotal preview to use the given size rates. Complete-set invoice previews now use the same fixed/given-rate calculation as their expanded invoice lines, including saved fixed-price snapshots.

Stored catalog prices and existing invoices were not rewritten. The imported 2020(S) template provenance identifies rates of 1,075 at source rows 530–534 and 1,900 at rows 1214–1218 of `pricing aerosoft3.xlsx`; these remain separate templates. This check inspected the stored Excel-import provenance, not a newly supplied workbook. Do not merge those template rates or invent replacement values.

## Verification completed

| Area | Result |
|---|---|
| Backend | 20 explicitly reviewed SQLite-memory fixture suites passed |
| Frontend | 9 suites passed, including public-page rendering, login submission, pricing, filtering, reports, search and stock-import checks |
| Production build | TypeScript and Vite passed without the earlier bundle-size warning |
| Production assets | Index and all 6 JavaScript/CSS assets served successfully from the local production preview |
| Visual checks | Public home and sign-in reviewed at desktop and narrow viewport sizes; built production home verified |
| Database schema | All existing migrations reported as applied; no live migration or seed operation was performed |
| Data preservation | Regression fixtures use isolated memory databases; business balances, prices and stock were not changed for test purposes |

The backend fixtures cover purchasing, receiving, supplier invoices/payments, vouchers, account hierarchy, cash flow, customer openings/profile, receivable corrections, imports, dashboard, invoice bills, sales-order review, rates, exports, returns, serials/warranty, POS and password reset. Test suites provide regression coverage; they are not a guarantee that every possible production scenario has been exercised.

Run the same checks from the repository root:

```powershell
.\scripts\Verify_Release.ps1
```

For a different PHP installation:

```powershell
.\scripts\Verify_Release.ps1 -PhpPath "C:\path\to\php.exe"
```

Frontend checks alone:

```powershell
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
```

Test logs and visual review files are written under `tmp/release-review`, which is excluded from future Git additions and must not be included in a hosting package.

## Required before public hosting

1. **Replace the documented demo passwords for all four active accounts** in Administration → Access Control → Reset password. Existing account records have deliberately not been altered without new credentials. Disable any accounts that will not be used.
2. Configure the real application/API URLs, HTTPS, allowed browser origins, private environment file, database credentials, writable Laravel storage/cache directories and compatible PHP/database versions for the chosen host. The current frontend API fallback is for local development on port 8000.
3. Verify the host permits the database backup tool to run, configure its executable if needed, and perform a backup-and-restore check in a separate database.
4. Package application/build files explicitly. Do not upload development browser profiles, `tmp`, regression fixtures, source customer workbooks, local environment secrets or database backups into the public web directory.
5. Take a final database backup and review opening stock and business setup before entering live transactions. Unknown credit terms remain blank intentionally; imported opening receivables do not contain product lines and cannot identify returned stock by balance alone.

The release is ready for the hosting-configuration stage subject to these production prerequisites. No restore interface, new pricing source or additional business module was introduced during this review.
