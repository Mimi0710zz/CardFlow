import assert from "node:assert/strict";
import {evaluateMbPlatinumCashback,isMbPlatinumProgramTransactionEligible} from "../services/mb-platinum-cashback.js";

const card={id:"MB Pla",cashbackCycle:"statement",statementDay:20};
const config={cardId:"MB Pla",statementMinSpend:1000000,rotationAnchorPeriodKey:"statement:2026-08-21:2026-09-20",rotationAnchorPrimaryPackageId:"LIFESTYLE"};
const program={id:"L-ONLINE",cardId:"MB Pla",name:"Mua sắm Online",packageId:"LIFESTYLE",year:2026,month:9,conditions:[{id:"C1",name:"Online",allMcc:true,channel:"Online",rate:.05,max:200000,maxType:"LIMITED",eligibleSpendMinimum:null}]};
const transaction={id:"T1",cardId:"MB Pla",date:"2026-09-01",transactionTime:"10:00:00",amount:4000000,channel:"online",cashbackPackageId:"LIFESTYLE",cashbackProgramId:"L-ONLINE"};
assert.equal(isMbPlatinumProgramTransactionEligible(program,transaction,[]),true);
const result=evaluateMbPlatinumCashback({config,card,programs:[program],transactions:[transaction],mccCategories:[],referenceDate:"2026-09-12"});
assert.equal(result.totalCashback,200000);
assert.equal(result.programResults[0].eligibleSpend,4000000);
console.log("MB Platinum normalized condition tests passed");
