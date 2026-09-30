import assert from "node:assert/strict";
import {buildTrackingMatrix,trackingOrderPreset} from "../services/tracking-matrix-engine.js";

const state={
  banks:[{id:"B",name:"MB"}],
  cards:[{id:"MB Pla",bankId:"B",cashbackCycle:"statement",statementDay:20}],
  mccCategories:[],
  cashbackCardConfigs:[{cardId:"MB Pla",statementMinSpend:5000000,rotationAnchorPeriodKey:"statement:2026-08-21:2026-09-20",rotationAnchorPrimaryPackageId:"LIFESTYLE"}],
  cashbackProgramGroups:[
    {id:"L-A",cardId:"MB Pla",name:"A",packageId:"LIFESTYLE",year:2026,month:9,rate:.05,max:200000,allMcc:true},
    {id:"L-B",cardId:"MB Pla",name:"B",packageId:"LIFESTYLE",year:2026,month:9,rate:.05,max:200000,allMcc:true},
    {id:"L-C",cardId:"MB Pla",name:"C",packageId:"LIFESTYLE",year:2026,month:9,rate:.05,max:200000,allMcc:true},
    {id:"D-A",cardId:"MB Pla",name:"D",packageId:"DAILY",year:2026,month:9,rate:.05,max:200000,allMcc:true}
  ],
  transactions:[
    {id:"T1",cardId:"MB Pla",date:"2026-09-01",transactionTime:"09:00:00",amount:1000000,channel:"online",cashbackPackageId:"LIFESTYLE",cashbackProgramId:"L-A"},
    {id:"T2",cardId:"MB Pla",date:"2026-09-02",transactionTime:"09:00:00",amount:1000000,channel:"online",cashbackPackageId:"LIFESTYLE",cashbackProgramId:"L-B"}
  ],
  trackingCashbackReceipts:[]
};

const model=buildTrackingMatrix(state,{year:2026,month:9,referenceDate:"2026-09-12",today:"2026-09-12"});
const blocked=model.rows.find(row=>row.program.id==="L-C");
const daily=model.rows.find(row=>row.program.id==="D-A");
assert.equal(blocked.competitionLocked,true);
assert.match(blocked.lockReason,/Phong cách sống/);
assert.match(blocked.lockReason,/2\/2/);
assert.equal(daily.competitionLocked,false);
assert.deepEqual(trackingOrderPreset(daily.metric),{cardId:"MB Pla",mccCategoryId:"",cashbackPackageId:"DAILY",cashbackProgramId:"D-A"});
console.log("MB Platinum tracking special tests passed");
