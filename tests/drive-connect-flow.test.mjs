import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(new URL("../app.js",import.meta.url),"utf8");

const renderSyncStatus=source.match(/function renderSyncStatus\(\)\{[\s\S]*?\n\}/)?.[0] || "";
const renderLoginGate=source.match(/function renderLoginGate\(\)\{[\s\S]*?\n\}/)?.[0] || "";
const connectHandler=source.match(/async function connectGoogleDriveFromUi\(\)\{[\s\S]*?\n\}/)?.[0] || "";

assert.match(renderSyncStatus,/connectDrive"\)\.disabled=isManualConnecting\(\) \|\| connected/);
assert.doesNotMatch(renderSyncStatus,/connectDrive"\)\.disabled=.*!auth\.isReady\(\)/);

assert.match(renderLoginGate,/button\.disabled = isManualConnecting\(\)/);
assert.doesNotMatch(renderLoginGate,/button\.disabled = .*auth\.isReady\(\)/);

assert.match(connectHandler,/if\(!auth\.isConfigured\(\)\)/);
assert.match(connectHandler,/if\(!window\.google\?\.accounts\?\.oauth2\)/);
assert.match(connectHandler,/watchGoogleSdkReadiness\(\)/);

assert.match(source,/querySelector\("#gateConnectDrive"\)\.addEventListener\("click",connectGoogleDriveFromUi\)/);
assert.match(source,/querySelector\("#connectDrive"\)\.addEventListener\("click",connectGoogleDriveFromUi\)/);

console.log("drive connect flow tests passed");
