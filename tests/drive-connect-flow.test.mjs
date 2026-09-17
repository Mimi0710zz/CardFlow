import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(new URL("../app.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");

const renderSyncStatus=source.match(/function renderSyncStatus\(\)\{[\s\S]*?\n\}/)?.[0] || "";
const renderLoginGate=source.match(/function renderLoginGate\(\)\{[\s\S]*?\n\}/)?.[0] || "";
const connectHandler=source.match(/async function connectGoogleDriveFromUi\(\)\{[\s\S]*?\n\}/)?.[0] || "";
const initializeDrive=source.match(/async function initializeDriveForAttempt\([\s\S]*?\n\}/)?.[0] || "";
const manualSyncHandler=source.match(/async function syncGoogleDriveFromUi\(\)\{[\s\S]*?\n\}/)?.[0] || "";

assert.match(renderSyncStatus,/connectDrive"\)\.disabled=isManualConnecting\(\) \|\| connected/);
assert.doesNotMatch(renderSyncStatus,/connectDrive"\)\.disabled=.*!auth\.isReady\(\)/);

assert.match(renderLoginGate,/button\.disabled = isManualConnecting\(\)/);
assert.doesNotMatch(renderLoginGate,/button\.disabled = .*auth\.isReady\(\)/);

assert.match(connectHandler,/if\(!auth\.isConfigured\(\)\)/);
assert.match(connectHandler,/if\(!window\.google\?\.accounts\?\.oauth2\)/);
assert.match(connectHandler,/watchGoogleSdkReadiness\(\)/);

assert.match(source,/querySelector\("#gateConnectDrive"\)\.addEventListener\("click",connectGoogleDriveFromUi\)/);
assert.match(source,/querySelector\("#connectDrive"\)\.addEventListener\("click",connectGoogleDriveFromUi\)/);
assert.match(connectHandler,/initializeDriveForAttempt/);
assert.doesNotMatch(connectHandler,/syncNow/);
assert.match(initializeDrive,/inspectAfterConnect/);
assert.doesNotMatch(initializeDrive,/syncNow/);
assert.match(manualSyncHandler,/openManualDriveSyncConfirmation/);
assert.match(manualSyncHandler,/runConfirmedDriveSync/);
assert.match(html,/Dữ liệu trên máy và Google Drive đang khác nhau\./);
assert.match(html,/Đồng bộ dữ liệu hiện tại lên Google Drive\?/);
assert.match(html,/data-drive-conflict-download/);
assert.match(html,/data-drive-conflict-keep-local/);
assert.match(html,/data-drive-conflict-cancel/);
assert.match(html,/data-drive-sync-no/);
assert.match(html,/data-drive-sync-yes/);

console.log("drive connect flow tests passed");
