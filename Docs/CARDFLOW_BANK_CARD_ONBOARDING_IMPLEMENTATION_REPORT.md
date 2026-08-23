# CardFlow Bank, Card, Onboarding Implementation Report

## Files created

- `services/card-id.js`
- `Docs/CARDFLOW_BANK_CARD_ONBOARDING_IMPLEMENTATION_REPORT.md`

## Files modified

- `index.html`
- `styles.css`
- `app.js`
- `services/default-data.js`
- `services/local-repository.js`

## Schema changes

Canonical data now supports:

- `banks`
- `settings.setupCompleted`
- `cards.bankId`
- `cards.cardForm`

Existing fields such as `cards.bank`, `cards.id`, `cashbackPrograms`, `transactions`, `payments`, revision data, and device data are preserved.

## Migration behavior

- Existing `card.bank` text is used to create stable `banks` records.
- Existing card IDs are preserved exactly.
- Existing card references from cashback programs, transactions, and payments are not rewritten.
- Existing cards without `cardForm` keep `cardForm: ""`.
- Existing meaningful datasets are marked with `settings.setupCompleted = true`.
- Fresh datasets remain empty of personal card data and use `settings.setupCompleted = false`.
- Migration is idempotent and does not repeatedly duplicate banks.

## Banks implementation

Added the `Mã ngân hàng` master-data tab under the `Danh mục` sidebar section.

CRUD rules:

- code and name are required
- code is trimmed and uppercased
- code cannot contain spaces
- code allows letters, numbers, and hyphen
- duplicate code is rejected
- exact duplicate name is rejected
- deletion is blocked when a credit card references the bank

## Card ID generation rules

Card ID is generated only when adding a new card:

`<BANK_CODE>-<NORMALIZED_CARD_NAME>`

Normalization:

- uppercase
- remove Vietnamese diacritics
- convert separators/spaces to hyphens
- collapse repeated hyphens
- trim leading/trailing hyphens
- `American Express` maps to `AMEX`

On edit, existing Card ID is preserved exactly.

## Sacombank/SACOM handling

Migration maps:

- `Sacombank` -> `SACOM`
- `SCB` -> `SCB`

`SCB` is not used for Sacombank. Existing legacy card IDs such as `SCB-CASHBACK` are preserved during migration.

## Credit Card form changes

Visible Add/Edit fields are now:

- Ngân hàng
- Tên thẻ
- Loại thẻ
- Hình thức thẻ
- Nhóm hạn mức
- Hạn mức nhóm (VND)

Card ID is not editable. The card table still displays Card ID for visibility.

## Money formatting

`Hạn mức nhóm (VND)` uses Vietnamese thousands separators while editing, for example:

`82.000.000`

The stored value remains numeric:

`82000000`

## Onboarding flow

Added first-time setup wizard when:

`settings.setupCompleted !== true`

Steps:

1. Mã ngân hàng
2. Thẻ tín dụng
3. Host

Rules:

- at least 1 bank is required before continuing
- at least 1 credit card is required before continuing
- Host step can be skipped
- finish sets `settings.setupCompleted = true`
- finish uses existing `saveState()` and sync debounce flow

Suggested banks are shown as optional quick actions. They are not automatically inserted.

## Existing-user detection

Datasets with existing cards, cashback programs, transactions, payments, hosts, banks, or completed settings are treated as meaningful existing data and are not forced through onboarding.

## New-user behavior

Fresh users no longer receive personal demo cards or cashback programs automatically. MCC reference data remains available as generic reference data.

## Tests executed/results

Executed:

- `node --check app.js`
- `node --check services/local-repository.js`
- `node --check services/default-data.js`
- `node --check services/card-id.js`
- local module tests for:
  - Sacombank maps to `SACOM`
  - `SCB` remains reserved for SCB bank
  - existing Card IDs remain unchanged
  - existing cards without `cardForm` stay empty
  - existing meaningful data completes setup
  - new Sacombank Cashback ID is `SACOM-CASHBACK`
  - new SCB Platinum ID is `SCB-PLATINUM`
  - American Express short name becomes `AMEX`
  - new user has no personal cards/programs/hosts
  - new user setup is incomplete
  - migration does not duplicate banks on repeat
- local HTTP smoke test at `http://127.0.0.1:5173`
- browser render smoke test:
  - Dashboard rendered
  - `Mã ngân hàng` tab rendered
  - no console errors observed

Partially verified by code review and syntax checks:

- duplicate bank code rejection
- bank deletion block when referenced
- bank dropdown reads from `state.banks`
- network dropdown values
- physical/virtual card form values
- money input stores number after parse
- CRUD still calls `saveState()` and marks dirty
- setup finish uses existing sync path

Not executed with real external services:

- Google OAuth login
- real Drive file upload/download
- multi-device conflict through real Drive
- GitHub Pages deployed runtime

## Manual runtime tests still required

- Real Google Drive connect/sync after configuring OAuth origin.
- Add/edit/delete every entity through the browser UI.
- Full onboarding from a clean browser profile.
- Finish setup and confirm Drive dirty/sync behavior.
- Conflict test across two browsers/devices.
- GitHub Pages URL test at `https://mimi0710zz.github.io/CardFlow/`.

## GitHub Pages compatibility status

The app continues to use relative local paths:

- `styles.css`
- `cardflow.config.js`
- `app.js`
- `services/*.js`

No backend or absolute local path dependency was added. GitHub Pages compatibility is preserved structurally. Live deployment was not tested in this environment.
