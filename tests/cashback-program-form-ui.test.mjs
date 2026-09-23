import assert from "node:assert/strict";
import fs from "node:fs";
const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
assert.match(app,/data-condition-name/);
assert.match(app,/data-program-package-id/);
assert.match(app,/data-card-statement-min/);
assert.match(app,/cashbackCardConfigs/);
assert.doesNotMatch(app,/name:`Điều kiện \$\{number\}`/);
console.log("cashback program form UI tests passed");
