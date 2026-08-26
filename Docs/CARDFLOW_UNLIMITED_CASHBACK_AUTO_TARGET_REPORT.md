# CardFlow Unlimited Cashback And Auto Target Report

## Files modified

- `app.js`
- `services/cashback.js`
- `services/local-repository.js`
- `styles.css`

## Schema changes

Cashback programs now support:

```json
{
  "maxCashbackUnlimited": true,
  "max": null
}
```

For capped programs, the existing `max` field is preserved:

```json
{
  "maxCashbackUnlimited": false,
  "max": 680000
}
```

The current `eligibleTarget` and `totalTarget` fields are preserved. `eligibleTarget` is now derived from rate and cap. `totalTarget` remains an independent business value and can be `null` when no target applies.

## Unlimited representation

Unlimited cashback is represented semantically with `maxCashbackUnlimited === true`. The app does not use `Infinity` or fake numeric caps such as `999999999999` for calculations or display.

## Legacy fake-cap migration

Canonicalization keeps normal numeric caps as capped programs. Only the verified legacy fixture:

- `cardId`: `VP-VISA-PRIME-PLATINUM-DEBIT`
- `name`: `POS Cashback`
- `max`: `999999999999`

is migrated to:

- `maxCashbackUnlimited: true`
- `max: null`
- `eligibleTarget: null`

No broad large-number migration was added.

## Cashback formula

Capped:

```text
cashback = min(eligibleSpend * rate, max)
```

Unlimited:

```text
cashback = eligibleSpend * rate
```

This feeds Dashboard rule cashback, card summaries, estimated profit, and monthly cashback totals through the existing `programMetrics()` flow.

## Dashboard integration

Dashboard target metrics now show `Không áp dụng` when a program has no group target and no total target. Unlimited programs still contribute real cashback values to `Cashback theo rule` and `Lợi nhuận tháng`.

## Spend-to-max formula

For capped programs:

```text
eligibleTarget = round(max / rate)
```

Examples verified:

- `5% + 500000 = 10000000`
- `6.8% + 680000 = 10000000`
- `16.8% + 680000 = 4047619`
- `20% + 2000000 = 10000000`

Unlimited programs use `eligibleTarget: null` and display `Không áp dụng`.

## Rounding behavior

`eligibleTarget` uses `Math.round()` to the nearest whole VND and display continues through the existing Vietnamese money formatter.

## Total target auto/default/override logic

The form defaults `Chỉ tiêu tổng` to the current calculated `Chi nhóm để max` for capped programs. Users can still edit `Chỉ tiêu tổng`; if the value differs from the calculated target, the saved program marks it as an override with `totalTargetManuallyEdited`.

The `Tự động` action resets `Chỉ tiêu tổng` to the current calculated target. For unlimited programs, the default is blank/`Không áp dụng`, but a manual total target such as `5000000` is still supported.

## Unlimited progress behavior

Unlimited programs without `eligibleTarget` and without `totalTarget` do not fabricate progress. Dashboard target/progress fields show `Không áp dụng`.

## Shared-cap interaction

Shared-cap display still aggregates grouped rows and counts the grouped cashback once. A rule marked unlimited is not capped by its own `max` field. If a shared group contains a real capped program, that cap remains the shared cap for grouped display, preserving the existing Sacombank-style shared-cap behavior.

## Test results

- Node formula checks: passed.
- Node canonicalization checks: passed.
- `node --check app.js`: passed.
- `node --check services/cashback.js`: passed.
- `node --check services/local-repository.js`: passed.
- Local static server HTTP asset checks for `/`, `app.js`, `services/cashback.js`, `services/local-repository.js`, and `styles.css`: passed.

## Responsive verification

- Desktop runtime UI: [Chưa xác minh]
- Tablet runtime UI: [Chưa xác minh]
- Smartphone runtime UI: [Chưa xác minh]

The change reuses the existing responsive form/table structure and adds only a compact inline `Tự động` button style.

Browser automation was not available in the current tool environment; Playwright/Chromium could not be used for screenshots.

## Remaining signed-in browser/Drive checks

- Add/Edit capped cashback in browser: [Chưa xác minh]
- Add/Edit unlimited cashback in browser: [Chưa xác minh]
- Manual `Chỉ tiêu tổng` override persistence through UI: [Chưa xác minh]
- Google Drive sync roundtrip with `maxCashbackUnlimited`: [Chưa xác minh]
- Import/export workbook roundtrip: [Chưa xác minh]
