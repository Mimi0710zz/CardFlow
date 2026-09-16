import assert from "node:assert/strict";
import { canonicalizeData } from "../services/local-repository.js";
import { CARD_FEE_ORDER_TYPE } from "../services/order-type.js";
import { TRANSACTION_STATUS, transactionStatusForTransaction, transactionStatusLabel } from "../services/transaction-status.js";
import { isPersonalUseTransaction, orderTransactions, personalUseTransactions, replaceTransactionById, transactionAmountTotal } from "../services/transaction-views.js";

const rows=[
  {id:"PERSONAL",status:TRANSACTION_STATUS.PERSONAL_USE,amount:100},
  {id:"SENT",status:TRANSACTION_STATUS.SENT_BILL,amount:200},
  {id:"BACK",status:TRANSACTION_STATUS.HOST_BACK,amount:300},
  {id:"FEE",orderType:CARD_FEE_ORDER_TYPE,status:TRANSACTION_STATUS.CARD_FEE,amount:400},
  {id:"LEGACY-PERSONAL",status:"Tiêu cá nhân",amount:500}
];

assert.equal(isPersonalUseTransaction(rows[0]),true);
assert.deepEqual(personalUseTransactions(rows).map(row=>row.id),["PERSONAL","LEGACY-PERSONAL"]);
assert.deepEqual(orderTransactions(rows).map(row=>row.id),["SENT","BACK","FEE"]);
assert.equal(transactionStatusForTransaction(rows[4]),TRANSACTION_STATUS.PERSONAL_USE);

const sentToPersonal=rows.map(row=>({...row}));
assert.equal(replaceTransactionById(sentToPersonal,"SENT",{...sentToPersonal[1],status:TRANSACTION_STATUS.PERSONAL_USE}),true);
assert.equal(orderTransactions(sentToPersonal).some(row=>row.id==="SENT"),false);
assert.equal(personalUseTransactions(sentToPersonal).some(row=>row.id==="SENT"),true);

const personalToSent=rows.map(row=>({...row}));
assert.equal(replaceTransactionById(personalToSent,"PERSONAL",{...personalToSent[0],status:TRANSACTION_STATUS.SENT_BILL}),true);
assert.equal(personalUseTransactions(personalToSent).some(row=>row.id==="PERSONAL"),false);
assert.equal(orderTransactions(personalToSent).some(row=>row.id==="PERSONAL"),true);

const filteredPersonal=personalUseTransactions(rows).filter(row=>row.id==="PERSONAL");
assert.equal(transactionAmountTotal(orderTransactions(rows)),900);
assert.equal(transactionAmountTotal(filteredPersonal),100);

const filteredRows=[rows[2],rows[1]];
const master=rows.map(row=>({...row}));
assert.equal(replaceTransactionById(master,filteredRows[1].id,{...filteredRows[1],amount:999}),true);
assert.equal(master.find(row=>row.id==="SENT").amount,999);
assert.equal(master.find(row=>row.id==="BACK").amount,300);

const serialized=JSON.stringify(canonicalizeData({schemaVersion:16,cards:[],mccCategories:[],transactions:rows}));
assert.equal(serialized.includes("personalTransactions"),false);
assert.equal(serialized.includes("orderTransactions"),false);
const reloaded=canonicalizeData(JSON.parse(serialized));
assert.equal(Array.isArray(reloaded.transactions),true);
assert.equal(reloaded.transactions.length,rows.length);
assert.equal(personalUseTransactions(reloaded.transactions).length,2);
assert.equal(transactionStatusLabel(transactionStatusForTransaction(reloaded.transactions.find(row=>row.id==="FEE"))),"Phí thẻ");

console.log("transaction child-tab tests passed");
