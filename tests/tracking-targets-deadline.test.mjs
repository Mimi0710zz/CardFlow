import assert from "node:assert/strict";
import {buildTrackingMatrix,trackingDeadline} from "../services/tracking-matrix-engine.js";
import {trackingProgressLines} from "../services/tracking-matrix-ui.js";

const program=combineOperator=>({
  id:"VP-STEPUP-ONLINE",name:"Online: 15% max 1m5",cardId:"VP StepUp",year:2026,month:9,combineOperator,
  conditions:[{id:"ONLINE",allMcc:true,channel:"Online",rate:0.15,max:1500000}],
  totalSpendCondition:{enabled:true,amount:100000000}
});
const state=(transactions,combineOperator="AND",card={cashbackCycle:"monthly"})=>({
  banks:[{id:"VP",name:"VPBank"}],cards:[{id:"VP StepUp",bankId:"VP",...card}],mccCategories:[],
  cashbackPrograms:[program(combineOperator)],transactions
});
const tx=(id,amount,channel="Online")=>({id,cardId:"VP StepUp",date:"2026-09-10",amount,channel,mcc:"5411"});
const metric=(transactions,combineOperator="AND",card)=>buildTrackingMatrix(state(transactions,combineOperator,card),{year:2026,month:9,referenceDate:"2026-09-14",today:"2026-09-14"}).rows[0].metric;

const complete=metric([tx("ONLINE",10000000),tx("OFFLINE",101820000,"Offline")]);
assert.equal(complete.total,111820000);
assert.equal(complete.totalTarget,100000000);
assert.equal(complete.eligible,10000000);
assert.equal(complete.eligibleTarget,10000000);
assert.deepEqual(trackingProgressLines(complete),["Tổng: 111.82tr / 100tr","Nhóm: 10tr / 10tr"]);
assert.equal(complete.status,"COMPLETED");

const missingTotal=metric([tx("ONLINE",10000000),tx("OFFLINE",80000000,"Offline")]);
assert.equal(missingTotal.status,"IN_PROGRESS");
assert.equal(missingTotal.combinationSatisfied,false);

const missingEligible=metric([tx("ONLINE",7000000),tx("OFFLINE",103000000,"Offline")]);
assert.equal(missingEligible.status,"IN_PROGRESS");
assert.equal(missingEligible.combinationSatisfied,false);

const explicitOr=metric([tx("ONLINE",10000000),tx("OFFLINE",80000000,"Offline")],"OR");
assert.equal(explicitOr.status,"COMPLETED");
assert.equal(explicitOr.combinationSatisfied,true);

const statementMetric=metric([tx("ONLINE",1000000)],"AND",{cashbackCycle:"statement",statementDay:20});
assert.deepEqual(statementMetric.cashbackPeriod,{type:"statement",startDate:"2026-08-21",endDate:"2026-09-20"});
assert.equal(statementMetric.deadline.date,"2026-09-20");
assert.equal(statementMetric.deadline.daysRemaining,6);
assert.equal(statementMetric.deadline.tone,"warning");

assert.deepEqual(trackingDeadline({endDate:"2026-09-30"},"2026-09-14",false),{date:"2026-09-30",daysRemaining:16,text:"Còn 16 ngày",tone:"normal"});
assert.deepEqual(trackingDeadline({endDate:"2026-12-31"},"2027-01-02",false),{date:"2026-12-31",daysRemaining:-2,text:"Quá hạn 2 ngày",tone:"overdue"});
assert.equal(trackingDeadline({endDate:"2026-09-20"},"2026-09-19",true).tone,"paid");

console.log("tracking targets and deadline tests passed");
