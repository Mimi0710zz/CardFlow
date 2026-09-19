import assert from "node:assert/strict";
import fs from "node:fs";
import * as cashbackTransactionsModule from "../services/cashback-transactions.js";

assert.equal(typeof cashbackTransactionsModule.summarizeCashbackReceipts,"function");
const summary=cashbackTransactionsModule.summarizeCashbackReceipts([
  {id:"1",cardId:"CARD-B",amount:100000},
  {id:"2",cardId:"CARD-A",amount:200000},
  {id:"3",cardId:"CARD-A",amount:50000},
  {id:"4",cardId:"",amount:99999}
]);
assert.deepEqual(summary,{cardCount:2,totalCashback:449999});

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../styles.css",import.meta.url),"utf8");
assert.match(app,/cashback-receipt-total-row/);
assert.match(app,/\$\{summary\.cardCount\} thẻ/);
assert.match(app,/positive cashback-receipt-amount/);
assert.match(app,/\$\{esc\(r\.cardId\|\|"—"\)\}/);
assert.match(css,/cashback-receipt-total-row/);
assert.match(app,/syncCashbackReceiptsTableStickyOffset\(\)/);

console.log("cashback receipts summary tests passed");
