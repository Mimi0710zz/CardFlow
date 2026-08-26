# CardFlow Unlimited Cashback Form Fix Report

## Root cause

The calculation layer supported unlimited cashback, but the Add/Edit form still depended on already-canonicalized `maxCashbackUnlimited` data. A legacy VP debit fixture with `max = 999999999999` could still enter the form as a capped program, so the form displayed the fake cap and derived fake targets.

`Chi nhóm để max` was also rendered as a money input, which cannot cleanly display `Không áp dụng`.

## Files modified

- `app.js`
- `services/cashback.js`
- `services/local-repository.js`

## Actual form changes

The Cashback Program form now exposes a real `Max CB` dropdown:

- `Có giới hạn`
- `Không giới hạn`

When capped, the numeric `Max CB (VND)` input is visible. When unlimited, the numeric input is hidden and cleared.

## Add form behavior

New programs default to capped mode. Entering rate and cap recalculates `Chi nhóm để max` immediately and auto-fills `Chỉ tiêu tổng` unless the user manually edits it.

Switching to unlimited clears the numeric cap and shows `Chi nhóm để max = Không áp dụng`.

## Edit form behavior

Editing an unlimited program opens with:

- `Max CB = Không giới hạn`
- numeric Max CB hidden
- `Chi nhóm để max = Không áp dụng`

Editing a capped program opens with:

- `Max CB = Có giới hạn`
- numeric Max CB visible
- calculated `Chi nhóm để max`

## Legacy fixture migration

The verified fixture:

- `VP-VISA-PRIME-PLATINUM-DEBIT`
- `POS Cashback`
- `max = 999999999999`

is detected as unlimited even before saved data is re-canonicalized. Canonicalization persists it as:

- `maxCashbackUnlimited = true`
- `max = null`
- `eligibleTarget = null`
- fake `totalTarget = 999999999999` cleaned to `null`

## Max mode dropdown binding

The dropdown binds to transient form value `maxCashbackMode`. Save converts it to persisted fields:

- capped: `maxCashbackUnlimited = false`, `max = <number>`
- unlimited: `maxCashbackUnlimited = true`, `max = null`

## Eligible target behavior

`Chi nhóm để max` is readonly/calculated.

- capped: `round(max / rate)`, displayed as money
- unlimited: `null`, displayed as `Không áp dụng`

## Total target cleanup behavior

`Chỉ tiêu tổng` remains independent and editable. For capped programs it defaults from the calculated `eligibleTarget`. For unlimited programs it defaults empty, but manual total targets remain supported.

Only the verified VP fake-unlimited fixture has fake total target `999999999999` cleaned to `null`.

## Table display verification

Source rendering now uses:

- unlimited `Max CB`: `Không giới hạn`
- unlimited `Chi nhóm để max`: `Không áp dụng`
- capped values: existing money formatting

Runtime browser table verification: [Chưa xác minh]

## Dashboard calculation verification

Service check confirmed unlimited cashback:

```text
rate = 3%
eligible spend = 30.000.000
cashback = 900.000
```

Dashboard runtime verification with real browser data: [Chưa xác minh]

## Responsive verification

Desktop form: [Chưa xác minh]
Tablet form: [Chưa xác minh]
Smartphone form: [Chưa xác minh]

The implementation reuses the existing responsive form grid and select/input controls.

## Tests executed/results

- `isCashbackUnlimited()` detects the VP legacy fake-unlimited fixture: passed.
- `calculateSpendToMax(0.068, 680000) = 10000000`: passed.
- Unlimited cashback `0.03 * 30000000 = 900000`: passed.
- Canonicalization cleans VP fake cap, fake eligible target, and fake total target: passed.
- `node --check app.js`: passed.
- `node --check services/cashback.js`: passed.
- `node --check services/local-repository.js`: passed.

## Remaining signed-in browser checks

- Add new capped cashback program: [Chưa xác minh]
- Add new unlimited cashback program: [Chưa xác minh]
- Edit capped program dropdown state: [Chưa xác minh]
- Edit unlimited program dropdown state: [Chưa xác minh]
- Switch capped/unlimited in the live modal: [Chưa xác minh]
- Google Drive serialization roundtrip for `maxCashbackUnlimited`: [Chưa xác minh]
