import assert from "node:assert/strict";
import { buildTrackingMatrix } from "../services/tracking-matrix-engine.js";
import { financialTransactions, isBugLazadaTransaction } from "../services/financial-totals.js";
import { calculateDashboardHostBackMetrics } from "../services/dashboard-host-back.js";
import { TRANSACTION_STATUS } from "../services/transaction-status.js";

const transactions=[
  {id:"NORMAL",cardId:"CARD-1",date:"2026-09-05",orderType:"POS",mcc:"5812",mccCategoryId:"MCC-5812",channel:"Online",host:"HOST-1",status:TRANSACTION_STATUS.SENT_BILL,amount:1000,backAmount:900},
  {id:"BUG",cardId:"CARD-1",date:"2026-09-06",orderType:"BUG-LAZADA",mcc:"5812",mccCategoryId:"MCC-5812",channel:"Online",host:"HOST-1",status:TRANSACTION_STATUS.SENT_BILL,amount:4000,backAmount:3000},
  {id:"BUG-OFFLINE",cardId:"CARD-1",date:"2026-09-07",orderType:"BUG-LAZADA",mcc:"5812",mccCategoryId:"MCC-5812",channel:"Offline",host:"HOST-1",status:TRANSACTION_STATUS.SENT_BILL,amount:8000,backAmount:0},
  {id:"BUG-OTHER-MCC",cardId:"CARD-1",date:"2026-09-08",orderType:"BUG-LAZADA",mcc:"5411",mccCategoryId:"MCC-5411",channel:"Online",host:"HOST-1",status:TRANSACTION_STATUS.SENT_BILL,amount:16000,backAmount:0},
  {id:"BUG-OTHER-CARD",cardId:"CARD-2",date:"2026-09-09",orderType:"BUG-LAZADA",mcc:"5812",mccCategoryId:"MCC-5812",channel:"Online",host:"HOST-1",status:TRANSACTION_STATUS.SENT_BILL,amount:32000,backAmount:0}
];

assert.equal(isBugLazadaTransaction(transactions[1]),true);
assert.equal(isBugLazadaTransaction({orderTypeCode:"BUG-LAZADA"}),true);
assert.deepEqual(financialTransactions(transactions).map(transaction=>transaction.id),["NORMAL"]);

const financialTotals=financialTransactions(transactions).reduce((totals,transaction)=>({
  amount:totals.amount+(Number(transaction.amount)||0),
  backAmount:totals.backAmount+(Number(transaction.backAmount)||0),
  hostFee:totals.hostFee+((Number(transaction.backAmount)||0)-(Number(transaction.amount)||0))
}),{amount:0,backAmount:0,hostFee:0});
assert.deepEqual(financialTotals,{amount:1000,backAmount:900,hostFee:-100});

const dashboardMetrics=calculateDashboardHostBackMetrics(financialTransactions(transactions));
assert.equal(dashboardMetrics.hostBack,900);
assert.equal(dashboardMetrics.waiting,0);
assert.equal(dashboardMetrics.waitingCount,0);

const state={
  hosts:[{id:"HOST-1",name:"Host 1"}],
  banks:[{id:"BANK",name:"Bank"}],
  cards:[{id:"CARD-1",bankId:"BANK",cashbackCycle:"monthly"},{id:"CARD-2",bankId:"BANK",cashbackCycle:"monthly"}],
  mccCategories:[{id:"MCC-5812",name:"Restaurant",mcc:"5812"},{id:"MCC-5411",name:"Market",mcc:"5411"}],
  cashbackPrograms:[{
    id:"PROGRAM-1",
    name:"Online Restaurant",
    cardId:"CARD-1",
    year:2026,
    month:9,
    combineOperator:"AND",
    conditions:[{id:"COND-1",mccCategoryIds:["MCC-5812"],channel:"Online",rate:0.01,max:50}],
    totalSpendCondition:{enabled:true,amount:5000}
  }],
  transactions
};

const matrix=buildTrackingMatrix(state,{year:2026,month:9,referenceDate:"2026-09-12"});
const cell=matrix.rows[0].cells[0];
assert.equal(cell.total,29000);
assert.equal(cell.eligible,5000);
assert.equal(cell.conditions[0].progress,1);
assert.equal(cell.combinationSatisfied,true);
assert.equal(cell.status,"COMPLETED");

console.log("bug-lazada scope tests passed");
