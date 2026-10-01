import assert from "node:assert/strict";
import test from "node:test";
import { buildPaymentHistoryRows, classifyPaymentTransaction, normalizePaymentTransaction, PAYMENT_TRANSACTION_TYPE, paymentAmountForCycle, resolvePaymentTransactionCycle } from "../services/payment-ledger.js";
import { buildStatementPaymentRows, calculateCardCurrentDebt } from "../services/payment-statement.js";
import { canonicalizeDataWithMigration } from "../services/local-repository.js";

const card={id:"CAKE-SIG",cardType:"credit",statementDay:20,paymentTermDays:24,paymentTrackingStartMonth:"2026-09"};

test("legacy paid amount migrates to payment ledger exactly once",()=>{
  const first=canonicalizeDataWithMigration({schemaVersion:20,cards:[card],payments:[{id:"PAY-1",cardId:card.id,statementCycle:"2026-10",statementBillAmount:10_000_000,billRecorded:true,paidAmount:4_000_000,paymentDate:"2026-10-25"}]});
  assert.equal(first.data.schemaVersion,21);
  assert.equal(first.data.paymentTransactions.length,1);
  assert.equal(first.data.paymentTransactions[0].amount,4_000_000);
  const second=canonicalizeDataWithMigration(first.data);
  assert.equal(second.changed,false);
  assert.equal(second.data.paymentTransactions.length,1);
});

test("multiple deposits aggregate into statement paid amount",()=>{
  const rows=buildStatementPaymentRows([card],[{cardId:card.id,statementYear:2026,statementMonth:10,statementBillAmount:10_000_000,billRecorded:true}],2026,10,{}, {paymentTransactions:[
    {id:"A",cardId:card.id,date:"2026-10-21",amount:3_000_000,statementCycle:"2026-10"},
    {id:"B",cardId:card.id,date:"2026-10-25",amount:7_000_000,statementCycle:"2026-10"}
  ]});
  assert.equal(rows[0].paidAmount,10_000_000);
  assert.equal(rows[0].outstandingAmount,0);
  assert.equal(rows[0].paymentStatusCode,"paid");
  assert.equal(rows[0].paymentDate,"2026-10-25");
});

test("prepayment before statement reduces current debt",()=>{
  const debt=calculateCardCurrentDebt({
    card,
    transactions:[{id:"T1",cardId:card.id,date:"2026-10-01",amount:20_000_000,orderType:"STANDARD"}],
    payments:[],
    paymentTransactions:[{id:"P1",cardId:card.id,date:"2026-10-01",amount:15_000_000,statementCycle:"2026-10"}]
  });
  assert.equal(debt,5_000_000);
});

test("payment above debt clamps debt at zero and history exposes credit",()=>{
  const ledger=[normalizePaymentTransaction({id:"P1",cardId:card.id,date:"2026-10-01",amount:15_000_000,statementCycle:"2026-10",type:PAYMENT_TRANSACTION_TYPE.EXCESS})];
  const debt=calculateCardCurrentDebt({
    card,
    transactions:[{id:"T1",cardId:card.id,date:"2026-10-01",amount:10_000_000,orderType:"STANDARD"}],
    paymentTransactions:ledger
  });
  assert.equal(debt,0);
  const row=buildPaymentHistoryRows({cards:[card],transactions:[{id:"T1",cardId:card.id,date:"2026-10-01",amount:10_000_000,orderType:"STANDARD"}],paymentTransactions:ledger})[0];
  assert.equal(row.debtBefore,10_000_000);
  assert.equal(row.debtAfter,0);
  assert.equal(row.creditAfter,5_000_000);
});

test("payment is allocated to oldest unpaid recorded statement first",()=>{
  const payments=[
    {cardId:card.id,statementCycle:"2026-09",statementBillAmount:5_000_000,billRecorded:true},
    {cardId:card.id,statementCycle:"2026-10",statementBillAmount:8_000_000,billRecorded:true}
  ];
  const ledger=[{cardId:card.id,statementCycle:"2026-09",amount:2_000_000}];
  assert.equal(resolvePaymentTransactionCycle({card,payments,paymentTransactions:ledger,date:"2026-10-15"}),"2026-09");
  assert.equal(paymentAmountForCycle(ledger,card.id,"2026-09"),2_000_000);
  assert.equal(classifyPaymentTransaction({card,currentDebt:20_000_000,amount:3_000_000,statementCycle:"2026-09",payments,paymentTransactions:ledger}),PAYMENT_TRANSACTION_TYPE.STATEMENT);
});
