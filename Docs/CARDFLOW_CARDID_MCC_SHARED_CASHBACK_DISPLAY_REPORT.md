# CARDFLOW CARD ID MCC SHARED CASHBACK DISPLAY REPORT

## Files modified

- `app.js`
- `services/cashback.js`
- `Docs/CARDFLOW_CARDID_MCC_SHARED_CASHBACK_DISPLAY_REPORT.md`

## Dashboard Card ID changes

The `Tình trạng thẻ` and `Tiến độ Cashback theo rule / Chỉ tiêu` tables now use the header `Card ID` and render the stored `card.id`/`program.cardId`. Calculations, reminders, limits, debt, profit, and responsive structure were not changed.

The mobile/tablet card labels are derived from the same table headers, so responsive card rows also show `Card ID`.

## Transaction Card ID changes

The Transaction table now uses `Card ID` and renders `transaction.cardId`. Add/Edit dropdowns retain readable card names. Search includes both the raw Card ID and readable resolved name.

## Cashback Program Card ID changes

The Cashback Program table now starts with `Card ID` and renders `program.cardId`. Its Add/Edit card dropdown remains user-friendly.

## MCC code derivation

The new `Mã MCC` column resolves each stable `mccCategoryIds` value against `state.mccCategories` and reads the current master `mcc` value. No MCC code is stored redundantly in a cashback program or hardcoded in the row renderer.

Multiple selections are shown as comma-separated codes. Program search now includes Card ID, program name, readable MCC groups, resolved MCC codes, and shared-cap identity.

Current master-data verification:

- `Siêu thị -> 5411`
- `Đi lại -> 4789`
- `Bảo hiểm -> 6300`

## All-MCC display

When normalized `allMcc === true`, both `Nhóm MCC` and `Mã MCC` display `Tất cả`; the renderer does not enumerate every master MCC.

## Shared-cap monthly cashback display

The approved calculation is preserved:

1. Each rule calculates `rawCashback`.
2. Rules with the same non-empty `shared` identity are summed.
3. The result is limited by the existing shared cap (`group[0].max`).
4. `countedCashback` assigns the capped group amount to one member only for aggregation compatibility.

The new `displayCashback` value contains the same capped group amount on every member row. Cashback Program and Dashboard progress rows use `displayCashback`, eliminating the misleading `680.000 đ / 0 đ` presentation. Independent programs use their existing individual result.

The existing Shared cap cell remains visible and includes a small tooltip explaining that monthly cashback is shared by the program group.

## Aggregate deduplication

Dashboard KPI, card summaries, estimated profit, and Excel Dashboard aggregate continue summing `countedCashback`, not `displayCashback`. Therefore repeated row display values do not multiply totals.

## Sacombank shared-cap test

Fixture:

- Program A: `SACOM-CASHBACK`, raw cashback `500.000`, shared cap `SACOM-CB-680`.
- Program B: `SACOM-CASHBACK`, raw cashback `400.000`, same shared cap.
- Cap: `680.000`.

Verified result:

- Program A display: `680.000`.
- Program B display: `680.000`.
- Aggregate contribution: `680.000`, not `1.360.000`.

An additional independent program remained individually calculated, and aggregate summation included it once.

## Desktop / Tablet / Mobile verification

No responsive CSS strategy was rewritten. Existing table scrolling and `.mobile-card-table` transformations remain in use. `Mã MCC` cells use the existing wrapping class.

- Responsive source/CSS audit: passed.
- Runtime visual verification on signed-in desktop/tablet/mobile viewports: `[Chưa xác minh]`.

## Tests executed/results

- Shared-cap display equality across members: passed.
- Shared-cap aggregate deduplication: passed.
- Independent-program behavior: passed.
- Current MCC master mappings for 5411, 4789, and 6300: passed.
- JavaScript syntax checks: passed.
- `git diff --check`: passed.

## Remaining runtime checks

- Signed-in browser visual QA with actual user data: `[Chưa xác minh]`.
- Search interaction across Card ID/MCC code/shared cap in the browser: `[Chưa xác minh]`.
- Google Drive roundtrip: `[Chưa xác minh]`; this change does not alter persisted schema or sync code.
