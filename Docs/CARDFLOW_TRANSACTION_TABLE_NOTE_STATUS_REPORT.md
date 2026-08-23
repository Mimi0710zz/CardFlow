# CardFlow Transaction Table Note And Status Report

## Root cause

The active source has only one transaction table renderer: `renderTransactions()` in `app.js`, and `renderAll()` calls it directly.

If production still showed the old column set after the previous local change, the likely cause was that production was still serving an older deployed/cached `app.js`/`styles.css` rather than a different renderer in this source tree. No second production transaction-table renderer was found in the current source.

This update explicitly verifies the active renderer contract:

- `renderAll()` calls `renderTransactions()`
- `renderTransactions()` writes to `#view-transactions`
- `renderTransactions()` emits the `Ghi chú` header and cell
- `renderTransactions()` applies the transaction status badge in the actual `Trạng thái` cell

## Active render function modified

- `app.js`
  - `txStatusBadge(status)`
  - `renderTransactions()`

## Files modified

- `app.js`
- `styles.css`
- `Docs/CARDFLOW_TRANSACTION_TABLE_NOTE_STATUS_REPORT.md`

## Final Transaction table column order

1. `Ngày`
2. `Host`
3. `Loại đơn`
4. `MCC`
5. `Kênh`
6. `Thẻ`
7. `Tiền đơn`
8. `Trạng thái`
9. `Ngày Back`
10. `Tiền Back`
11. `Ghi chú`
12. `Chênh lệch`

## Note field behavior

The active schema field used by Add/Edit Transaction is `note`.

The table displays:

- `transaction.note`
- fallback `transaction.notes` only for tolerance of older/alternate data
- empty note as `—`

Long notes use `td.note-cell`:

- max width: `240px`
- single-line ellipsis through the existing table `white-space: nowrap`
- full value in `title`

## Status value to class mapping

Styling comparison trims the status text but does not modify stored data.

- `Đã Back` -> `transaction-status transaction-status--success`
- `Chờ Back` -> `transaction-status transaction-status--danger`
- `Chưa Back` -> `transaction-status transaction-status--danger`
- `Có vấn đề` -> `transaction-status transaction-status--warning`
- other values -> `transaction-status transaction-status--neutral`

CSS uses the existing palette variables:

- success: light green background, `var(--good)` text
- danger: light red background, `var(--bad)` text
- warning: light amber background
- neutral: existing muted grey

## Preserved behavior

Unchanged:

- transaction CRUD
- Add/Edit modal fields
- row selection and double-click edit
- filtering/search text
- DD-MM-YYYY display
- money formatting
- calculations
- Google Drive sync
- GitHub Pages compatibility

## Verification results

- `node --check app.js` passed.
- `git diff --check -- app.js styles.css` passed with Windows LF/CRLF warnings only.
- Static active-renderer contract passed:
  - `renderTransactions()` exists.
  - `renderAll()` calls `renderTransactions()`.
  - renderer targets `#view-transactions`.
  - renderer emits `<th>Tiền Back</th><th>Ghi chú</th><th>Chênh lệch</th>`.
  - renderer emits `<td class="note-cell">`.
  - renderer calls `txStatusBadge(t.status)` for the active status cell.
  - status mapping includes success/danger/warning classes.
  - CSS contains active `.transaction-status--success`, `.transaction-status--danger`, and `.transaction-status--warning`.

## Runtime/browser verification

- [Chưa xác minh] Browser DOM verification was not performed because the available tool context did not provide a DOM inspection browser/Playwright/Puppeteer runtime.
- The local preview can be opened at `http://localhost:8000` while the local server is running.
- Production must be redeployed or cache-refreshed for GitHub Pages users to see this source update.
