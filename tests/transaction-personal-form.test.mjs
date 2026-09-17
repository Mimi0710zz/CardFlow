import assert from "node:assert/strict";
import { TRANSACTION_STATUS, transactionStatusForTransaction } from "../services/transaction-status.js";
import { TRANSACTION_FORM_CONTEXT, transactionFieldsForContext, transactionValuesForContext } from "../services/transaction-form-context.js";
import { canonicalizeData } from "../services/local-repository.js";

const sharedFields=[
  {name:"date"},
  {name:"cardId"},
  {name:"host",required:true},
  {name:"status",required:true},
  {name:"note"}
];

for(const mode of ["add","edit"]){
  const personalFields=transactionFieldsForContext(sharedFields,TRANSACTION_FORM_CONTEXT.PERSONAL);
  assert.equal(personalFields.some(field=>field.name==="host"),false,`Personal ${mode} must hide Host`);
  assert.equal(personalFields.some(field=>field.name==="status"),false,`Personal ${mode} must hide Status`);
}

const personalValues=transactionValuesForContext({cardId:"CARD-01",host:"Old Host",status:TRANSACTION_STATUS.HOST_BACK},TRANSACTION_FORM_CONTEXT.PERSONAL);
assert.equal(personalValues.host,"");
assert.equal(personalValues.status,TRANSACTION_STATUS.PERSONAL_USE);
assert.equal(transactionStatusForTransaction({orderType:"Phí thẻ",status:personalValues.status}),TRANSACTION_STATUS.PERSONAL_USE);
const persisted=canonicalizeData({transactions:[{id:"PERSONAL",orderType:"Phí thẻ",host:"Old Host",status:personalValues.status}]});
assert.equal(persisted.transactions[0].status,TRANSACTION_STATUS.PERSONAL_USE);
assert.equal(persisted.transactions[0].host,null);

const orderFields=transactionFieldsForContext(sharedFields,TRANSACTION_FORM_CONTEXT.ORDER);
assert.equal(orderFields.some(field=>field.name==="host"),true);
assert.equal(orderFields.some(field=>field.name==="status"),true);
const orderValues={host:"Host A",status:TRANSACTION_STATUS.HOST_BACK};
assert.equal(transactionValuesForContext(orderValues,TRANSACTION_FORM_CONTEXT.ORDER),orderValues);

console.log("transaction personal form tests passed");
