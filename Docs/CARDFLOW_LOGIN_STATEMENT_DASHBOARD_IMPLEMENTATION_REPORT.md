# CardFlow Login, Statement Date, Dashboard Implementation Report

## Files modified

- `index.html`
- `styles.css`
- `app.js`
- `services/local-repository.js`
- `Docs/CARDFLOW_LOGIN_STATEMENT_DASHBOARD_IMPLEMENTATION_REPORT.md`

## Schema migration

Added `cards.statementDay`.

Migration rules:

- existing cards without `statementDay` become `statementDay: ""`
- valid values `1..31` are preserved as numbers
- invalid values are normalized to empty
- Card IDs, bank IDs, bank codes, cashback references, transaction references, and payment references are not changed
- migration remains idempotent

## Statement-date implementation

Credit Card Add/Edit forms now include:

`Ngày sao kê`

Control:

- dropdown with empty option
- values `Ngày 1` through `Ngày 31`

Validation:

- empty is allowed
- non-empty must be an integer from `1..31`

Credit Card table now includes:

- `Ngày sao kê`

Display:

- empty -> `Chưa thiết lập`
- `15` -> `Ngày 15`

Cards are exported through the existing JSON-to-sheet `Cards` export, so `statementDay` is included with other card fields.

## Reset demo removal

The visible `Reset demo` button was removed from the production sidebar UI.

No reset action is exposed through normal navigation.

## Login gate behavior

Added a dedicated Google Drive login gate before normal app use.

Startup behavior:

- the main app shell is locked/hidden
- Dashboard/onboarding are not shown before connection
- OAuth is not opened automatically
- OAuth starts only when the user clicks `Kết nối Google Drive`

Login gate text:

- `CardFlow`
- `Quản lý thẻ tín dụng, dòng tiền và cashback`
- `Đăng nhập Google để đồng bộ dữ liệu của bạn trên mọi thiết bị.`
- `Dữ liệu CardFlow được lưu trong Google Drive của chính tài khoản bạn.`

If connection fails, the gate remains visible and shows a Vietnamese error.

## Existing-user behavior

Local user data is not deleted or reset.

The app delays loading the full local dataset until the user starts Google Drive connection. After authentication, the existing sync service is used to reconcile local cache and Drive data with current revision/conflict rules.

Unsynced local data is preserved and handled by the existing sync flow.

## New-user onboarding flow

After Google Drive connection:

- if `settings.setupCompleted === true`, the app opens Dashboard
- if setup is incomplete, the existing onboarding wizard runs:
  1. Mã ngân hàng
  2. Thẻ tín dụng
  3. Host

Onboarding finish still uses existing `saveState()` and sync debounce behavior. No second sync path was added.

## Dashboard visual changes

Dashboard calculations were not changed.

Visual hierarchy improvements:

- KPI cards have restrained semantic accents
- `Tổng tiền đơn`: blue accent
- `Host đã Back`: teal/green accent
- `Đang chờ Back`: amber accent
- `Cashback theo rule`: indigo accent
- positive/negative values use green/red
- card remaining limit has green/amber/red hints
- cashback progress bars use blue/amber/green states
- reminders distinguish warning, near-target, completed, and informational states

The layout remains responsive and compact.

## Tests executed/results

Executed:

- `node --check app.js`
- `node --check services/local-repository.js`
- `node --check services/default-data.js`
- `node --check services/card-id.js`

Module tests:

- existing card without `statementDay` stays empty
- valid `statementDay` is preserved as number
- invalid `statementDay` is rejected during migration
- Card IDs remain unchanged during statementDay migration
- Sacombank still maps to `SACOM`

Browser smoke test at `http://127.0.0.1:5173`:

- login gate is visible on unauthenticated startup
- main app shell is locked before connection
- `Reset demo` is not visible
- gate primary button text is `Kết nối Google Drive`
- `Ngày sao kê` UI text is present
- no browser console errors observed

## Manual runtime tests still required

Not executed in this environment:

- real Google OAuth success
- OAuth cancellation from Google popup
- real Drive file discovery/download/upload
- existing user Drive data loading after connection
- new user onboarding after real Drive connection
- real conflict/revision behavior against Drive
- mobile physical-device testing
- GitHub Pages deployed URL test

## GitHub Pages compatibility status

The app still uses relative paths:

- `styles.css`
- `cardflow.config.js`
- `app.js`
- `services/*.js`

No backend, client secret, or non-GitHub-Pages dependency was added. GitHub Pages compatibility is preserved structurally. Live deployed runtime was not tested.
