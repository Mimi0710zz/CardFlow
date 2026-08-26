# CARDFLOW UNIFIED CREDIT DEBIT CARD REPORT

## Files modified

- `index.html`
- `app.js`
- `styles.css`
- `services/local-repository.js`
- `services/card-status-summary.js`
- `Docs/CARDFLOW_UNIFIED_CREDIT_DEBIT_CARD_REPORT.md`

## Unified card tab and data model

The user-facing `Thẻ tín dụng` navigation/view was renamed to `Thẻ`. Cards now use:

```json
{
  "cardType": "credit"
}
```

or:

```json
{
  "cardType": "debit"
}
```

Canonicalization treats a missing or unknown `cardType` as `credit`. This preserves existing Card IDs, bank references, statement days, shared-limit relationships, cashback programs, transactions, payments, and receipts. Re-running canonicalization does not change the result.

## Card form

The first field is now the `Thẻ` classification dropdown with `Credit` and `Debit`. The former Visa/Mastercard/etc. field is labeled `Mạng thẻ`.

When `Credit` is selected, the form shows the existing statement day, shared-limit selection, and group-limit fields. When `Debit` is selected, those fields are hidden and disabled. Debit validation ignores statement day/shared limit/group limit and saves them as empty/zero normalized values.

Card ID generation is unchanged: selected `bankId` resolves the bank master `code`, then combines it with the normalized card name. Edit preserves the current Card ID.

## Card table

The table adds `Thẻ` as the first column and displays `Credit`/`Debit`. `Loại thẻ` was renamed to `Mạng thẻ`. Debit rows display `—` for statement day, shared limit, limit, and debt.

Debit rows use the approved soft mint background `#F1F8F7`. The selected-row background continues to take precedence. The same class applies to responsive card rows and setup rows.

## Dashboard card status

Both Credit and Debit cards are present in `Tình trạng thẻ`, identified by Card ID.

- Credit uses the existing shared-limit, debt, remaining-limit, spending, cashback, and profit calculations.
- Debit displays `—` for limit, debt, and remaining limit.
- Debit still contributes monthly spending, cashback, and estimated profit when matching business data exists.

The total summary excludes Debit from total credit limit, outstanding credit debt, and remaining credit limit. Shared Credit limits remain deduplicated by group. Debit activity remains included in the activity/profit metrics.

## Cashback, transactions, receipts, and payments

Existing card selectors use `state.cards` without a Credit-only filter, so Debit cards remain selectable in Transaction, Cashback Program, Cashback Receipt, and Payment workflows. Stored references continue using the existing Card ID.

Shared-limit selectors intentionally list only Credit cards because Debit cannot participate in credit-limit groups.

## Google Drive and compatibility

The change uses the existing canonicalization and persistence flow. No sync, revision, conflict, import/export, or Drive API implementation was replaced. The additional field is JSON-compatible and existing datasets migrate automatically.

## Responsive verification

Existing Desktop/Tablet/Smartphone navigation and table/card strategies were preserved. Debit highlighting uses a shared row class and the existing mobile-card table structure.

- Source/CSS responsive audit: passed.
- Signed-in browser visual QA: `[Chưa xác minh]`.

## Tests executed/results

- Missing `cardType` migrates to `credit`: passed.
- Explicit Debit remains Debit: passed.
- Debit credit-only fields normalize to empty/zero: passed.
- Migration idempotency: passed.
- Dashboard Debit exclusion from credit totals: passed.
- Dashboard Debit inclusion in spending/cashback/profit: passed.
- Shared Credit limit deduplication: passed.
- JavaScript syntax checks: passed.
- `git diff --check`: passed.

## Remaining runtime checks

- Interactive Credit/Debit form field visibility: `[Chưa xác minh]`.
- Creating a Debit transaction, cashback program, and receipt in a signed-in browser: `[Chưa xác minh]`.
- Visual QA at representative Desktop/Tablet/Smartphone viewports: `[Chưa xác minh]`.
- Google Drive upload/download roundtrip with `cardType`: `[Chưa xác minh]`.
