# CardFlow Transaction Status Runtime Dropdown Fix Report

## Why previous implementation did not affect the live dropdown

The current source path was already using the canonical 4-status source, but the deployed/runtime page can keep loading an older cached `app.js` entry module. The workspace has no build output or duplicate transaction form renderer; `index.html` loads `app.js` directly.

To prevent the browser/deployment from continuing to serve an old module entry, the `app.js` script URL was versioned.

## Exact runtime source of the 7 legacy options

In this workspace, no production-relevant hardcoded 7-option transaction status list remains. The legacy list came from the older `txFields()` implementation in `app.js` before canonical status migration.

Current runtime path:

```text
index.html
-> <script type="module" src="app.js?v=20260827-status-schema">
-> renderTransactions()
-> wireToolbar("transactions")
-> add/edit handler
-> openForm(...)
-> txFields(...)
-> TRANSACTION_STATUS_OPTIONS
```

## Exact file/function fixed

- `index.html`: versioned the `app.js` module entry.
- `app.js`: current transaction form runtime source is `txFields()`.
- `services/transaction-status.js`: canonical status source.

## Duplicate status definitions

No duplicate production status dropdown definition was found. The only legacy labels in runtime source are in the migration/import compatibility map.

## Canonical status source after cleanup

`services/transaction-status.js` exports:

- `paid_bill_sent` -> `Đã thanh toán + Gửi bill`
- `host_back` -> `Host đã back`
- `issue` -> `Có vấn đề`
- `cancelled` -> `Huỷ`

## Modified files

- `index.html`

## Add form result

Runtime Chrome headless check confirmed the Add Transaction modal renders exactly:

- `paid_bill_sent | Đã thanh toán + Gửi bill`
- `host_back | Host đã back`
- `issue | Có vấn đề`
- `cancelled | Huỷ`

## Edit form result

Runtime Chrome headless check confirmed the Edit Transaction modal renders the same 4 options. A test record with `status = "paid_bill_sent"` opened with `Đã thanh toán + Gửi bill` selected.

## Persisted status result

The form option values are canonical internal keys. Saving continues through `normalizeTx()`, which normalizes and persists canonical keys.

## Migration result

The existing one-time migration remains intact:

- `Đã thanh toán` -> `paid_bill_sent`
- `Đã gửi Host` -> `paid_bill_sent`
- `Đơn đã đi` -> `paid_bill_sent`
- `Chờ Back` -> `paid_bill_sent`
- `Đã Back` -> `host_back`
- `Có vấn đề` -> `issue`
- `Hủy` / `Huỷ` -> `cancelled`

## Runtime asset/build/cache findings

`index.html` directly loads `app.js`; there is no `dist`, `public`, build script, service worker file, manifest, or Cache API app code in this workspace. Runtime check reported no active service worker registrations for the local app.

Observed runtime scripts:

- `xlsx.full.min.js`
- Google Identity Services
- `cardflow.config.js`
- `app.js?v=20260827-status-schema`

## Tests executed

- Runtime Add Transaction modal option check in Chrome headless: passed.
- Runtime Edit Transaction modal option and selected-value check in Chrome headless: passed.
- Runtime badge check for canonical status: passed in the first CDP run.
- Runtime service worker registration check: passed, no registrations.
- `node --check app.js`: passed.
- `node --check services/transaction-status.js`: passed.
- `node --check services/local-repository.js`: passed.
- `node --check services/fee-target.js`: passed.
- Status migration regression checks: passed.
- Source scan found no production legacy transaction status dropdown list.

## Actual browser runtime result

Verified with Chrome `151.0.7922.174` via DevTools Protocol against `http://127.0.0.1:4173`.

## Remaining unverified items

- Signed-in Google Drive roundtrip with the user's real Drive file: [Chưa xác minh]
- Deployed production host cache behavior after publishing this `index.html` change: [Chưa xác minh]
