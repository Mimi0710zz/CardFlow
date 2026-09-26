import assert from "node:assert/strict";
import { calculateTransactionFee, normalizeTransactionFee, transactionFeeProfitDelta } from "../services/transaction-fee-model.js";
import { canonicalizeData } from "../services/local-repository.js";

assert.deepEqual(calculateTransactionFee(5_000_000,3.7,0),{orderAmount:5_000_000,orderFeePercent:3.7,orderFeeFixed:0,hostFeeAmount:185_000,returnAmount:4_815_000});
assert.deepEqual(calculateTransactionFee(5_000_000,0,10_000),{orderAmount:5_000_000,orderFeePercent:0,orderFeeFixed:10_000,hostFeeAmount:10_000,returnAmount:4_990_000});
assert.deepEqual(calculateTransactionFee(5_000_000,3.7,10_000),{orderAmount:5_000_000,orderFeePercent:3.7,orderFeeFixed:10_000,hostFeeAmount:195_000,returnAmount:4_805_000});
assert.deepEqual(calculateTransactionFee("5.000.000","",""),{orderAmount:5_000_000,orderFeePercent:0,orderFeeFixed:0,hostFeeAmount:0,returnAmount:5_000_000});
assert.deepEqual(calculateTransactionFee(1_234_567,3.8,0),{orderAmount:1_234_567,orderFeePercent:3.8,orderFeeFixed:0,hostFeeAmount:46_914,returnAmount:1_187_653});
assert.equal(transactionFeeProfitDelta({hostFeeAmount:195_000,orderFeeFixed:10_000}),-195_000);

const percentOnly=normalizeTransactionFee({amount:5_000_000,hostFeePercent:3.7});
assert.deepEqual([percentOnly.orderFeePercent,percentOnly.orderFeeFixed,percentOnly.hostFeeAmount,percentOnly.returnAmount,percentOnly.backAmount],[3.7,0,185_000,4_815_000,4_815_000]);
const percentAndTotal=normalizeTransactionFee({amount:5_000_000,hostFeePercent:3.7,hostFeeAmount:195_000});
assert.deepEqual([percentAndTotal.orderFeePercent,percentAndTotal.orderFeeFixed,percentAndTotal.hostFeeAmount,percentAndTotal.returnAmount],[3.7,10_000,195_000,4_805_000]);
const amountAndReturn=normalizeTransactionFee({amount:5_000_000,backAmount:4_805_000});
assert.deepEqual([amountAndReturn.orderFeePercent,amountAndReturn.orderFeeFixed,amountAndReturn.hostFeeAmount,amountAndReturn.returnAmount],[0,195_000,195_000,4_805_000]);
assert.deepEqual(normalizeTransactionFee(percentAndTotal),percentAndTotal);

const stored=canonicalizeData({schemaVersion:20,transactions:[{id:"TX",amount:5_000_000,orderFeePercent:3.7,orderFeeFixed:10_000,hostFeeAmount:195_000,returnAmount:4_805_000}]});
const reloaded=canonicalizeData(stored);
assert.deepEqual(reloaded.transactions[0],stored.transactions[0]);

console.log("transaction fee model tests passed");
