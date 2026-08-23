# CardFlow Google Session Persistence Report

## Files modified

- `app.js`
- `services/local-repository.js`
- `Docs/CARDFLOW_GOOGLE_SESSION_PERSISTENCE_REPORT.md`

## Safe persisted metadata

Added safe local sync metadata:

- `googleConnectionPreferred: true | false`

This records only that the user previously chose to connect Google Drive.

The app does not persist:

- access tokens
- refresh tokens
- client secrets
- Google credentials
- OAuth data inside `cardflow-data.json`

## Google Identity Services mechanism

The non-interactive reconnect attempt uses the existing Google Identity Services OAuth token client:

- `google.accounts.oauth2.initTokenClient(...)`
- `tokenClient.requestAccessToken({ prompt: "" })`

This asks GIS/browser Google session state to restore an access token without an explicit consent popup when the browser and Google account session permit it.

Persistent login is not guaranteed across all browsers. Silent restore can fail when:

- the Google session expired
- the user revoked consent
- third-party cookie/session policies block the flow
- browser privacy settings prevent silent token restore
- the user previously disconnected
- the OAuth client/session requires renewed user interaction

In those cases, the app falls back to the normal login gate.

## Startup behavior

On startup:

1. The app reads only safe local sync metadata.
2. If `googleConnectionPreferred === true`, the login gate shows:
   `Đang kết nối Google Drive...`
3. The normal `Kết nối Google Drive` button is temporarily hidden during the silent attempt.
4. If silent restore succeeds:
   - local data is loaded
   - existing sync/revision/conflict flow is reused
   - Drive status can proceed to connected/synced
   - Dashboard or onboarding continues based on existing state
5. If silent restore fails:
   - the gate remains visible
   - the button returns
   - the status shows:
     `Phiên Google cần được xác nhận lại.`

OAuth is never opened automatically with a popup. The explicit popup/consent flow still starts only from the user's `Kết nối Google Drive` click.

## Disconnect behavior

When the user clicks `Ngắt kết nối`:

- GIS revoke is called for the in-memory access token when present
- `googleConnectionPreferred` is cleared
- Drive file metadata is cleared
- the login gate is shown again
- CardFlow financial data is not deleted

Refresh or browser reopen does not behave like an explicit disconnect.

## Preserved behavior

Unchanged:

- static GitHub Pages architecture
- Google OAuth client ID
- `drive.file` scope
- no backend
- no client secret
- no token persistence
- existing Drive repository
- existing revision/conflict logic
- existing local-first data
- onboarding flow

## Tests executed/results

Executed:

- `node --check app.js`
- `node --check services/local-repository.js`
- `node --check services/drive-auth.js`
- `node --check services/sync-service.js`

Module metadata tests:

- default `googleConnectionPreferred` is `false`
- preference can be saved without storing an access token
- disconnect clears the preference and file metadata

Browser smoke test at `http://127.0.0.1:5173`:

- login gate renders
- app shell remains locked before connection
- normal connect button remains visible when no preference exists
- no console errors observed

## Manual runtime tests still required

Not executed in this environment:

- first real Google login
- refresh after real login
- close/reopen browser after real login
- successful silent restore with an active Google session
- expired/revoked session fallback
- explicit disconnect then reconnect
- real Drive sync after silent restore
- mobile browser behavior
- deployed GitHub Pages runtime

## GitHub Pages compatibility status

The change uses only existing static browser JavaScript and relative paths.

No backend, secret, build step, or absolute deployment path was added. GitHub Pages compatibility is preserved structurally. Live deployment was not tested.
