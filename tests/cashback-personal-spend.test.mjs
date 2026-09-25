import assert from "node:assert/strict";
import { cashbackTransactionsForCardPeriod } from "../services/cashback-transactions.js";
import { buildTrackingMatrix, TRACKING_COLUMNS } from "../services/tracking-matrix-engine.js";
import { calculateDashboardHostBackMetrics } from "../services/dashboard-host-back.js";
import { financialTransactions } from "../services/financial-totals.js";
import { TRANSACTION_STATUS } from "../services/transaction-status.js";

const period={type:"monthly",startDate:"2026-09-01",endDate:"2026-09-30"};
const transactions=[
  {id:"SENT",cardId:"TECH Every",date:"2026-09-02",status:TRANSACTION_STATUS.SENT_BILL,host:"HOST",amount:3000000,mcc:"5411",mccCategoryId:"MCC-5411",channel:"Online",backAmount:0},
  {id:"BACK",cardId:"TECH Every",date:"2026-09-03",status:TRANSACTION_STATUS.HOST_BACK,host:"HOST",amount:2000000,mcc:"5411",mccCategoryId:"MCC-5411",channel:"Online",backAmount:1900000},
  {id:"PERSONAL",cardId:"TECH Every",date:"2026-09-04",status:TRANSACTION_STATUS.PERSONAL_USE,host:"",amount:6000000,mcc:"5411",mccCategoryId:"MCC-5411",channel:"Online",backAmount:0}
];

const scoped=cashbackTransactionsForCardPeriod(transactions,"TECH Every",period);
assert.deepEqual(scoped.map(transaction=>transaction.id),["SENT","BACK","PERSONAL"]);
assert.equal(scoped.reduce((total,transaction)=>total+transaction.amount,0),11000000);

const baseState={
  hosts:[{id:"HOST",name:"Host"},{id:"OTHER",name:"Host khác"}],
  banks:[{id:"BANK",name:"Techcombank"}],
  cards:[{id:"TECH Every",bankId:"BANK",cashbackCycle:"monthly"}],
  mccCategories:[{id:"MCC-5411",name:"Siêu thị",mcc:"5411"},{id:"MCC-5812",name:"Nhà hàng",mcc:"5812"}],
  cashbackPrograms:[{
    id:"TECH-EVERY",
    name:"TECH Every",
    cardId:"TECH Every",
    year:2026,
    month:9,
    combineOperator:"AND",
    conditions:[{id:"TECH-ONLINE",mccCategoryIds:["MCC-5411"],channel:"Online",rate:0.1,max:1000000}],
    totalSpendCondition:{enabled:true,amount:10000000}
  }],
  transactions
};

const trackingRow=buildTrackingMatrix(baseState,{year:2026,month:9,referenceDate:"2026-09-14"}).rows[0];
const cell=trackingRow.metric;
assert.equal(cell.total,11000000);
assert.equal(cell.eligible,11000000);
assert.equal(cell.remainingTotal,0);
assert.equal(cell.progress,1);
assert.equal(cell.status,"COMPLETED");
assert.equal(cell.transactions.some(transaction=>transaction.id==="PERSONAL"),true);
assert.deepEqual(TRACKING_COLUMNS,["Ngân hàng","Thẻ","Phôi","Chương trình cashback","Tổng chi","Thời hạn","Tiền CB max","Hình thức hoàn","Ghi chú"]);
assert.equal("hosts" in buildTrackingMatrix(baseState,{year:2026,month:9,referenceDate:"2026-09-14"}),false);
assert.equal("cells" in trackingRow,false);

const wrongMcc={id:"PERSONAL-WRONG-MCC",cardId:"TECH Every",date:"2026-09-05",status:TRANSACTION_STATUS.PERSONAL_USE,host:"HOST",amount:2000000,mcc:"5812",mccCategoryId:"MCC-5812",channel:"Online",backAmount:0};
const wrongMccCell=buildTrackingMatrix({...baseState,transactions:[...transactions,wrongMcc]},{year:2026,month:9,referenceDate:"2026-09-14"}).rows[0].metric;
assert.equal(wrongMccCell.total,13000000);
assert.equal(wrongMccCell.eligible,11000000);

const legacyNoChannel={...transactions[2],id:"PERSONAL-LEGACY",amount:1000000,channel:""};
const legacyChannelCell=buildTrackingMatrix({...baseState,transactions:[...transactions,legacyNoChannel]},{year:2026,month:9,referenceDate:"2026-09-14"}).rows[0].metric;
assert.equal(legacyChannelCell.eligible,12000000);
const explicitWrongChannel={...transactions[2],id:"PERSONAL-OFFLINE",amount:1000000,channel:"Offline"};
const wrongChannelCell=buildTrackingMatrix({...baseState,transactions:[...transactions,explicitWrongChannel]},{year:2026,month:9,referenceDate:"2026-09-14"}).rows[0].metric;
assert.equal(wrongChannelCell.total,12000000);
assert.equal(wrongChannelCell.eligible,11000000);

const bugLazada={id:"BUG",cardId:"TECH Every",date:"2026-09-06",status:TRANSACTION_STATUS.PERSONAL_USE,host:"HOST",orderType:"BUG-LAZADA",amount:1000000,mcc:"5411",mccCategoryId:"MCC-5411",channel:"Offline",backAmount:900000};
const bugCell=buildTrackingMatrix({...baseState,transactions:[...transactions,bugLazada]},{year:2026,month:9,referenceDate:"2026-09-14"}).rows[0].metric;
assert.equal(bugCell.total,12000000);
assert.equal(bugCell.eligible,12000000);
assert.equal(financialTransactions([...transactions,bugLazada]).some(transaction=>transaction.id==="BUG"),false);

const hostMetrics=calculateDashboardHostBackMetrics(financialTransactions([...transactions,bugLazada]));
assert.equal(hostMetrics.hostBackRows.some(transaction=>transaction.id==="PERSONAL"),false);
assert.equal(hostMetrics.hostBack,1900000);

console.log("cashback personal-spend tests passed");
