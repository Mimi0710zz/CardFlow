import assert from "node:assert/strict";
import {evaluateMbPlatinumCashback} from "../services/mb-platinum-cashback.js";
import {evaluateCashbackPrograms} from "../services/cashback-evaluation.js";

const card={id:"MB Pla",cashbackCycle:"statement",statementDay:20};
const config={cardId:"MB Pla",statementMinSpend:5000000,rotationAnchorPeriodKey:"statement:2026-08-21:2026-09-20",rotationAnchorPrimaryPackageId:"LIFESTYLE"};
const program=(id,name,packageId)=>({id,cardId:"MB Pla",name,packageId,year:2026,month:9,allMcc:true,channel:"Online",rate:.1,max:200000});
const programs=[program("LIFE-FOOD","Ăn uống","LIFESTYLE"),program("LIFE-ONLINE","Mua sắm Online","LIFESTYLE"),program("LIFE-FASHION","Thời trang","LIFESTYLE"),program("DAILY-FOOD","Ăn uống","DAILY")];
const tx=(id,programId,packageId,amount)=>({id,cardId:"MB Pla",date:"2026-09-01",transactionTime:`10:00:0${id}`,amount,channel:"online",cashbackProgramId:programId,cashbackPackageId:packageId});
const qualified=[tx("1","LIFE-FOOD","LIFESTYLE",2000000),tx("2","LIFE-ONLINE","LIFESTYLE",2000000),tx("3","DAILY-FOOD","DAILY",2000000)];

const belowMinimum=evaluateMbPlatinumCashback({config:{...config,statementMinSpend:7000000},card,programs,transactions:qualified,referenceDate:"2026-09-12"});
assert.equal(belowMinimum.totalCashback,0);
assert.equal(belowMinimum.statementMinimumSatisfied,false);
assert.equal(belowMinimum.eligibleSpend,6000000);

const atMinimum=evaluateMbPlatinumCashback({config,card,programs,transactions:[...qualified,tx("4","LIFE-FOOD","LIFESTYLE",1000000)],referenceDate:"2026-09-12"});
assert.equal(atMinimum.totalCashback,600000);
assert.equal(atMinimum.statementMinimumSatisfied,true);
assert.equal(atMinimum.programResults.length,3);
assert.deepEqual(atMinimum.usage.occupiedProgramIds.sort(),["DAILY-FOOD","LIFE-FOOD","LIFE-ONLINE"].sort());
assert.equal(atMinimum.programResults.find(item=>item.program.id==="LIFE-FOOD").eligibleSpend,3000000);

const ignored=evaluateMbPlatinumCashback({config,card,programs,transactions:[...qualified,tx("4","LIFE-FASHION","LIFESTYLE",9000000),{id:"5",cardId:"MB Pla",date:"2026-09-01",amount:9000000,channel:"online"}],referenceDate:"2026-09-12"});
assert.equal(ignored.programResults.length,3);
assert.equal(ignored.programResults.some(item=>item.program.id==="LIFE-FASHION"),false);
assert.equal(ignored.eligibleSpend,6000000);

const engine=evaluateCashbackPrograms(programs,qualified,[card],{mccCategories:[],referenceDate:"2026-09-12",cashbackCardConfigs:[config]});
assert.equal(engine.length,1);
assert.equal(engine[0].totalCashback,600000);
assert.equal(engine[0].mbPlatinum,true);
console.log("MB Platinum cashback evaluation tests passed");
