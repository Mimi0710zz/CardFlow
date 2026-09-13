import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canonicalizeData } from "../services/local-repository.js";
import {
  compareTransactionsNewestFirst,
  currentTransactionTime,
  LEGACY_TRANSACTION_TIME,
  normalizeTransactionTime,
  resolveTransactionTimeForSave
} from "../services/transaction-time.js";

const sameDate=[
  {id:"MORNING",date:"2026-09-13",transactionTime:"10:00:00"},
  {id:"AFTERNOON",date:"2026-09-13",transactionTime:"15:00:00"}
].sort(compareTransactionsNewestFirst);
assert.deepEqual(sameDate.map(transaction=>transaction.id),["AFTERNOON","MORNING"]);

const differentDates=[
  {id:"OLDER",date:"2026-09-12",transactionTime:"23:55:00"},
  {id:"NEWER",date:"2026-09-13",transactionTime:"00:01:00"}
].sort(compareTransactionsNewestFirst);
assert.deepEqual(differentDates.map(transaction=>transaction.id),["NEWER","OLDER"]);

const legacy=[
  {id:"LATE",date:"2026-09-13",transactionTime:"15:00:00"},
  {id:"LEGACY",date:"2026-09-13"}
].sort(compareTransactionsNewestFirst);
assert.deepEqual(legacy.map(transaction=>transaction.id),["LATE","LEGACY"]);
assert.equal(normalizeTransactionTime(undefined),LEGACY_TRANSACTION_TIME);
assert.equal(resolveTransactionTimeForSave("08:15:32",{transactionTime:"14:05:09"}),"08:15:32");
assert.equal(resolveTransactionTimeForSave("",{transactionTime:"14:05:09"}),"14:05:09");

const persisted=canonicalizeData({
  schemaVersion:13,
  banks:[{id:"BANK",code:"BANK",name:"Bank"}],
  cards:[],
  mccCategories:[{id:"MCC-1",name:"Food",mcc:"5812"}],
  transactions:[
    {id:"KEEP",date:"2026-09-13",transactionTime:"08:15:32",orderType:"Order",mccCategoryId:"MCC-1"},
    {id:"LEGACY",date:"2026-09-13",orderType:"Order",mccCategoryId:"MCC-1"}
  ]
});
assert.equal(persisted.transactions.find(transaction=>transaction.id==="KEEP").transactionTime,"08:15:32");
assert.equal(persisted.transactions.find(transaction=>transaction.id==="LEGACY").transactionTime,LEGACY_TRANSACTION_TIME);

assert.match(currentTransactionTime(new Date(2026,8,13,14,5,9)),/^14:05:09$/);

const appSource=readFileSync(new URL("../app.js",import.meta.url),"utf8");
assert.equal(appSource.includes("<th>Thời gian</th>"),false);
assert.equal(appSource.includes('name:"transactionTime"'),true);

console.log("transaction-time tests passed");
