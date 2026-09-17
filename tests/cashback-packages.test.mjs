import assert from "node:assert/strict";
import { evaluateCashbackProgram } from "../services/cashback-evaluation.js";
import * as packageRuntime from "../services/cashback-packages.js";
import { carryForwardCashbackPrograms, getCashbackPeriodForCard } from "../services/cashback-period.js";
import { canonicalizeData, canonicalizeDataWithMigration } from "../services/local-repository.js";

const {cashbackPackagePeriodKey,initializePeriodPackage,getActiveCashbackPackage,getPackageHistoryForPeriod,getPackageSwitchCount,getRemainingPackageSwitches,resolvePackageForTransaction,switchCashbackPackage}=packageRuntime;
assert.equal(typeof initializePeriodPackage,"function","initial package runtime API must exist");

const card={id:"CARD",cashbackCycle:"statement",statementDay:20};
const mccCategories=["5411","5812","5611"].map(code=>({id:`MCC-${code}`,name:code,mcc:code}));
const condition=(id,mcc)=>({id,name:id,rate:.05,max:200000,eligibleSpendMinimum:4000000,allMcc:false,mccCategoryIds:[`MCC-${mcc}`]});
const group=(id,mcc)=>({id,name:id,conditionCombination:"OR",conditions:[condition(`${id}-COND`,mcc)]});
const program={id:"PROGRAM",cardId:"CARD",name:"Selectable",year:2026,month:9,totalSpendMinimum:5000000,maxCashbackPerPeriod:600000,packageSwitchLimit:1,packages:[
  {id:"DAILY",name:"Gói Hằng ngày",groups:[group("SHOP","5411"),group("FOOD-D","5812")]},
  {id:"LIFESTYLE",name:"Gói Phong cách sống",groups:[group("FASHION","5611"),group("FOOD-L","5812")]}
],packageHistory:[]};
const tx=(id,date,amount,mcc,transactionTime="00:00:00")=>({id,date,transactionTime,cardId:"CARD",amount,mcc,mccCategoryId:`MCC-${mcc}`,category:mcc});

const period=getCashbackPeriodForCard(card,"2026-09-18");
assert.equal(period.type,"statement");
assert.equal(cashbackPackagePeriodKey(period),"statement:2026-08-21:2026-09-20");
assert.equal(getActiveCashbackPackage(program,period,"2026-09-10T12:00:00"),null);

const monthlyCard={id:"MONTHLY",cashbackCycle:"monthly"};
const monthlyPeriod=getCashbackPeriodForCard(monthlyCard,"2026-09-18");
const monthlyProgram={...program,cardId:"MONTHLY",packageHistory:[]};
const initializedMonthly=initializePeriodPackage(monthlyProgram,"DAILY",monthlyPeriod).program;
assert.equal(cashbackPackagePeriodKey(monthlyPeriod),"monthly:2026-09-01:2026-09-30");
assert.equal(resolvePackageForTransaction(initializedMonthly,{...tx("MONTHLY-TX","2026-09-18",1,"5411","08:15:00"),cardId:"MONTHLY"},monthlyCard).id,"DAILY");

const initialized=initializePeriodPackage(program,"LIFESTYLE",period);
assert.equal(initialized.error,undefined);
assert.equal(initialized.program.packageHistory.length,1);
assert.equal(initialized.program.packageHistory[0].periodKey,cashbackPackagePeriodKey(period));
assert.equal(initialized.program.packageHistory[0].effectiveFrom,"2026-08-21T00:00:00");
assert.equal(getPackageSwitchCount(initialized.program,period),0);
assert.equal(getRemainingPackageSwitches(initialized.program,period),1);

const switched=switchCashbackPackage(initialized.program,"DAILY","2026-09-15T10:30:00",card);
assert.equal(switched.error,undefined);
assert.equal(switched.program.packageHistory[0].effectiveTo,"2026-09-15T10:30:00");
assert.equal(switched.program.packageHistory[1].effectiveFrom,"2026-09-15T10:30:00");
assert.equal(getPackageSwitchCount(switched.program,period),1);
assert.equal(getRemainingPackageSwitches(switched.program,period),0);
assert.match(switchCashbackPackage(switched.program,"LIFESTYLE","2026-09-16T09:00:00",card).error,/hết số lần đổi gói/i);
assert.equal(resolvePackageForTransaction(switched.program,tx("BEFORE","2026-09-15",1,"5611","10:29:59"),card).id,"LIFESTYLE");
assert.equal(resolvePackageForTransaction(switched.program,tx("AFTER","2026-09-15",1,"5411","10:30:00"),card).id,"DAILY");
assert.deepEqual(getPackageHistoryForPeriod(switched.program,period).map(item=>item.id),switched.program.packageHistory.map(item=>item.id));

