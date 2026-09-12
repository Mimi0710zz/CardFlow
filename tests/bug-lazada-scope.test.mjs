import assert from "node:assert/strict";
import { buildTrackingMatrix } from "../services/tracking-matrix-engine.js";
import { financialTransactions, isBugLazadaTransaction } from "../services/financial-totals.js";
import { calculateDashboardHostBackMetrics } from "../services/dashboard-host-back.js";
import { TRANSACTION_STATUS } from "../services/transaction-status.js";

const baseTransactions=[
  {id:"NORMAL",cardId:"CARD-1",date:"2026-09-05",orderType:"POS",mcc:"5812",mccCategoryId:"MCC-5812",channel:"Online",host:"HOST-1",status:TRANSACTION_STATUS.SENT_BILL,amount:6000000,backAmount:5900000},
  {id:"BUG",cardId:"CARD-1",date:"2026-09-06",orderType:"BUG-LAZADA",mcc:"5812",mccCategoryId:"MCC-5812",channel:"Online",host:"HOST-1",status:TRANSACTION_STATUS.SENT_BILL,amount:5000000,backAmount:4900000}
];

const edgeCaseTransactions=[
  ...baseTransactions,
  {id:"BUG-OFFLINE",cardId:"CARD-1",date:"2026-09-07",orderType:"BUG-LAZADA",mcc:"5812",mccCategoryId:"MCC-5812",channel:"Offline",host:"HOST-1",status:TRANSACTION_STATUS.SENT_BILL,amount:8000000,backAmount:0},
  {id:"BUG-OTHER-MCC",cardId:"CARD-1",date:"2026-09-08",orderType:"BUG-LAZADA",mcc:"5411",mccCategoryId:"MCC-5411",channel:"Online",host:"HOST-1",status:TRANSACTION_STATUS.SENT_BILL,amount:16000000,backAmount:0},
  {id:"BUG-OTHER-CARD",cardId:"CARD-2",date:"2026-09-09",orderType:"BUG-LAZADA",mcc:"5812",mccCategoryId:"MCC-5812",channel:"Online",host:"HOST-1",status:TRANSACTION_STATUS.SENT_BILL,amount:32000000,backAmount:0},
  {id:"BUG-OUTSIDE-PERIOD",cardId:"CARD-1",date:"2026-10-01",orderType:"BUG-LAZADA",mcc:"5812",mccCategoryId:"MCC-5812",channel:"Online",host:"HOST-1",status:TRANSACTION_STATUS.SENT_BILL,amount:64000000,backAmount:0}
];

assert.equal(isBugLazadaTransaction(baseTransactions[1]),true);
assert.equal(isBugLazadaTransaction({orderTypeCode:"BUG-LAZADA"}),true);
assert.deepEqual(financialTransactions(edgeCaseTransactions).map(transaction=>transaction.id),["NORMAL"]);

const financialTotals=financialTransactions(edgeCaseTransactions).reduce((totals,transaction)=>({
  amount:totals.amount+(Number(transaction.amount)||0),
  backAmount:totals.backAmount+(Number(transaction.backAmount)||0),
  hostFee:totals.hostFee+((Number(transaction.backAmount)||0)-(Number(transaction.amount)||0))
}),{amount:0,backAmount:0,hostFee:0});
assert.deepEqual(financialTotals,{amount:6000000,backAmount:5900000,hostFee:-100000});

const dashboardMetrics=calculateDashboardHostBackMetrics(financialTransactions(edgeCaseTransactions));
assert.equal(dashboardMetrics.hostBack,5900000);
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
    conditions:[{id:"COND-1",mccCategoryIds:["MCC-5812"],channel:"Online",rate:0.01,max:100000}],
    totalSpendCondition:{enabled:true,amount:10000000}
  }],
  transactions:baseTransactions
};

const matrix=buildTrackingMatrix(state,{year:2026,month:9,referenceDate:"2026-09-12"});
const cell=matrix.rows[0].cells[0];
assert.equal(cell.total,11000000);
assert.equal(cell.eligible,11000000);
assert.equal(cell.conditions[0].progress,1);
assert.equal(cell.progress,1);
assert.equal(cell.combinationSatisfied,true);
assert.equal(cell.status,"COMPLETED");
assert.equal(cell.remainingTotal,0);
assert.equal(cell.remainingEligible,0);
assert.deepEqual(cell.conditions[0].eligible,11000000);
assert.equal(cell.transactions.some(transaction=>transaction.id==="BUG"),true);

const edgeState={...state,transactions:edgeCaseTransactions};
const edgeMatrix=buildTrackingMatrix(edgeState,{year:2026,month:9,referenceDate:"2026-09-12"});
const edgeCell=edgeMatrix.rows[0].cells[0];
assert.equal(edgeCell.conditions[0].eligible,11000000);
assert.equal(edgeCell.transactions.some(transaction=>transaction.id==="BUG-OFFLINE"),true);
assert.equal(edgeCell.transactions.some(transaction=>transaction.id==="BUG-OTHER-MCC"),true);
assert.equal(edgeCell.transactions.some(transaction=>transaction.id==="BUG-OTHER-CARD"),false);
assert.equal(edgeCell.transactions.some(transaction=>transaction.id==="BUG-OUTSIDE-PERIOD"),false);

console.log("bug-lazada scope tests passed");
