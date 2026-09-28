import assert from "node:assert/strict";
import { calculateDashboardHostBackMetrics, isDashboardWaitingHostBackTransaction } from "../services/dashboard-host-back.js";
import { CARD_FEE_ORDER_TYPE } from "../services/order-type.js";
import { TRANSACTION_STATUS } from "../services/transaction-status.js";

const rows=[
  {id:"SENT-NO-BACK",orderType:"POS",status:TRANSACTION_STATUS.SENT_BILL,amount:1000,backAmount:0},
  {id:"SENT-WITH-BACK",orderType:"POS",status:TRANSACTION_STATUS.SENT_BILL,amount:2000,backAmount:2000},
  {id:"HOST-BACKED",orderType:"POS",status:TRANSACTION_STATUS.HOST_BACK,amount:3000,backAmount:3000},
  {id:"PERSONAL",orderType:"POS",status:TRANSACTION_STATUS.PERSONAL_USE,amount:4000,backAmount:0},
  {id:"CARD-FEE-EMPTY",orderType:CARD_FEE_ORDER_TYPE,status:"",amount:5000,backAmount:0},
  {id:"NORMAL-EMPTY",orderType:"POS",status:"",amount:6000,backAmount:0},
  {id:"NORMAL-LEGACY",orderType:"POS",status:"paid_bill_sent",amount:7000,backAmount:0}
];

assert.deepEqual(rows.filter(isDashboardWaitingHostBackTransaction).map(row=>row.id),[
  "SENT-NO-BACK",
  "NORMAL-LEGACY"
]);

const metrics=calculateDashboardHostBackMetrics(rows);
assert.equal(metrics.waitingCount,2);
assert.equal(metrics.waiting,8000);
assert.equal(metrics.hostBack,5000);
assert.deepEqual(metrics.waitingRows.map(row=>row.id),["SENT-NO-BACK","NORMAL-LEGACY"]);
assert.equal(metrics.hostBackRows.some(row=>row.id==="CARD-FEE-EMPTY"),false);
assert.equal(metrics.hostBackRows.some(row=>row.id==="PERSONAL"),false);
assert.equal(metrics.waitingRows.some(row=>row.id==="SENT-WITH-BACK"),false);
assert.equal(metrics.waitingRows.some(row=>row.id==="HOST-BACKED"),false);
assert.equal(metrics.waitingRows.some(row=>row.id==="NORMAL-EMPTY"),false);

console.log("dashboard-host-back tests passed");
