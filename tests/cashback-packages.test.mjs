import assert from "node:assert/strict";
import { evaluateCashbackProgram } from "../services/cashback-evaluation.js";
import { activeCashbackPackage, packageSwitchCount, remainingPackageSwitches, switchCashbackPackage } from "../services/cashback-packages.js";
import { carryForwardCashbackPrograms, getCashbackPeriodForCard } from "../services/cashback-period.js";
import { canonicalizeDataWithMigration } from "../services/local-repository.js";

const card={id:"CARD",cashbackCycle:"statement",statementDay:20};
const mccCategories=["5411","5812","5611"].map(code=>({id:`MCC-${code}`,name:code,mcc:code}));
const condition=(id,mcc)=>({id,name:id,rate:.05,max:200000,eligibleSpendMinimum:4000000,allMcc:false,mccCategoryIds:[`MCC-${mcc}`]});
const group=(id,mcc)=>({id,name:id,conditionCombination:"OR",conditions:[condition(`${id}-COND`,mcc)]});
const program={id:"PROGRAM",cardId:"CARD",name:"Selectable",year:2026,month:9,totalSpendMinimum:5000000,maxCashbackPerPeriod:600000,packageSwitchLimit:1,packages:[
  {id:"DAILY",name:"Gói Hằng ngày",groups:[group("SHOP","5411"),group("FOOD-D","5812")]},
  {id:"LIFESTYLE",name:"Gói Phong cách sống",groups:[group("FASHION","5611"),group("FOOD-L","5812")]}
],packageHistory:[
  {id:"H1",packageId:"DAILY",effectiveFrom:"2026-08-21",effectiveTo:"2026-09-17"},
  {id:"H2",packageId:"LIFESTYLE",effectiveFrom:"2026-09-17",effectiveTo:null}
]};
const tx=(id,date,amount,mcc)=>({id,date,cardId:"CARD",amount,mcc,mccCategoryId:`MCC-${mcc}`,category:mcc});

assert.equal(activeCashbackPackage(program,"2026-09-16").id,"DAILY");
assert.equal(activeCashbackPackage(program,"2026-09-17").id,"LIFESTYLE");
const period=getCashbackPeriodForCard(card,"2026-09-18");
assert.equal(period.type,"statement");
assert.equal(packageSwitchCount(program,period),1);
assert.equal(remainingPackageSwitches(program,period),0);
assert.ok(switchCashbackPackage(program,"DAILY","2026-09-18",card).error);

const below=evaluateCashbackProgram(program,[tx("A","2026-09-10",4000000,"5411")],card,{mccCategories,referenceDate:"2026-09-18"});
assert.equal(below.totalCashback,0);
const two=evaluateCashbackProgram(program,[tx("A","2026-09-10",4000000,"5411"),tx("B","2026-09-17",4000000,"5611")],card,{mccCategories,referenceDate:"2026-09-18"});
assert.equal(two.totalCashback,400000);
assert.equal(two.packages.find(item=>item.id==="DAILY").groups[0].totalCashback,200000);
assert.equal(two.packages.find(item=>item.id==="LIFESTYLE").groups[0].totalCashback,200000);
const capped=evaluateCashbackProgram(program,[tx("A","2026-09-10",4000000,"5411"),tx("B","2026-09-10",4000000,"5812"),tx("C","2026-09-17",4000000,"5611"),tx("D","2026-09-17",4000000,"5812")],card,{mccCategories,referenceDate:"2026-09-18"});
assert.equal(capped.uncappedCashback,800000);
assert.equal(capped.totalCashback,600000);

const carried=carryForwardCashbackPrograms([program],2026,10,[card]);
assert.equal(carried.copiedCount,1);
assert.equal(carried.programs.at(-1).packageHistory.length,1);
assert.equal(carried.programs.at(-1).packageHistory[0].packageId,"LIFESTYLE");

const migrated=canonicalizeDataWithMigration({schemaVersion:16,cards:[card],mccCategories,cashbackProgramGroups:[program]});
assert.equal(migrated.data.schemaVersion,17);
assert.equal(migrated.data.cashbackProgramGroups[0].packages.length,2);
assert.equal(migrated.data.cashbackProgramGroups[0].packages[0].groups.length,2);

console.log("cashback package tests passed");
