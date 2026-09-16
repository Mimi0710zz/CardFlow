import assert from "node:assert/strict";
import { canonicalizeData } from "../services/local-repository.js";
import { CARD_FEE_ORDER_TYPE } from "../services/order-type.js";
import { matchesTransactionFilters } from "../services/transaction-filter.js";
import {
  TRANSACTION_STATUS,
  TRANSACTION_STATUS_OPTIONS,
  normalizeTransactionStatus,
  transactionStatusForTransaction,
  transactionStatusLabel
} from "../services/transaction-status.js";

assert.equal(transactionStatusLabel(TRANSACTION_STATUS.SENT_BILL),"Đã thanh toán và gửi bill");
assert.equal(TRANSACTION_STATUS.CARD_FEE,"card_fee");
assert.equal(transactionStatusLabel(TRANSACTION_STATUS.CARD_FEE),"Phí thẻ");
assert.equal(TRANSACTION_STATUS_OPTIONS.some(option=>option.value===TRANSACTION_STATUS.CARD_FEE),true);
assert.deepEqual(TRANSACTION_STATUS_OPTIONS.map(option=>option.label),[
  "Đã thanh toán và gửi bill",
  "Host đã back",
  "Tiêu cá nhân",
  "Phí thẻ"
]);

assert.equal(normalizeTransactionStatus("paid_bill_sent"),TRANSACTION_STATUS.SENT_BILL);
assert.equal(normalizeTransactionStatus("Đã thanh toán"),TRANSACTION_STATUS.SENT_BILL);
assert.equal(normalizeTransactionStatus("Đã Back"),TRANSACTION_STATUS.HOST_BACK);
assert.equal(transactionStatusForTransaction({orderType:CARD_FEE_ORDER_TYPE,status:""}),TRANSACTION_STATUS.CARD_FEE);
assert.equal(matchesTransactionFilters({orderType:CARD_FEE_ORDER_TYPE,status:""},{status:TRANSACTION_STATUS.CARD_FEE}),true);

const data=canonicalizeData({
  schemaVersion:16,
  cards:[],
  mccCategories:[],
  orderTypes:[{id:"CARD-FEE",name:CARD_FEE_ORDER_TYPE}],
  transactions:[
    {id:"CARD-FEE",orderType:CARD_FEE_ORDER_TYPE,status:"",backAmount:123456,backDate:"2026-09-16"},
    {id:"PERSONAL",orderType:"POS",status:TRANSACTION_STATUS.PERSONAL_USE,host:"Host",backAmount:654321,backDate:"2026-09-15"}
  ]
});
const cardFee=data.transactions.find(transaction=>transaction.id==="CARD-FEE");
assert.equal(cardFee.status,TRANSACTION_STATUS.CARD_FEE);
assert.equal(cardFee.backAmount,123456);
assert.equal(cardFee.backDate,"2026-09-16");

const personal=data.transactions.find(transaction=>transaction.id==="PERSONAL");
assert.equal(personal.status,TRANSACTION_STATUS.PERSONAL_USE);
assert.equal(personal.host,null);
assert.equal(personal.backAmount,0);
assert.equal(personal.backDate,"");

console.log("transaction card-fee status tests passed");
