import assert from "node:assert/strict";
import {
  CASHBACK_RECEIPT_DESTINATION,
  cashbackCreditForCard,
  cashbackReceiptDestinationLabel,
  calculateOutstandingDebt,
  normalizeCashbackReceiptDestination
} from "../services/cashback-receipt-destination.js";

assert.equal(normalizeCashbackReceiptDestination(undefined,{legacy:true}),CASHBACK_RECEIPT_DESTINATION.CASH_OR_POINTS);
assert.equal(normalizeCashbackReceiptDestination(undefined),CASHBACK_RECEIPT_DESTINATION.CREDIT_LIMIT);
assert.equal(normalizeCashbackReceiptDestination("Hoàn vào hạn mức thẻ"),CASHBACK_RECEIPT_DESTINATION.CREDIT_LIMIT);
assert.equal(normalizeCashbackReceiptDestination("Hoàn thành tiền/điểm đổi"),CASHBACK_RECEIPT_DESTINATION.CASH_OR_POINTS);
assert.equal(cashbackReceiptDestinationLabel(CASHBACK_RECEIPT_DESTINATION.CREDIT_LIMIT),"Hoàn vào hạn mức thẻ");

const receipts=[
  {cardId:"A",amount:500000,destination:"credit_limit"},
  {cardId:"A",amount:1000000,destination:"cash_or_points"},
  {cardId:"B",amount:700000,destination:"credit_limit"},
  {cardId:"A",amount:900000}
];
assert.equal(cashbackCreditForCard(receipts,"A"),500000);
assert.equal(calculateOutstandingDebt({spent:10000000,paid:2000000,cashbackCredit:500000}),7500000);
assert.equal(calculateOutstandingDebt({spent:300000,paid:0,cashbackCredit:500000}),0);

console.log("cashback receipt destination tests passed");
