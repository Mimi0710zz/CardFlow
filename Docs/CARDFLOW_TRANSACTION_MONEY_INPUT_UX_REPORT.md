# CardFlow Transaction Money Input UX Report

## Files modified

- `app.js`
- `styles.css`
- `Docs/CARDFLOW_TRANSACTION_MONEY_INPUT_UX_REPORT.md`

## Money formatting behavior

- Transaction Add/Edit now formats these fields with Vietnamese dot thousands separators:
  - `Tiền đơn (VNĐ)`
  - `Tiền Back (VNĐ)`
- Examples:
  - `4087000` displays as `4.087.000`
  - `0` displays as `0`
- The fields use the existing reusable money input pattern (`kind:"money"`, `moneyInput()`, `parseMoney()`).
- Money inputs strip non-digit characters while typing and reformat on input/change/blur.
- A compact `đ` suffix is shown inside the input for currency clarity.

## Storage behavior

- Stored transaction values remain numbers.
- `openForm()` still returns money fields through `parseMoney()`.
- `normalizeTx()` still stores:
  - `amount:Number(v.amount)||0`
  - `backAmount:Number(v.backAmount)||0`
- Transaction schema, calculations, filtering/search, sync, and revision/conflict logic were not changed.

## Tests executed

- `node --check app.js` passed.
- Static scan confirmed `Tiền đơn (VNĐ)` and `Tiền Back (VNĐ)` both use `kind:"money"`.
- Static scan confirmed `normalizeTx()` still stores `amount` and `backAmount` as numbers.
- Money format/parse smoke test passed:
  - `4087000` -> `4.087.000` -> `4087000`
  - `0` -> `0` -> `0`
  - `1234567890` -> `1.234.567.890` -> `1234567890`
  - mixed non-digit input strips safely before parsing
- [Chưa xác minh] Real Add Transaction browser save/load roundtrip was not executed.
- [Chưa xác minh] Real Edit Transaction browser save/load roundtrip was not executed.
- [Chưa xác minh] Dashboard calculation runtime check was not executed.
