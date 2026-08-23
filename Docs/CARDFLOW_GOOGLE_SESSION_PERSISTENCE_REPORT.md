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

1. The app enters `MANUAL_CONNECTING`.
2. The existing interactive Google OAuth flow starts immediately from the click handler.
3. The access token is held in memory only.
4. Local data is loaded after the OAuth token callback returns.
5. Drive initialization runs through the existing sync/revision/conflict flow.
6. The app proceeds to Dashboard or first-time setup.

If OAuth is cancelled, blocked, or fails, the app stays on the login gate, shows a Vietnamese error message, and leaves the connect button available.

## Previous prompt behavior

The previous manual flow forced `prompt:"consent"` for every click. That was removed because it can be brittle on mobile browsers and unnecessarily forces re-consent for users who already granted the `drive.file` permission.

Final `requestAccessToken()` configuration:

- Default manual connection calls `auth.connect()` with no forced `prompt`.
- `DriveAuth.connect({prompt})` still supports an explicit prompt option for future true re-consent cases, but the normal UI does not pass `prompt:"consent"`.
- No startup or background call uses silent OAuth.
- `SyncService.syncNow()` and `DriveRepository.request()` no longer start OAuth when a token is missing; they return a disconnected/not-authenticated failure instead.

## Mobile-safe click flow

The click handler now does:

`button click -> set MANUAL_CONNECTING -> auth.connect() -> requestAccessToken()`

No async local-data load or Drive initialization runs before `requestAccessToken()`. This keeps the token request directly tied to the user's tap/click for mobile Chrome popup compatibility.

The Connect button is enabled only after Google Identity Services is ready. If `google.accounts.oauth2` is unavailable, the app shows:

`Không tải được dịch vụ đăng nhập Google. Vui lòng tải lại trang.`

At startup the app logs safe origin diagnostics only:

- `window.location.origin`
- `window.location.href`

## Diagnostic error handling added

Diagnostics now preserve real error codes/reasons without logging access tokens.

- OAuth/token callback errors are logged as `[Google OAuth]`.
- Popup/open/cancel errors from GIS `error_callback` are captured.
- `idpiframe_initialization_failed` shows mobile browser guidance in Vietnamese.
- Drive API non-OK responses are logged as `[Google Drive API]` with status/statusText/body.
- Sync failures are logged as `[Google Drive Sync]`.
- User-facing messages now distinguish:
  - OAuth/auth failure: `Không thể đăng nhập Google.`
  - Drive API failure: `Đã đăng nhập Google nhưng không thể truy cập Google Drive.`
  - Network failure: `Không thể kết nối mạng tới Google Drive.`

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
- Static scan confirmed normal manual UI no longer passes `prompt:"consent"`.
- Static scan confirmed `requestAccessToken()` can be called without prompt options.
- Static scan confirmed no forced or empty prompt OAuth fallback remains in runtime `app.js`/`services`.
- Static scan confirmed `auth.connect()` is called before local data reload in the manual click flow.
- Static assertion confirmed `DriveRepository.request()` does not call OAuth.
- Static assertion confirmed `SyncService.syncNow()` does not call OAuth when a token is missing.
- Static scan confirmed safe origin logging exists.
- Static source scan found no `AUTO_CONNECTING`, startup reconnect variable, `attemptSilentGoogleReconnect()`, auto fallback button, auto watchdog, or startup silent auth call in `app.js`.
- Static startup check confirmed `authState` starts as `DISCONNECTED`.
- Static startup check confirmed local data is loaded before initial render.
- [Chưa xác minh] Real interactive OAuth was not executed.
- [Chưa xác minh] Real Google Drive sync after manual connection was not executed.
- [Chưa xác minh] Android/mobile Chrome runtime was not executed.

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
- Android Chrome manual OAuth.
- Mobile Chrome incognito.
- Popup blocked case.
- User cancel case.
- Previously granted user without forced consent.
- First-time consent.
- Drive 401/403 diagnostics.
- Production origin `https://mimi0710zz.github.io`.
- GitHub Pages production URL remains compatible.
