# CardFlow Google Session Persistence Report

## Automatic reconnect removed

Startup Google Drive auto/silent reconnect has been removed.

On normal load or refresh, the app now:

1. Loads local application data safely.
2. Shows the Google Drive login gate.
3. Shows `Kết nối Google Drive`.
4. Does not call Google OAuth.
5. Does not request an access token.
6. Does not show `Đang kết nối Google Drive...` until the user clicks the connect button.

The previous `AUTO_CONNECTING` state, startup reconnect preference read, silent reconnect function, auto watchdog, and `Kết nối thủ công` fallback button were removed from `app.js`.

## Simplified auth states

`app.js` now uses only:

- `DISCONNECTED`
- `MANUAL_CONNECTING`
- `CONNECTED`
- `ERROR`

`DISCONNECTED` and `ERROR` keep the login gate visible with the normal connect button.

`MANUAL_CONNECTING` is entered only after the user clicks `Kết nối Google Drive`, and then shows `Đang kết nối Google Drive...`.

`CONNECTED` unlocks the application and continues normal Dashboard/onboarding behavior.

## Manual connection workflow

When the user clicks `Kết nối Google Drive`:

1. Local data is loaded.
2. The existing interactive Google OAuth flow starts with `prompt:"consent"`.
3. The access token is held in memory only.
4. Drive initialization runs through the existing sync/revision/conflict flow.
5. The app proceeds to Dashboard or first-time setup.

If OAuth is cancelled, blocked, or fails, the app stays on the login gate, shows a Vietnamese error message, and leaves the connect button available.

## Obsolete reconnect code removed

Removed or disabled from startup auth flow:

- `AUTO_CONNECTING`
- startup `googleConnectionPreferred` read
- silent/non-interactive startup token request
- `attemptSilentGoogleReconnect()`
- 3-second startup auto-connect watchdog
- auto reconnect retry/fallback behavior
- `Kết nối thủ công` auto fallback button
- saving `googleConnectionPreferred` after manual connection

`LocalRepository.saveMeta()` strips legacy `googleConnectionPreferred` if old metadata is passed in, so old local metadata cannot re-enable auto reconnect.

Manual OAuth callback generation protection (`authAttemptId` and DriveAuth request generation) remains because it is still useful for normal manual OAuth cancellation/late callbacks.

## Explicit disconnect

`Ngắt kết nối` still:

- revokes/clears the in-memory Google token state
- clears Drive file link metadata
- returns to the login gate
- keeps financial data in local storage
- does not trigger automatic reconnect

## Security and compatibility

Unchanged:

- OAuth Client ID
- `drive.file` scope
- no access token persistence
- no refresh token persistence
- no client secret
- `cardflow-data.json`
- Google Drive repository
- local-first storage
- revision/conflict/backup logic
- onboarding workflow
- GitHub Pages static deployment model

## Tests executed/results

- `node --check app.js` passed.
- `node --check services/local-repository.js` passed.
- `node --check services/drive-auth.js` passed.
- `node --check services/sync-service.js` passed.
- `node --check services/drive-repository.js` passed.
- Static source scan found no `AUTO_CONNECTING`, startup reconnect variable, `attemptSilentGoogleReconnect()`, auto fallback button, auto watchdog, or startup silent auth call in `app.js`.
- Static startup check confirmed `authState` starts as `DISCONNECTED`.
- Static startup check confirmed local data is loaded before initial render.
- [Chưa xác minh] Real interactive OAuth was not executed.
- [Chưa xác minh] Real Google Drive sync after manual connection was not executed.

## Remaining manual runtime tests

- Fresh page load -> connect button shown.
- Browser refresh -> connect button shown.
- Confirm no OAuth prompt/request happens before click.
- Click connect -> interactive OAuth opens and succeeds.
- Successful connection -> existing Drive data loads.
- New user -> onboarding works after connection.
- OAuth cancel -> login gate remains available.
- OAuth error -> login gate remains available.
- Disconnect -> returns to login gate.
- No infinite `Đang kết nối Google Drive...` state.
- Google Drive sync still works after manual connection.
- GitHub Pages production URL remains compatible.
