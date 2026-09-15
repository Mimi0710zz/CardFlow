import assert from "node:assert/strict";
import {
  CASHBACK_TRANSACTION_METHOD_OPTIONS,
  cashbackTransactionMethodLabel,
  normalizeTransactionMethod
} from "../services/cashback.js";

assert.deepEqual(CASHBACK_TRANSACTION_METHOD_OPTIONS,[
  {value:"",label:"Tất cả"},
  {value:"Online",label:"Online"},
  {value:"Offline",label:"Quẹt POS"}
]);

assert.equal(normalizeTransactionMethod("offline"),"Offline");
assert.equal(normalizeTransactionMethod("pos"),"Offline");
assert.equal(cashbackTransactionMethodLabel("offline"),"Quẹt POS");
assert.equal(cashbackTransactionMethodLabel("pos"),"Quẹt POS");
assert.equal(cashbackTransactionMethodLabel("online"),"Online");
assert.equal(cashbackTransactionMethodLabel(""),"Tất cả");
assert.equal(CASHBACK_TRANSACTION_METHOD_OPTIONS.some(option=>option.label==="Offline"),false);

console.log("cashback transaction-method UI tests passed");
