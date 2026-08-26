# CARDFLOW LEGACY CARD ID MIGRATION REPORT

## Root cause

Older datasets used `SCB-*` Card IDs for Sacombank. Current bank master data correctly defines Sacombank as `SACOM`, while `SCB` is a separate bank. New-card generation was already correct, but stored legacy IDs and their references required an atomic data migration.

## Files modified

- `services/local-repository.js`
- `services/sync-service.js`
- `Docs/CARDFLOW_LEGACY_CARD_ID_MIGRATION_REPORT.md`

## Migration map

The migration builds the complete map before changing data. For the verified fixture:

```json
{
  "SCB-AMEX": "SACOM-AMEX",
  "SCB-CASHBACK": "SACOM-CASHBACK"
}
```

A card is eligible only when its `bankId` resolves to a bank named `Sacombank` (or its preserved bank name is Sacombank), the bank master has a code, and its stored ID starts with `SCB-`. The target prefix comes from the resolved master `bank.code`; it is not hardcoded to `SACOM` in the migration algorithm.

Cards belonging to the separate SCB bank are not eligible and retain `SCB-*`.

## Reference fields audited and updated

The single migration pass updates:

- `cards[].id`
- `cashbackPrograms[].cardId`
- `transactions[].cardId`
- `payments[].cardId`
- `cashbackReceipts[].cardId`
- `cards[].limitGroup`
- `cards[].limitGroupId`

Dashboard calculations, table display, CRUD lookup, and exports resolve cards dynamically from these stored fields; no separate card-ID cache/index exists. Onboarding/default data contains no personal legacy cards. Import reads the incoming card reference and subsequently uses the normalized state.

## Shared-limit behavior

Exact group values based on a migrated Card ID, including `SCB-*` and `LG-SCB-*`, are rewritten with the same map.

`SCB-SHARED` or `LG-SCB-SHARED` is renamed to the corresponding `SACOM-SHARED` value only when every card in that group is one of the Sacombank cards migrated in the same pass. A mixed/actual-SCB group is preserved. The verified fixture keeps American Express and Cashback in the same group after migration.

## Duplicate protection

All existing Card IDs are indexed before migration. If a target such as `SACOM-AMEX` already exists, the `SCB-AMEX` migration entry is skipped. Neither card nor references are overwritten or merged. Conflict details are returned by the migration and logged during local load.

## Idempotency

After the first pass, migrated IDs no longer start with `SCB-`, so a second pass builds an empty map and reports `changed: false`. Tests confirmed the second canonicalization does not alter the migrated dataset.

## Local data and Google Drive

Migration runs inside the existing canonicalization layer. Local load saves the normalized dataset and marks sync metadata dirty only when at least one migration entry changed data. Existing revision and conflict handling remain in place.

Drive reads also use migration-aware canonicalization. When a newer/selected Drive dataset requires migration, it becomes the local dirty version with its Drive revision as the sync base, then the existing upload path persists it. No second sync implementation was introduced.

## Runtime/data tests

- Sacombank master code `SACOM`: passed.
- `SCB-AMEX -> SACOM-AMEX`: passed.
- `SCB-CASHBACK -> SACOM-CASHBACK`: passed.
- Actual SCB card remains `SCB-*`: passed.
- Program, transaction, payment, and receipt references: passed.
- Shared-limit membership and safe `SCB-SHARED` rename: passed.
- Duplicate target protection: passed.
- Second migration reports no change: passed.
- New Card ID generation from `bank.code`: passed.
- JavaScript syntax and diff checks: passed.

## Remaining manual Google Drive verification

- Signed-in upload/download against the user's actual Drive file: `[Chưa xác minh]`.
- Conflict-dialog flow with a legacy Drive revision: `[Chưa xác minh]`.
- Visual confirmation of the actual user's migrated card table: `[Chưa xác minh]`.
