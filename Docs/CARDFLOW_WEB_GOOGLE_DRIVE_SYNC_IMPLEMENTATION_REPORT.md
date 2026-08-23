# CardFlow Web Google Drive Sync V2 Implementation Report

## Files created

- `cardflow.config.js`
- `services/default-data.js`
- `services/local-repository.js`
- `services/drive-auth.js`
- `services/drive-repository.js`
- `services/sync-service.js`
- `Docs/CARDFLOW_WEB_GOOGLE_DRIVE_SYNC_IMPLEMENTATION_REPORT.md`

## Files modified

- `index.html`
- `app.js`
- `styles.css`

## Architecture

CardFlow remains a static browser web app. The previous single-script app was split into clear browser modules:

- Local repository: loads, migrates, saves, and tracks sync metadata in browser storage.
- Drive auth: wraps Google Identity Services OAuth.
- Drive repository: wraps Google Drive API v3 file search/create/read/update/backup calls.
- Sync service: owns revision checks, dirty state, conflict detection, backup checks, and online/debounced sync.
- UI adapter: renders the existing dashboard/business calculations and CRUD screens.

Normal CRUD never waits for Drive. Data is saved locally first, marked dirty, then Drive sync is scheduled.

## OAuth scope

The OAuth scope is:

`https://www.googleapis.com/auth/drive.file`

No browser client secret is used or stored. The OAuth client ID is separated into `cardflow.config.js`.

## Drive file strategy

The app uses one canonical Drive JSON file:

`cardflow-data.json`

The Drive `fileId` is stored locally after discovery or creation. The canonical payload uses:

```json
{
  "schemaVersion": 2,
  "revision": 0,
  "updatedAt": "ISO8601",
  "deviceId": "string",
  "cards": [],
  "cashbackPrograms": [],
  "hosts": [],
  "mccCategories": [],
  "transactions": [],
  "payments": [],
  "settings": {}
}
```

## Local data migration

The existing `cardflow-demo-v1` localStorage data is read when no v2 data exists. It is migrated into `cardflow-web-data-v2` without deleting the original v1 key.

Migration behavior:

- `programs` becomes `cashbackPrograms`.
- string `hosts` become host objects.
- hardcoded MCC seed data becomes editable `mccCategories`.
- existing `cards`, `transactions`, and `payments` are preserved.
- sync metadata is stored separately from application data.

## CRUD changes per tab

Consistent toolbar pattern was added:

`[Search] [+ Thêm] [Chỉnh sửa] [Xóa]`

Covered editable tabs:

- Credit Cards: add/edit/delete card rows.
- Cashback Programs: add/edit/delete programs, including channel, category list, caps, targets, and rates.
- Hosts: added a Hosts tab with add/edit/delete; deletion is blocked when transactions still reference the host.
- MCC Categories: added a Nhóm MCC tab with add/edit/delete; deletion is blocked when transactions still reference the category.
- Transactions: add/edit/delete through the same row-selection toolbar and modal form.
- Payments: add/edit/delete through the same row-selection toolbar and modal form.

Double-clicking selected rows opens edit through the same edit path.

## Sync algorithm

Startup:

1. Load local data immediately.
2. Keep app usable without Google authentication.
3. After user connects Google Drive, locate or create `cardflow-data.json`.
4. Read Drive data.
5. Compare local revision, local base revision, dirty flag, and Drive revision.
6. Download newer Drive data when local is clean.
7. Upload dirty local data only when local base revision still matches Drive revision.
8. Refresh UI after downloads and successful uploads.

Sync triggers:

- user clicks `Đồng bộ ngay`
- successful CRUD save through debounce
- browser returns online
- successful Google Drive connection

## Conflict behavior

The app does not silently overwrite newer Drive data. If local data is dirty and the Drive revision no longer matches the local base revision, it shows:

`Dữ liệu đã được cập nhật từ một thiết bị khác.`

Actions:

- `Tải bản mới từ Drive`: replaces local state with Drive data and marks local clean.
- `Giữ bản máy này`: force-uploads local state as the next revision.
- `Hủy`: leaves the conflict unresolved.

## Backup behavior

Before replacing Drive canonical data with a materially changed local dataset, the sync service can create one backup file per day:

`cardflow-data-backup-YYYY-MM-DD.json`

The current threshold is a 25% or greater entity-count difference between local and Drive data. This avoids backup files on every keystroke or small CRUD operation.

## Tests run/results

Executed:

- `node --check app.js`
- `node --check services/local-repository.js`
- `node --check services/drive-auth.js`
- `node --check services/drive-repository.js`
- `node --check services/sync-service.js`
- `node --check services/default-data.js`
- Local HTTP server smoke test at `http://127.0.0.1:5173`
- Browser render smoke test: Dashboard, Google Drive status, and card navigation rendered with no console errors.
- Module test with mocked localStorage:
  - v1 local data migrates to schema v2.
  - local save marks data dirty.
  - Drive revision mismatch creates conflict.
  - `Tải bản mới từ Drive` behavior replaces local state and marks clean.

Partially executed:

- Browser CRUD add/edit flows started successfully for modal UI, but the browser automation layer became flaky around local delete confirmation clicks. Deletion logic remains implemented with confirmation and was reviewed in code.

Not executed:

- Real Google OAuth login.
- Real Drive file creation/upload/download.
- Second physical browser/computer sync.
- Real offline/reconnect browser scenario.
- Logout/reconnect against a real Google account.

## Remaining Google Cloud Console setup

Create an OAuth 2.0 Client ID for a browser app and place it in `cardflow.config.js`:

```js
window.CardFlowConfig = {
  googleClientId: "YOUR_CLIENT_ID.apps.googleusercontent.com"
};
```

Add the local or hosted web origin to Authorized JavaScript origins, for example:

- `http://127.0.0.1:5173`
- the final production hosting origin

Enable Google Drive API v3 for the Google Cloud project.

## Remaining runtime/manual test items

Manual testing with a real Google OAuth client is still needed for:

- first Google Drive connection
- initial upload
- second browser/computer download
- offline CRUD
- reconnect and sync
- device A/device B conflict
- delete propagation through Drive
- logout/reconnect Google account
- backup file creation on significant data replacement
