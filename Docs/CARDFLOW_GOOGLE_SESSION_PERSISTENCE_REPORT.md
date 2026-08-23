# CardFlow Google Session Persistence Report

## Root cause of infinite loading

The previous startup reconnect flow did not have a single owner for auth UI state. It mixed `startupReconnectAttempting`, `startupReconnectMessage`, `appUnlocked`, and async OAuth/sync callbacks.

The most important failure path was after auth started: Google callback or Drive API work could hang or complete late while the UI still depended on those async paths to reset the login gate. Drive initialization also had no timeout/abort boundary, so a token response was treated as enough progress even though Drive file discovery/read/sync could still block the startup path.

## Files modified

- `app.js`
- `services/drive-repository.js`
- `services/sync-service.js`
- `Docs/CARDFLOW_GOOGLE_SESSION_PERSISTENCE_REPORT.md`

## Auth state machine

`app.js` now owns auth UI with explicit states:

- `DISCONNECTED`
- `AUTO_CONNECTING`
- `MANUAL_CONNECTING`
- `CONNECTED`
- `ERROR`

The login gate, setup wizard, and Drive connect button now read from this state instead of inferring from unrelated booleans.

## Hard watchdog implementation

When `googleConnectionPreferred === true`, startup enters `AUTO_CONNECTING`, shows:

`Đang kết nối Google Drive...`

It starts one independent 3000 ms watchdog. If the automatic reconnect is not fully authenticated and Drive-initialized before the watchdog fires, the attempt is invalidated and the UI returns to the manual login gate with:

`Không thể tự động kết nối Google Drive. Vui lòng kết nối lại để tiếp tục.`

The remembered connection preference is not cleared by this timeout.

## Late-callback protection

Every auth flow increments `authAttemptId`.

Expired attempts are invalidated by incrementing the generation and calling `auth.cancelPendingRequest()`. `DriveAuth` also guards GIS callbacks with its own request generation, so late Google callbacks cannot update token state, enter Dashboard, or start a duplicate sync for an expired attempt.

## Drive initialization timeout

Authentication success is no longer enough to unlock the app.

After token acquisition, Drive initialization runs through `syncService.syncNow({ silent:false, signal })` with a 5000 ms timeout. The Drive repository now accepts `AbortSignal` for Drive API requests, and timeout aborts the in-flight Drive operation.

If Drive initialization times out or aborts, sync status returns to `disconnected` instead of leaving a loading state.

## Manual fallback behavior

During `AUTO_CONNECTING`, the login gate now keeps an escape button visible as:

`Kết nối thủ công`

Clicking it invalidates the auto attempt and starts `MANUAL_CONNECTING`. Manual login is not governed by the 3000 ms auto watchdog, but Drive initialization after manual auth is still guarded by the 5000 ms Drive timeout.

Explicit `Ngắt kết nối` still uses the existing disconnect path, clears the remembered preference, and prevents automatic reconnect on refresh.

## Security and compatibility

Unchanged:

- OAuth Client ID
- `drive.file` scope
- no access token persistence
- no refresh token persistence
- no client secret
- `cardflow-data.json`
- local-first storage
- revision/conflict sync logic
- GitHub Pages static deployment model

## Tests executed/results

- `node --check app.js` passed.
- `node --check services/drive-auth.js` passed.
- `node --check services/drive-repository.js` passed.
- `node --check services/sync-service.js` passed.
- Static scan confirmed old `appUnlocked`, `startupReconnectAttempting`, and `startupReconnectMessage` state ownership was removed.
- Static scan confirmed `AUTO_CONNECTING`, `MANUAL_CONNECTING`, `CONNECTED`, `ERROR`, and `DISCONNECTED` states exist.
- Static scan confirmed the auto watchdog uses 3000 ms.
- Static scan confirmed Drive initialization uses 5000 ms.
- Static scan confirmed Drive API calls accept `AbortSignal`.
- HTTP asset check passed at `http://127.0.0.1:4173` for `index.html`, `app.js`, `services/sync-service.js`, `services/drive-repository.js`, and `services/drive-auth.js`.

## Remaining real Google runtime tests

- [Chưa xác minh] rememberedConnection = false -> manual login gate immediately.
- [Chưa xác minh] rememberedConnection = true + silent reconnect succeeds quickly -> app continues normally.
- [Chưa xác minh] silent Google callback never fires -> manual login gate after 3 seconds.
- [Chưa xác minh] silent callback arrives after timeout -> ignored.
- [Chưa xác minh] token succeeds but Drive API hangs -> Drive timeout/manual login gate.
- [Chưa xác minh] Google returns OAuth error -> manual login gate immediately.
- [Chưa xác minh] user clicks manual connect while auto attempt is active -> auto invalidated/manual works.
- [Chưa xác minh] explicit disconnect clears remembered preference.
- [Chưa xác minh] refresh after explicit disconnect -> no automatic reconnect.
- [Chưa xác minh] refresh with remembered preference -> maximum one automatic attempt.
- [Chưa xác minh] no duplicate Drive sync.
- [Chưa xác minh] no duplicate OAuth callbacks affecting UI.
- [Chưa xác minh] mobile browser.
- [Chưa xác minh] GitHub Pages production URL.
