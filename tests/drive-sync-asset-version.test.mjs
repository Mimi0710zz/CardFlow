import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const trackingUi = readFileSync(new URL("../services/tracking-matrix-ui.js", import.meta.url), "utf8");
const trackingEngine = readFileSync(new URL("../services/tracking-matrix-engine.js", import.meta.url), "utf8");
assert.match(
  html,
  /<script type="module" src="app\.js\?v=20260927-transaction-fixed-display-v5"><\/script>/,
  "index.html phải dùng cache key mới cho transaction fee"
);
assert.match(html,/styles\.css\?v=20260927-transaction-fixed-display-v5/);
assert.match(app,/cashback-evaluation\.js\?v=20260926-cashback-priority-v1/);
assert.match(app,/tracking-matrix-ui\.js\?v=20260926-cashback-priority-v1/);
assert.match(trackingUi,/tracking-matrix-engine\.js\?v=20260926-cashback-priority-v1/);
assert.match(trackingEngine,/cashback-evaluation\.js\?v=20260926-cashback-priority-v1/);
console.log("drive sync asset version test passed");