const below=evaluateCashbackProgram(initialized.program,[tx("A","2026-09-10",4000000,"5411")],card,{mccCategories,referenceDate:"2026-09-18"});
assert.equal(below.totalCashback,0);
const two=evaluateCashbackProgram(switched.program,[tx("A","2026-09-15",4000000,"5611","10:29:59"),tx("B","2026-09-15",4000000,"5411","10:30:00")],card,{mccCategories,referenceDate:"2026-09-18"});
assert.equal(two.totalCashback,400000);
assert.equal(two.packages.find(item=>item.id==="DAILY").groups[0].totalCashback,200000);
assert.equal(two.packages.find(item=>item.id==="LIFESTYLE").groups[0].totalCashback,200000);
const derivedOnly=evaluateCashbackProgram(switched.program,[tx("A","2026-09-15",4000000,"5611","10:29:58"),tx("B","2026-09-15",4000000,"5812","10:29:59"),tx("C","2026-09-15",4000000,"5411","10:30:00"),tx("D","2026-09-15",4000000,"5812","10:30:01")],card,{mccCategories,referenceDate:"2026-09-18"});
assert.equal(derivedOnly.uncappedCashback,800000);
assert.equal(derivedOnly.totalCashback,800000);
assert.equal(derivedOnly.maxCashbackPerPeriod,800000);

const legacyProgram={id:"LEGACY",cardId:"CARD",name:"Legacy",totalSpendMinimum:null,conditionCombination:"OR",conditions:[condition("LEGACY-COND","5411")]};
const legacyResult=evaluateCashbackProgram(legacyProgram,[tx("LEGACY-TX","2026-09-10",4000000,"5411")],card,{mccCategories,referenceDate:"2026-09-18"});
assert.equal(legacyResult.packaged,false);
assert.equal(legacyResult.totalCashback,200000);
assert.equal("packageHistory" in legacyResult.group,false);

const carried=carryForwardCashbackPrograms([switched.program],2026,10,[card]);
assert.equal(carried.copiedCount,1);
assert.equal(carried.programs.at(-1).packageHistory.length,1);
assert.equal(carried.programs.at(-1).packageHistory[0].packageId,"DAILY");
const nextPeriod=getCashbackPeriodForCard(card,"2026-10-15");
assert.equal(carried.programs.at(-1).packageHistory[0].periodKey,cashbackPackagePeriodKey(nextPeriod));
assert.equal(carried.programs.at(-1).packageHistory[0].effectiveFrom,`${nextPeriod.startDate}T00:00:00`);
assert.equal(getActiveCashbackPackage(carried.programs.at(-1),nextPeriod,"2026-10-15T12:00:00").id,"DAILY");
assert.equal(getPackageSwitchCount(carried.programs.at(-1),nextPeriod),0);

const persistedInput={schemaVersion:17,cards:[card],mccCategories,cashbackProgramGroups:[switched.program]};
const reloaded=canonicalizeData(JSON.parse(JSON.stringify(canonicalizeData(persistedInput))));
assert.deepEqual(reloaded.cashbackProgramGroups[0].packageHistory,switched.program.packageHistory);
const migrated=canonicalizeDataWithMigration({schemaVersion:16,cards:[card],mccCategories,cashbackProgramGroups:[switched.program]});
assert.equal(migrated.data.schemaVersion,18);
assert.equal(migrated.data.cashbackProgramGroups[0].packages.length,2);
assert.equal(migrated.data.cashbackProgramGroups[0].packages[0].groups.length,2);
const legacyHistory=canonicalizeData({
  schemaVersion:17,
  cards:[card],
  mccCategories,
  cashbackProgramGroups:[{...program,packageHistory:[{id:"OLD",packageId:"LIFESTYLE",effectiveFrom:"2026-08-21",effectiveTo:null}]}]
});
assert.equal(legacyHistory.cashbackProgramGroups[0].packageHistory[0].periodKey,cashbackPackagePeriodKey(period));
assert.equal(legacyHistory.cashbackProgramGroups[0].packageHistory[0].effectiveFrom,"2026-08-21T00:00:00");

console.log("cashback package tests passed");
