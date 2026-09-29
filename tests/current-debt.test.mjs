import assert from "node:assert/strict";
import test from "node:test";
import { calculateCardCurrentDebt } from "../services/payment-statement.js";

const card={id:"CARD-A",cardType:"credit",statementDay:20,paymentTrackingStartMonth:"2026-09"};

test("recorded statement bill is authoritative and a fully paid cycle contributes zero debt",()=>{
  const debt=calculateCardCurrentDebt({
    card,
    transactions:[{id:"T1",cardId:"CARD-A",date:"2026-09-10",amount:100_000_000,orderType:"STANDARD"}],
    payments:[{cardId:"CARD-A",statementCycle:"2026-09",statementBillAmount:10_000_000,billRecorded:true,paidAmount:10_000_000}]
  });
  assert.equal(debt,0);
});

test("partially paid statement contributes only bill minus paid amount",()=>{
  const debt=calculateCardCurrentDebt({
    card,
    transactions:[{id:"T1",cardId:"CARD-A",date:"2026-09-10",amount:100_000_000,orderType:"STANDARD"}],
    payments:[{cardId:"CARD-A",statementCycle:"2026-09",statementBillAmount:10_000_000,billRecorded:true,paidAmount:4_000_000}]
  });
  assert.equal(debt,6_000_000);
});

test("unbilled transactions after the statement date remain current debt",()=>{
  const debt=calculateCardCurrentDebt({
    card,
    transactions:[
      {id:"T1",cardId:"CARD-A",date:"2026-09-10",amount:10_000_000,orderType:"STANDARD"},
      {id:"T2",cardId:"CARD-A",date:"2026-09-21",amount:3_000_000,orderType:"STANDARD"}
    ],
    payments:[{cardId:"CARD-A",statementCycle:"2026-09",statementBillAmount:10_000_000,billRecorded:true,paidAmount:10_000_000}]
  });
  assert.equal(debt,3_000_000);
});

test("transactions before payment tracking start do not inflate current debt",()=>{
  const debt=calculateCardCurrentDebt({
    card,
    transactions:[
      {id:"OLD",cardId:"CARD-A",date:"2026-08-10",amount:80_000_000,orderType:"STANDARD"},
      {id:"NEW",cardId:"CARD-A",date:"2026-09-21",amount:5_000_000,orderType:"STANDARD"}
    ],
    payments:[]
  });
  assert.equal(debt,5_000_000);
});

test("cashback credited to card limit reduces current debt",()=>{
  const debt=calculateCardCurrentDebt({
    card,
    transactions:[{id:"T1",cardId:"CARD-A",date:"2026-09-21",amount:5_000_000,orderType:"STANDARD"}],
    cashbackCredit:500_000
  });
  assert.equal(debt,4_500_000);
});

test("card without statement day preserves legacy cumulative fallback",()=>{
  const debt=calculateCardCurrentDebt({
    card:{id:"CARD-B",cardType:"credit",statementDay:""},
    transactions:[{id:"T1",cardId:"CARD-B",date:"2026-09-01",amount:8_000_000,orderType:"STANDARD"}],
    payments:[{cardId:"CARD-B",statementCycle:"2026-09",paidAmount:3_000_000}],
    cashbackCredit:500_000
  });
  assert.equal(debt,4_500_000);
});
