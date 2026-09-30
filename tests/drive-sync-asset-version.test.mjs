import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert.match(
  html,
  /<script type="module" src="app\.js\?v=20260930-mb-pla-package-migration-v2"><\/script>/,
  "index.html phải dùng cache key mới cho app.js chứa manual Drive sync confirmation"
);
console.log("drive sync asset version test passed");
