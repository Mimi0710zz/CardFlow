import assert from "node:assert/strict";
import { bankTextColor } from "../services/card-bank-colors.js";
import { buildStatementPaymentRows, summarizeCardPaymentPopulation } from "../services/payment-statement.js";

const cards=[
  ...Array.from({length:25},(_,index)=>({id:`CREDIT-${index+1}`,bankId:`BANK-${index+1}`,cardType:"credit",statementDay:10,paymentTermDays:45})),
  {id:"DEBIT-1",bankId:"BANK-D1",cardType:"debit"},
  {id:"DEBIT-2",bankId:"BANK-D2",cardType:"debit"},
  {id:"DEBIT-3",bankId:"BANK-D3",cardType:"debit"}
];

assert.deepEqual(summarizeCardPaymentPopulation(cards),{
  creditCardCount:25,
  totalCardCount:28
});

const filteredRows=buildStatementPaymentRows(cards,[],2026,9,{cardId:"CREDIT-1"});
assert.equal(filteredRows.length,1);
assert.deepEqual(summarizeCardPaymentPopulation(cards),{
  creditCardCount:25,
  totalCardCount:28
});

const mbPla={id:"MB Pla",bankId:"BANK-MB",bank:"MB"};
const mbSig={id:"MB Sig",bankId:"BANK-MB",bank:"MB"};
const mbUlti={id:"MB Ulti",bankId:"BANK-MB",bank:"MB"};
const hdb={id:"HDB Vietjet",bankId:"BANK-HDB",bank:"HDBank"};
const tech={id:"TECH Every",bankId:"BANK-TECH",bank:"Techcombank"};

assert.equal(bankTextColor(mbPla),bankTextColor(mbSig));
assert.equal(bankTextColor(mbPla),bankTextColor(mbUlti));
assert.notEqual(bankTextColor(mbPla),bankTextColor(hdb));
assert.notEqual(bankTextColor(hdb),bankTextColor(tech));
assert.equal(bankTextColor(mbPla),bankTextColor({...mbPla}));

console.log("card-payment population and color tests passed");
