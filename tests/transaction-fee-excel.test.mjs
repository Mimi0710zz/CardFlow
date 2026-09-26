import assert from "node:assert/strict";
import { exportTransactionFeeColumns, importTransactionFeeColumns } from "../services/transaction-fee-excel.js";

const transaction={amount:5_000_000,orderFeePercent:3.7,orderFeeFixed:10_000,hostFeeAmount:195_000,returnAmount:4_805_000};
assert.deepEqual(exportTransactionFeeColumns(transaction),{"Phí Đơn (%)":3.7,"Phí Đơn (VNĐ)":10_000,"Phí Host (VNĐ)":195_000,"Tiền về":4_805_000});
assert.deepEqual(importTransactionFeeColumns({"Tiền đơn":5_000_000,"Phí Đơn (%)":3.7,"Phí Đơn (VNĐ)":10_000}),transaction);
assert.deepEqual(importTransactionFeeColumns({"Tiền đơn":5_000_000,"Phí Host (%)":3.7,"Phí Host (VNĐ)":195_000}),transaction);
assert.deepEqual(importTransactionFeeColumns({"Tiền đơn":5_000_000,"Tiền về":4_805_000}),{amount:5_000_000,orderFeePercent:0,orderFeeFixed:195_000,hostFeeAmount:195_000,returnAmount:4_805_000});

console.log("transaction fee Excel tests passed");
