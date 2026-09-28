import assert from "node:assert/strict";
import {evaluateCashbackPrograms} from "../services/cashback-evaluation.js";
import {buildTrackingMatrix,summarizeTrackingCashback} from "../services/tracking-matrix-engine.js";
import {renderTrackingMatrixGrid,trackingCashbackCell} from "../services/tracking-matrix-ui.js";

const card={id:"CARD",bankId:"BANK",cashbackCycle:"monthly"};
const config={cardId:"CARD",calculationMode:"first_match",totalSpendRequirement:{enabled:false,amount:null}};
const condition=(id,mccCategoryId,target,max)=>({id,name:id,rate:.1,max,maxType:"LIMITED",allMcc:false,mccCategoryIds:[mccCategoryId],eligibleSpendMinimum:target});
const program=(id,name,mccCategoryId,target,max,month=9)=>({id,cardId:"CARD",name,year:2026,month,conditions:[condition(`${id}-RULE`,mccCategoryId,target,max)]});
const programs=[program("A","Program A","A",5000000,500000),program("B","Program B","B",4000000,400000),program("C","Program C","C",3000000,300000)];
const tx=(id,date,amount,mccCategoryId,transactionTime="10:00:00")=>({id,cardId:"CARD",date,transactionTime,amount,mccCategoryId,status:"Tiêu cá nhân"});
const mccCategories=["A","B","C"].map(id=>({id,name:id,mcc:id}));
const context={mccCategories,referenceDate:"2026-09-15",cardCashbackConfigs:[config]};

const none=evaluateCashbackPrograms(programs,[tx("A1","2026-09-01",1000000,"A")],[card],context);
assert.deepEqual(none.map(result=>result.priorityStatus),["ACTIVE","ACTIVE","ACTIVE"]);
assert.equal(none.every(result=>result.competitionLocked===false),true);

const winnerTransactions=[
  tx("B1","2026-09-01",2000000,"B"),
  tx("A1","2026-09-02",5000000,"A"),
  tx("B2","2026-09-03",2000000,"B"),
  tx("C1","2026-09-04",3000000,"C")
];
const qualified=evaluateCashbackPrograms(programs,winnerTransactions,[card],context);
assert.deepEqual(qualified.map(result=>result.priorityStatus),["QUALIFIED","LOCKED_BY_PRIORITY","LOCKED_BY_PRIORITY"]);
assert.equal(qualified[0].competitionWinner,true);
assert.equal(qualified[1].competitionWinnerId,"A");
assert.equal(qualified[2].competitionWinnerId,"A");
assert.equal(qualified[1].totalCashback,0);
assert.equal(qualified[2].totalCashback,0);

const trackingState={
  banks:[{id:"BANK",name:"Bank"}],cards:[card],cashbackProgramGroups:programs,
  cashbackCardConfigs:[config],mccCategories,transactions:winnerTransactions,
  trackingCashbackReceipts:[
    {cardId:"CARD",programId:"A",periodType:"MONTH",periodKey:"2026-09",received:true,receivedDate:"2026-10-01"},
    {cardId:"CARD",programId:"B",periodType:"MONTH",periodKey:"2026-09",received:true,receivedDate:"2026-10-01"}
  ]
};
const tracking=buildTrackingMatrix(trackingState,{year:2026,month:9,referenceDate:"2026-09-15"});
assert.deepEqual(tracking.rows.map(row=>row.priorityStatus),["QUALIFIED","LOCKED_BY_PRIORITY","LOCKED_BY_PRIORITY"]);
assert.equal(tracking.rows[1].receiptEnabled,false);
assert.equal(tracking.rows[1].received,false,"locked receipt must not count even when a stale receipt exists");
assert.deepEqual(summarizeTrackingCashback(tracking.rows),{received:500000,total:500000});
const lockedCashbackCell=trackingCashbackCell(tracking.rows[1],1);
assert.match(lockedCashbackCell,/disabled/);
assert.match(lockedCashbackCell,/Đã có chương trình khác đạt điều kiện trước/);
assert.doesNotMatch(lockedCashbackCell,/data-cashback-row/);

