# CardFlow Transaction Status Schema Migration Report

## Existing status architecture found

Transactions previously persisted Vietnamese display labels directly in `transactions[].status`. The Add/Edit form offered legacy labels, the table badge compared labels, import accepted labels, export wrote labels, and fee-target eligibility excluded the old `Hủy` label.

## Root cause / legacy locations

The model had no stable internal transaction status keys. UI labels were used as business identifiers, so old intermediate statuses remained selectable and persisted.

## Final canonical status model

Normal runtime now uses only:

- `paid_bill_sent` -> `Đã thanh toán + Gửi bill`
- `host_back` -> `Host đã back`
- `issue` -> `Có vấn đề`
- `cancelled` -> `Huỷ`

Vietnamese text is used for UI display. Persisted transaction data uses the internal keys.

## Migration/version strategy

`schemaVersion` was bumped to `3`. `services/transaction-status.js` contains the minimum one-time legacy mapping used by canonicalization/import. `canonicalizeDataWithMigration()` marks data changed only when a transaction status actually changes, so the migration is idempotent and does not churn already-migrated data.

## Modified files

- `app.js`
- `services/default-data.js`
- `services/fee-target.js`
- `services/local-repository.js`
- `services/transaction-status.js`

## Local data migration behavior

When local data loads, `normalizeTransactions()` migrates legacy status labels to canonical keys while preserving transaction IDs and unrelated fields. If any status changes, local meta is marked dirty so the migrated local cache can be saved/synced.

## Google Drive migration/sync behavior

Drive data is already loaded through `canonicalizeDataWithMigration()`. Old Drive records are migrated to canonical status keys when read. If migration changes Drive data, the existing sync flow marks local state dirty and uploads a normal revision without duplicating transactions.

## UI changes

The Transaction form dropdown now contains exactly:

- `Đã thanh toán + Gửi bill`
- `Host đã back`
- `Có vấn đề`
- `Huỷ`

Saving stores the corresponding key. The table badge displays labels from the key and no longer compares deprecated labels.

## Status-dependent logic updated

- Transaction form options now use canonical values.
- Transaction table badge maps canonical values to display labels/tone.
- Transaction search includes canonical keys and new labels.
- Excel export displays the new label.
- Excel import normalizes legacy/new labels to canonical keys.
- Fee-target eligibility excludes `cancelled`.

## Legacy code removed

The old status options were removed from the production transaction form and badge logic. Deprecated status branches remain only in the migration map in `services/transaction-status.js`.

## Tests executed and results

- Legacy mapping checks for all requested statuses: passed.
- Already-migrated statuses remain unchanged: passed.
- Repository migration idempotency: passed.
- Transaction IDs preserved: passed.
- No duplicate records created during migration: passed.
- Fee target excludes `cancelled` and counts active status: passed.
- `node --check app.js`: passed.
- `node --check services/local-repository.js`: passed.
- `node --check services/fee-target.js`: passed.
- `node --check services/transaction-status.js`: passed.

## Browser/runtime checks still unverified

- Add Transaction form in browser: [Chưa xác minh]
- Edit Transaction form in browser: [Chưa xác minh]
- Signed-in Google Drive roundtrip: [Chưa xác minh]
- Full conflict-resolution workflow with old Drive data: [Chưa xác minh]

## Production logic confirmation

Normal production transaction status logic now uses only:

- `paid_bill_sent`
- `host_back`
- `issue`
- `cancelled`
