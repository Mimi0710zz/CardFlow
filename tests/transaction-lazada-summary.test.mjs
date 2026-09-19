import assert from "node:assert/strict";
import fs from "node:fs";
import * as financialTotalsModule from "../services/financial-totals.js";

assert.equal(typeof financialTotalsModule.transactionSummaryTransactions,"function");
const rows=[
  {id:"NORMAL",orderType:"POS",amount:100000,backAmount:95000},
  {id:"LAZADA",orderType:"LAZADA",amount:200000,backAmount:190000},
  {id:"LAZADA-LOWER",orderType:" lazada ",amount:300000,backAmount:280000},
  {id:"OLD",orderType:"BUG-LAZADA",amount:400000,backAmount:390000}
];
assert.deepEqual(
  financialTotalsModule.transactionSummaryTransactions(rows).map(row=>row.id),
  ["NORMAL","OLD"]
);

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
assert.match(app,/transactionSummaryTransactions\(transactions\)/);

console.log("transaction LAZADA summary tests passed");
