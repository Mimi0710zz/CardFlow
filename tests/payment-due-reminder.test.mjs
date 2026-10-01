import assert from "node:assert/strict";
import test from "node:test";
import { buildCardPaymentObligations, calculatePaymentDueWarnings } from "../services/payment-due.js";

const card={id:"VIB-MAX",cardType:"credit",statementDay:10,paymentDueDay:4};

// Raw spend may be higher than the bank statement bill. Once a statement exists,
// the statement bill (not transaction total) is the amount that must be settled.
test("paid September statement does not reappear as an October due reminder",()=>{
  const transactions=[
    {id:"T1",cardId:card.id,date:"2026-09-01",amount:20_000_000,orderType:"STANDARD"}
  ];
  const payments=[{
    id:"PAY-SEP",cardId:card.id,statementCycle:"2026-09",
    statementBillAmount:15_000_000,billRecorded:true,paidAmount:15_000_000,
    paymentDate:"2026-09-25",paymentStatus:"paid"
  }];
  const ledger=[{
    id:"LEDGER-SEP",cardId:card.id,statementCycle:"2026-09",
    date:"2026-09-25",amount:15_000_000,type:"statement"
  }];

  const obligations=buildCardPaymentObligations([card],transactions,payments,ledger);
  const september=obligations.find(item=>item.cycle==="2026-09");
  assert.ok(september);
  assert.equal(september.statementBillAmount,15_000_000);
  assert.equal(september.paymentAmount,15_000_000);
  assert.equal(september.outstandingAmount,0);
  assert.deepEqual(calculatePaymentDueWarnings([card],transactions,payments,new Date(2026,9,1),ledger),[]);
});

test("partially paid recorded statement still produces a reminder",()=>{
  const transactions=[{id:"T1",cardId:card.id,date:"2026-09-01",amount:20_000_000,orderType:"STANDARD"}];
  const payments=[{cardId:card.id,statementCycle:"2026-09",statementBillAmount:15_000_000,billRecorded:true}];
  const ledger=[{id:"L1",cardId:card.id,statementCycle:"2026-09",date:"2026-09-25",amount:10_000_000}];
  const warnings=calculatePaymentDueWarnings([card],transactions,payments,new Date(2026,9,1),ledger);
  assert.equal(warnings.length,1);
  assert.equal(warnings[0].cycle,"2026-09");
  assert.equal(warnings[0].outstandingAmount,5_000_000);
});

test("legacy paid statement stays settled even without a ledger row",()=>{
  const transactions=[{id:"T1",cardId:card.id,date:"2026-09-01",amount:20_000_000,orderType:"STANDARD"}];
  const payments=[{cardId:card.id,statementCycle:"2026-09",statementBillAmount:15_000_000,billRecorded:true,paidAmount:15_000_000,paymentStatus:"paid"}];
  assert.deepEqual(calculatePaymentDueWarnings([card],transactions,payments,new Date(2026,9,1),[]),[]);
});
