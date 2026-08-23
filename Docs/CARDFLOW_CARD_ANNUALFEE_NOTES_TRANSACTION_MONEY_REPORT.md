# CardFlow Card Annual Fee Notes Transaction Money Report

## Files modified

- `app.js`
- `services/local-repository.js`
- `Docs/CARDFLOW_CARD_ANNUALFEE_NOTES_TRANSACTION_MONEY_REPORT.md`

## Schema changes

- Added optional credit card fields:
  - `annualFee`: number or `null`
  - `notes`: string

## Migration behavior

- Existing cards are normalized on load through `normalizeCards()`.
- Missing or empty `annualFee` becomes `null`.
- Missing `notes` becomes an empty string.
- Migration is idempotent and does not change Card ID, bank ID, card form, statement day, limit group, or references.

## Credit card form changes

- Add/Edit Credit Card now includes:
  - `Phí thường niên (VNĐ)`
  - `Ghi chú`
- `Phí thường niên (VNĐ)` uses the shared money input helper and can be left empty.
- `Ghi chú` uses a textarea for longer notes.
- Card ID and raw limit group fields remain hidden.

## Credit card table changes

- Added columns:
  - `Phí thường niên`
  - `Ghi chú`
- Annual fee displays as formatted Vietnamese money with `đ`.
- Empty/null annual fee displays `Chưa thiết lập`.
- Empty note displays `—`.

## Annual fee formatting behavior

- Input example: `1200000` -> `1.200.000`
- Stored value: `1200000`
- Empty input stores `null`.

## Notes field behavior

- Notes are stored as plain strings.
- Empty notes are normalized to `""`.

## Transaction money-format fix

- Transaction Add/Edit money fields use the shared money helper:
  - `Tiền đơn (VND)`
  - `Tiền Back (VND)`
- Input example: `4087000` -> `4.087.000`
- `Tiền Back = 0` remains valid and displays `0`.
- Stored transaction values remain numbers.

## Tests executed/results

- `node --check app.js` passed.
- `node --check services/local-repository.js` passed.
- Card migration smoke test passed:
  - existing card keeps the same Card ID
  - missing `annualFee` becomes `null`
  - missing `notes` becomes `""`
  - migration is idempotent
  - string annual fee such as `1200000` normalizes to number `1200000`
- Money helper smoke test passed:
  - `1200000` -> `1.200.000` -> `1200000`
  - `4087000` -> `4.087.000` -> `4087000`
  - `0` -> `0` -> `0`
  - mixed non-digit input strips safely before parsing
- Static scan confirmed card form/table references for `annualFee`, `notes`, `Phí thường niên`, and `Ghi chú`.
- Static scan confirmed Transaction Add/Edit fields use `kind:"money"`.
- [Chưa xác minh] Browser Add/Edit Credit Card runtime was not executed.
- [Chưa xác minh] Browser Add/Edit Transaction runtime was not executed.
- [Chưa xác minh] Real Google Drive sync was not executed.

## Remaining manual runtime tests

- Add Credit Card with annual fee and notes.
- Edit existing Credit Card annual fee and notes.
- Verify existing card migration in browser local data.
- Verify transaction Add/Edit money display and save/load roundtrip.
- Verify Dashboard calculations after transaction edits.
- Verify Google Drive sync after saving.
- Verify GitHub Pages production URL.

## GitHub Pages compatibility status

- No backend, build step, OAuth Client ID, scope, client secret, or absolute deployment path was added.
- Existing static module structure remains compatible with GitHub Pages.