const trackingHtml=renderTrackingMatrixGrid(tracking.rows);
const lockedDesktopRows=[...trackingHtml.matchAll(/<tr class="tracking-program-locked"[^>]*>[\s\S]*?<\/tr>/g)].map(match=>match[0]);
const lockedStackedCards=[...trackingHtml.matchAll(/<details class="panel tracking-program-locked"[^>]*>[\s\S]*?<\/details>/g)].map(match=>match[0]);
assert.equal(lockedDesktopRows.length,2,"desktop must lock both losing program rows");
assert.equal(lockedStackedCards.length,2,"stacked view must lock both losing program cards");
for(const lockedUi of [...lockedDesktopRows,...lockedStackedCards]){
  assert.match(lockedUi,/Đã khóa/);
  assert.match(lockedUi,/Đã có Program A đạt điều kiện trước/);
  assert.doesNotMatch(lockedUi,/data-matrix-row=/,"locked spend progress must not remain actionable");
  assert.doesNotMatch(lockedUi,/data-cashback-row=/,"locked cashback receipt must not remain actionable");
  assert.match(lockedUi,/matrix-cell[^>]*disabled/);
  assert.match(lockedUi,/matrix-cashback-amount[^>]*disabled/);
}
const winnerDesktopRow=trackingHtml.match(/<tr(?: class="")?[^>]*>[\s\S]*?Program A[\s\S]*?<\/tr>/)?.[0]||"";
assert.doesNotMatch(winnerDesktopRow,/tracking-program-locked/);
assert.match(winnerDesktopRow,/data-matrix-row=/,"winner spend progress remains actionable");
assert.match(winnerDesktopRow,/data-cashback-row=/,"winner receipt remains actionable");
assert.match(trackingHtml,/500\.000đ \/ 500\.000đ/);

const activeTracking=buildTrackingMatrix({...trackingState,transactions:[tx("A0","2026-09-01",1000000,"A")],trackingCashbackReceipts:[]},{year:2026,month:9,referenceDate:"2026-09-15"});
assert.doesNotMatch(renderTrackingMatrixGrid(activeTracking.rows),/tracking-program-locked/,"no winner keeps every row active");

const otherCard={id:"OTHER",bankId:"BANK",cashbackCycle:"monthly"};
const otherProgram={...program("OTHER-A","Other Program","A",1000000,100000),cardId:"OTHER"};
const otherCardTracking=buildTrackingMatrix({...trackingState,cards:[card,otherCard],cashbackProgramGroups:[...programs,otherProgram],transactions:[...winnerTransactions,{...tx("OTHER-1","2026-09-05",1000000,"A"),cardId:"OTHER"}]},{year:2026,month:9,referenceDate:"2026-09-15"});
assert.equal(otherCardTracking.rows.find(row=>row.card.id==="OTHER").competitionLocked,false,"another card is unaffected");

const reevaluated=evaluateCashbackPrograms(programs,winnerTransactions.filter(item=>item.id!=="A1"),[card],context);
assert.deepEqual(reevaluated.map(result=>result.priorityStatus),["LOCKED_BY_PRIORITY","QUALIFIED","LOCKED_BY_PRIORITY"]);
assert.equal(reevaluated[1].competitionWinnerId,"B");

for(const calculationMode of ["independent","supporting","all_required"]){
  const results=evaluateCashbackPrograms(programs,winnerTransactions,[card],{...context,cardCashbackConfigs:[{...config,calculationMode}]});
  assert.equal(results.some(result=>result.competitionLocked),false,`${calculationMode} must remain unchanged`);
}

const octoberPrograms=programs.map(item=>({...item,month:10}));
const october=evaluateCashbackPrograms(octoberPrograms,[tx("O-B","2026-10-02",4000000,"B")],[card],{...context,referenceDate:"2026-10-15"});
assert.deepEqual(october.map(result=>result.priorityStatus),["LOCKED_BY_PRIORITY","QUALIFIED","LOCKED_BY_PRIORITY"]);

console.log("cashback priority-mode tests passed");
