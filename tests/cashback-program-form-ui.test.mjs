import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../styles.css",import.meta.url),"utf8");

assert.match(app,/data-label="Chi để đạt Max CB"/);
assert.match(app,/data-condition-min[^>]*readonly/);
assert.match(app,/function recalculateCashbackConditionRow\(row\)/);
assert.match(app,/calculateSpendToMax\(rate,max\)/);
assert.match(app,/\[data-condition-rate\],\[data-condition-max\],\[data-condition-max-type\]/);
assert.match(app,/cashback-condition-note-row/);
assert.match(css,/\.cashback-condition-note-row\{/);
assert.match(css,/\.cashback-condition-min-auto/);

console.log("cashback program form UI tests passed");
