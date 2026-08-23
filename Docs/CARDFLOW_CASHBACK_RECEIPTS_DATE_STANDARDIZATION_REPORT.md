# CardFlow Cashback Receipts And Date Standardization Report

## Files created

- `services/date.js`
- `Docs/CARDFLOW_CASHBACK_RECEIPTS_DATE_STANDARDIZATION_REPORT.md`

## Files modified

- `index.html`
- `app.js`
- `services/default-data.js`
- `services/local-repository.js`
- `services/sync-service.js`

## cashbackReceipts schema

New top-level collection:

```json
{
  "cashbackReceipts": [
    {
      "id": "CBR-...",
      "date": "2026-08-24",
      "bankId": "BANK-SACOM",
      "cardId": "SACOM-CASHBACK",
      "amount": 680000,
      "notes": "Cashback kỳ tháng 08/2026"
    }
  ]
}
```

IDs are generated automatically by the app and are not entered manually.

## Cashback thực nhận CRUD implementation

Added the sidebar tab `Cashback thực nhận` near the existing `Cashback` tab.

The tab uses the existing row-selection toolbar pattern:

- `Tìm kiếm`
- `+ Thêm`
- `Chỉnh sửa`
- `Xóa`
- double-click row to edit

Add/edit/delete all use existing `saveState()` and sync debounce behavior.

## Bank/card filtering behavior

The receipt form has:

- `Ngân hàng`: dropdown from master bank data.
- `Thẻ`: dropdown filtered by the selected bank.

When `Ngân hàng` changes, the app refreshes the card list and clears/replaces an incompatible selected card.

## Money formatting integration

`Tiền Cashback` uses the shared `kind:"money"` form behavior from `services/money.js`.

- Input display: `680000` -> `680.000`
- Table display: `680.000 đ`
- Stored value: `680000` as a number

## Dashboard integration

Dashboard now separates:

- `Cashback theo rule`
- `Cashback thực nhận`

`Cashback thực nhận` is summed from `cashbackReceipts` in the selected month/year.

Profit calculation was not changed. It still uses the existing rule-based cashback calculation because whether actual receipts should replace or add to profit is a business-rule decision not explicitly defined.

Dashboard labels were clarified from generic cashback wording to `CB theo rule` where the value is rule-based.

## Shared date utility

Added `services/date.js` with centralized helpers:

- `formatDateDisplay(value)`
- `formatDateTimeDisplay(value)`
- `parseDateInput(value)`
- `toStorageDate(value)`
- `isValidDate(value)`

Approved parsing:

- `2026-08-24` -> `2026-08-24`
- `24-08-2026` -> `2026-08-24`
- `24/08/2026` -> `2026-08-24`

Invalid dates such as `31-02-2026` are rejected.

## Date locations audited

Audited with source search for date display and raw date rendering.

Updated:

- Transaction table date
- Transaction table Back date
- Payment table date
- Cashback receipt table date
- Dashboard sync timestamp
- Excel transaction export dates
- Excel payment export dates
- Excel cashback receipt export dates
- Excel transaction import date parser

No separate reminder/history/activity full-date views were found in the current source.

Not changed:

- Month selector
- Year selector
- Statement day labels

## Storage format vs display format

Canonical storage remains:

`YYYY-MM-DD`

User-facing table/export display is:

`DD-MM-YYYY`

The app does not rewrite existing Drive JSON dates into display format.

## Native date input limitations

Current add/edit forms keep native `<input type="date">` controls with ISO values for browser compatibility and mobile date-picker usability.

Browsers may render the native date input text according to browser/locale behavior. Tables, dashboard text, and Excel exports now use the app's `DD-MM-YYYY` formatter.

## Migration behavior

`canonicalizeData()` now initializes missing `cashbackReceipts` as `[]`.

Migration is idempotent and preserves existing collections, revision fields, device ID, cards, transactions, payments, cashback programs, banks, hosts, MCC categories, settings, and limit groups.

Receipt migration normalizes:

- `date` to canonical storage date
- `amount` to number
- `notes` to string

## Import/Export impact

Export now includes a `CashbackReceipts` sheet.

Transaction, payment, and cashback receipt export sheets use actual Excel date cells when possible, with date format `dd-mm-yyyy` applied to user-facing date columns.

Existing transaction import now accepts ISO, `DD-MM-YYYY`, `DD/MM/YYYY`, and Excel serial dates through the shared date parser.

Cashback receipt import was not added because the current import flow is specialized for transaction month sheets (`T##_THANG_##`). A receipt import workflow should be designed separately if needed.

## Tests executed/results

- `node --check app.js` passed.
- `node --check services/date.js` passed.
- `node --check services/local-repository.js` passed.
- `node --check services/sync-service.js` passed.
- `node --check services/default-data.js` passed.
- Date utility tests passed:
  - `2026-08-24` -> `24-08-2026`
  - `2026-01-05` -> `05-01-2026`
  - `2026-12-31` -> `31-12-2026`
  - `24-08-2026` -> `2026-08-24`
  - `24/08/2026` -> `2026-08-24`
  - `31-02-2026` rejected
- Migration smoke test passed:
  - missing `cashbackReceipts` -> `[]`
  - receipt date stored as `YYYY-MM-DD`
  - receipt amount stored as number
  - receipt notes stored as string
- Static audit confirmed transaction/payment/receipt table dates use `formatDateDisplay()`.
- Static audit confirmed no `json_to_sheet(state.transactions)`, `json_to_sheet(state.payments)`, or `json_to_sheet(state.cashbackReceipts)` raw export remains.
- Static assertion confirmed sidebar/view wiring for `cashback-receipts`.
- Static assertion confirmed `renderAll()` calls the receipt renderer.
- Static assertion confirmed receipt CRUD add path uses `saveState()`.
- Static assertion confirmed bank dropdown change refreshes the filtered card dropdown.
- Static assertion confirmed Excel receipt sheet wiring exists.
- Static scan confirmed no forced Google OAuth `prompt:"consent"` or old auto-reconnect markers were reintroduced.
- `git diff --check` passed with Windows LF/CRLF warnings only.

## Remaining manual runtime tests

- [Chưa xác minh] Add cashback receipt in browser.
- [Chưa xác minh] Edit cashback receipt in browser.
- [Chưa xác minh] Delete cashback receipt in browser.
- [Chưa xác minh] Bank dropdown filters cards on desktop/mobile.
- [Chưa xác minh] Month/year dashboard summary with real receipt data.
- [Chưa xác minh] Google Drive sync roundtrip with `cashbackReceipts`.
- [Chưa xác minh] Excel export opened in Excel/Sheets.
- [Chưa xác minh] Mobile date picker visual rendering.

## GitHub Pages compatibility status

The implementation remains static-file compatible:

- no build step added
- no server dependency added
- no OAuth Client ID change
- no client secret added
- no GitHub Pages path change
