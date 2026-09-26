import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
assert.match(app,/name:"orderFeePercent", label:"Phí Đơn \(%\)"/);
assert.match(app,/name:"orderFeeFixed", label:"Phí Đơn \(VNĐ\)"[^\n]+kind:"money"/);
assert.match(app,/name:"hostFeeAmount", label:"Phí Host \(VNĐ\)"[^\n]+readonly:!cardFee/);
assert.match(app,/name:"backAmount", label:"Tiền về \(VND\)"[^\n]+readonly:!cardFee/);
assert.match(app,/\[amount,orderFeePercent,orderFeeFixed\]\.forEach\(input=>input\.addEventListener\("input",recalculate\)\)/);
assert.match(app,/colspan="2" class="transaction-fee-group">PHÍ ĐƠN/);
assert.match(app,/>%<\/th><th class="transaction-fee-compact">VNĐ<\/th>/);
assert.doesNotMatch(app,/function transactionDifference\(/);
assert.match(app,/importTransactionRows\(transactionAssignmentRows\)/);

console.log("transaction fee UI tests passed");
