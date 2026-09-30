import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
assert.match(app,/from "\.\/services\/mb-platinum-transaction-form\.js/);
assert.match(app,/name:"cashbackPackageId"/);
assert.match(app,/name:"cashbackProgramId"/);
assert.match(app,/buildMbPlatinumTransactionFormModel\(/);
assert.match(app,/const mbInitialModel=.*buildMbPlatinumTransactionFormModel/);
assert.match(app,/mbInitialModel\.packageOptions/);
assert.match(app,/mbInitialModel\.programOptions/);
assert.match(app,/validateMbPlatinumTransactionAssignment\(/);
assert.match(app,/normalizeMbPlatinumTransactionAssignment\(/);
assert.match(app,/statementMinSpend:totalAmount/);
console.log("MB Platinum client wiring tests passed");
