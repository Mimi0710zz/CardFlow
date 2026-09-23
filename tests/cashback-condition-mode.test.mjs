import assert from "node:assert/strict";
import {evaluateCashbackProgram,evaluateCashbackPrograms} from "../services/cashback-evaluation.js";
import {initializePeriodPackage} from "../services/cashback-packages.js";
import {getCashbackPeriodForCard} from "../services/cashback-period.js";

const card={id:"CARD",cashbackCycle:"monthly"};
const mccCategories=[{id:"FOOD",name:"Food",mcc:"5812"},{id:"SHOP",name:"Shop",mcc:"5411"}];
const tx=(id,amount,mccCategoryId="FOOD")=>({id,cardId:"CARD",date:"2026-09-10",amount,mccCategoryId,mcc:mccCategories.find(item=>item.id===mccCategoryId)?.mcc,status:"Tiêu cá nhân",channel:"Online"});
const condition=(id,options={})=>({id,name:id,rate:.05,max:1000000,maxCashbackUnlimited:false,allMcc:true,eligibleSpendMinimum:null,...options});
const base={id:"PROGRAM",cardId:"CARD",name:"Program",year:2026,month:9,conditions:[condition("FIRST"),condition("SECOND")]};

const independent=evaluateCashbackProgram({...base,conditionMode:"independent"},[tx("T",1000000)],card,{mccCategories,referenceDate:"2026-09-15"});
assert.deepEqual(independent.conditions.map(item=>item.eligibleSpend),[1000000,1000000]);
assert.equal(independent.totalCashback,100000);
const normalRegression=evaluateCashbackPrograms([{...base,conditionMode:"independent"}],[tx("T",1000000)],[card],{mccCategories,referenceDate:"2026-09-15",cashbackCardConfigs:[{cardId:"MB Pla",statementMinSpend:5000000}]});
assert.equal(normalRegression.length,1);
assert.equal(normalRegression[0].totalCashback,100000);

const firstMatch=evaluateCashbackProgram({...base,conditionMode:"first_match"},[tx("T",1000000)],card,{mccCategories,referenceDate:"2026-09-15"});
assert.deepEqual(firstMatch.conditions.map(item=>item.eligibleSpend),[1000000,0]);
assert.equal(firstMatch.totalCashback,50000);

const reversed=evaluateCashbackProgram({...base,conditionMode:"first_match",conditions:[condition("SECOND"),condition("FIRST")]},[tx("T",1000000)],card,{mccCategories,referenceDate:"2026-09-15"});
assert.deepEqual(reversed.conditions.map(item=>[item.id,item.eligibleSpend]),[["SECOND",1000000],["FIRST",0]]);

const supporting={...base,conditionMode:"supporting",conditions:[
  condition("FOOD",{allMcc:false,mccCategoryIds:["FOOD"],eligibleSpendMinimum:5000000}),
  condition("SHOP",{allMcc:false,mccCategoryIds:["SHOP"],eligibleSpendMinimum:10000000})
]};
const supportingResult=evaluateCashbackProgram(supporting,[tx("F",3000000,"FOOD"),tx("S",4000000,"SHOP")],card,{mccCategories,referenceDate:"2026-09-15"});
assert.equal(supportingResult.conditionMode,"supporting");
assert.equal(supportingResult.pooledSpend,7000000);
assert.deepEqual(supportingResult.conditions.map(item=>[item.id,item.eligibleSpend,item.eligibleSatisfied,item.finalCashback]),[
  ["FOOD",3000000,true,150000],
  ["SHOP",4000000,false,0]
]);
assert.equal(supportingResult.conditions[0].progress,1);
assert.equal(supportingResult.conditions[1].remainingEligible,3000000);
const deduplicatedPool=evaluateCashbackProgram({...base,conditionMode:"supporting",conditions:[condition("A",{eligibleSpendMinimum:1500000}),condition("B",{eligibleSpendMinimum:1500000})]},[tx("ONE",1000000)],card,{mccCategories,referenceDate:"2026-09-15"});
assert.equal(deduplicatedPool.pooledSpend,1000000);
assert.equal(deduplicatedPool.totalCashback,0);

const required={...base,conditionMode:"all_required",conditions:[
  condition("FOOD",{allMcc:false,mccCategoryIds:["FOOD"],eligibleSpendMinimum:1000000}),
  condition("SHOP",{allMcc:false,mccCategoryIds:["SHOP"],eligibleSpendMinimum:1000000})
]};
assert.equal(evaluateCashbackProgram(required,[tx("F",1000000,"FOOD")],card,{mccCategories,referenceDate:"2026-09-15"}).totalCashback,0);
assert.equal(evaluateCashbackProgram(required,[tx("F",1000000,"FOOD"),tx("S",1000000,"SHOP")],card,{mccCategories,referenceDate:"2026-09-15"}).totalCashback,100000);

for(const conditionMode of ["independent","first_match","supporting","all_required"]){
  const below=evaluateCashbackProgram({...base,conditionMode,totalSpendMinimum:3000000},[tx("T",2000000)],card,{mccCategories,referenceDate:"2026-09-15"});
  assert.equal(below.totalCashback,0,`${conditionMode} must respect program total spend`);
}
const capped=evaluateCashbackProgram({...base,conditionMode:"independent",maxCashbackPerPeriod:60000},[tx("T",1000000)],card,{mccCategories,referenceDate:"2026-09-15"});
assert.equal(capped.totalCashback,100000);

const packageProgram={id:"PACKAGED",cardId:"CARD",name:"Packaged",year:2026,month:9,conditionMode:"first_match",packages:[{
  id:"PACKAGE",name:"Package",groups:[
    {id:"G1",name:"One",conditions:[condition("P-FIRST")]},
    {id:"G2",name:"Two",conditions:[condition("P-SECOND")]}
  ]
}],packageHistory:[]};
const initialized=initializePeriodPackage(packageProgram,"PACKAGE",getCashbackPeriodForCard(card,"2026-09-15")).program;
const packagedResult=evaluateCashbackProgram(initialized,[tx("T",1000000)],card,{mccCategories,referenceDate:"2026-09-15"});
assert.deepEqual(packagedResult.conditions.map(item=>item.eligibleSpend),[1000000,0]);
assert.equal(packagedResult.totalCashback,50000);

console.log("cashback condition-mode tests passed");
