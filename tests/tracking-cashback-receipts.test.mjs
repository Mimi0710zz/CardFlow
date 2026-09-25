import assert from "node:assert/strict";
import {buildTrackingMatrix, summarizeTrackingCashback, TRACKING_COLUMNS} from "../services/tracking-matrix-engine.js";
import {normalizeTrackingCashbackReceipts, trackingCashbackReceiptKey, upsertTrackingCashbackReceipt} from "../services/tracking-cashback-receipts.js";
import {canonicalizeDataWithMigration} from "../services/local-repository.js";
import fs from "node:fs";

assert.deepEqual(TRACKING_COLUMNS,["Ngân hàng","Thẻ","Phôi","Chương trình cashback","Tổng chi","Thời hạn","Tiền CB max","Hình thức hoàn","Ghi chú"]);

const banks=[{id:"B",name:"Bank"}];
const cards=[
  {id:"MONTH",bankId:"B",network:"VISA",cashbackCycle:"monthly"},
  {id:"STMT",bankId:"B",network:"MASTER",cashbackCycle:"statement",statementDay:20}
];
const condition=(id,name,maxType="LIMITED")=>({id,name,rate:.1,max:100000,maxType,allMcc:true});
const programs=[
  {id:"P1",cardId:"MONTH",name:"Trùng tên",year:2026,month:9,conditions:[condition("C1","Một"),condition("C2","Hai")]},
  {id:"P2",cardId:"MONTH",name:"Trùng tên",year:2026,month:9,conditions:[condition("NC","Doanh số","NO_CASHBACK")]},
  {id:"P3",cardId:"STMT",name:"Sao kê",year:2026,month:9,conditions:[condition("C3","Ba")]}
];
const transactions=[
  {id:"T1",cardId:"MONTH",date:"2026-09-10",amount:1000000,status:"Tiêu cá nhân"},
  {id:"T2",cardId:"STMT",date:"2026-09-19",amount:2000000,status:"Tiêu cá nhân"}
];
const receipt={cardId:"MONTH",programId:"P1",periodType:"MONTH",periodKey:"2026-09",received:true,receivedDate:"2026-10-02"};
const model=buildTrackingMatrix({banks,cards,cashbackProgramGroups:programs,transactions,trackingCashbackReceipts:[receipt]},{year:2026,month:9,referenceDate:"2026-09-15"});

assert.equal(model.rows.length,3,"mỗi program chỉ render một lần dù có nhiều condition");
assert.deepEqual(model.rows.map(row=>row.program.id),["P1","P2","P3"]);
assert.equal(model.rows[0].periodType,"MONTH");
assert.equal(model.rows[0].periodKey,"2026-09");
assert.equal(model.rows[2].periodType,"STATEMENT");
assert.equal(model.rows[2].periodKey,"2026-08-21:2026-09-20");
assert.equal(model.rows[0].received,true);
assert.equal(model.rows[0].receivedDate,"2026-10-02");
assert.equal(model.rows[1].noCashback,true);
assert.equal(model.rows[1].maxCashback,0);
assert.equal(model.rows[1].eligibleSpend,1000000);

const summary=summarizeTrackingCashback(model.rows);
assert.equal(summary.total,300000);
assert.equal(summary.received,200000);
assert.deepEqual(summarizeTrackingCashback(model.rows.filter(row=>row.program.id==="P3")),{received:0,total:100000});

assert.notEqual(trackingCashbackReceiptKey({cardId:"MONTH",programId:"P1",periodType:"MONTH",periodKey:"2026-09"}),trackingCashbackReceiptKey({cardId:"MONTH",programId:"P1",periodType:"MONTH",periodKey:"2026-10"}));
assert.notEqual(trackingCashbackReceiptKey({cardId:"MONTH",programId:"P1",periodType:"MONTH",periodKey:"2026-09"}),trackingCashbackReceiptKey({cardId:"MONTH",programId:"P2",periodType:"MONTH",periodKey:"2026-09"}));
let receipts=upsertTrackingCashbackReceipt([],receipt);
receipts=upsertTrackingCashbackReceipt(receipts,{...receipt,received:false,receivedDate:"2026-10-03"});
assert.deepEqual(receipts,[{...receipt,received:false,receivedDate:""}]);
assert.deepEqual(normalizeTrackingCashbackReceipts([{...receipt,receivedDate:"02/10/2026"}]),[receipt]);

const persisted=canonicalizeDataWithMigration({schemaVersion:19,banks,cards,mccCategories:[],cashbackProgramGroups:programs,transactions,trackingCashbackReceipts:[receipt]}).data;
assert.equal(persisted.schemaVersion,20);
assert.deepEqual(persisted.trackingCashbackReceipts,[receipt]);

const trackingUi=fs.readFileSync(new URL("../services/tracking-matrix-ui.js",import.meta.url),"utf8");
assert.match(trackingUi,/type="date"[^>]*data-received-date/);
assert.match(trackingUi,/value="\$\{esc\(row\.receivedDate\|\|''\)\}"/);
assert.match(trackingUi,/receivedDate=received\?toStorageDate\(date\.value\):''/);

const mbPrograms=[
  {id:"DAILY-FOOD",cardId:"MB Pla",name:"Ăn uống",packageId:"DAILY",year:2026,month:9,rate:.05,max:200000,allMcc:true},
  {id:"LIFE-FOOD",cardId:"MB Pla",name:"Ăn uống",packageId:"LIFESTYLE",year:2026,month:9,rate:.05,max:200000,allMcc:true}
];
const mbModel=buildTrackingMatrix({banks,cards:[{id:"MB Pla",bankId:"B",cashbackCycle:"statement",statementDay:20}],cashbackProgramGroups:mbPrograms,cashbackCardConfigs:[{cardId:"MB Pla",statementMinSpend:1000000,rotationAnchorPeriodKey:"statement:2026-08-21:2026-09-20",rotationAnchorPrimaryPackageId:"LIFESTYLE"}],transactions:[{id:"MB-TX",cardId:"MB Pla",date:"2026-09-10",amount:1000000,cashbackPackageId:"DAILY",cashbackProgramId:"DAILY-FOOD"}]},{year:2026,month:9,referenceDate:"2026-09-15"});
assert.deepEqual(mbModel.rows.map(row=>row.program.id),["DAILY-FOOD","LIFE-FOOD"]);
assert.equal(mbModel.rows[0].eligibleSpend,1000000);
assert.equal(mbModel.rows[1].eligibleSpend,0);
assert.equal(mbModel.rows.every(row=>row.periodType==="STATEMENT"),true);

console.log("tracking cashback receipts tests passed");
