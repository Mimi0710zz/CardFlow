import assert from "node:assert/strict";
import { evaluateCashbackGroup } from "../services/cashback-evaluation.js";
import { canonicalizeDataWithMigration } from "../services/local-repository.js";

const card={id:"CARD",cashbackCycle:"monthly"};
const mccCategories=[{id:"FOOD",name:"Ăn uống",mcc:"5812"},{id:"FASHION",name:"Thời trang",mcc:"5611"}];
const group={id:"MB-5",cardId:"CARD",name:"Gói hoàn tiền 5%",year:2026,month:9,totalSpendMinimum:5000000,conditionCombination:"AND",conditions:[
  {id:"FOOD-5",name:"Ăn uống",rate:.05,max:200000,eligibleSpendMinimum:0,mccCategoryIds:["FOOD"],channel:""},
  {id:"ONLINE-5",name:"Online",rate:.05,max:200000,eligibleSpendMinimum:0,allMcc:true,channel:"Online"},
  {id:"FASHION-5",name:"Thời trang",rate:.05,max:200000,eligibleSpendMinimum:0,mccCategoryIds:["FASHION"],channel:""}
]};
const tx=(id,amount,mccCategoryId="FOOD",channel="Offline",orderType="")=>({id,cardId:"CARD",date:"2026-09-10",amount,mccCategoryId,channel,orderType,status:"Tiêu cá nhân"});

const below=evaluateCashbackGroup(group,[tx("FOOD",4000000),tx("OTHER",800000,"FASHION")],card,{mccCategories,referenceDate:"2026-09-15"});
assert.equal(below.totalSpend,4800000);
assert.equal(below.groupSatisfied,false);
assert.equal(below.conditions[0].eligibleSpend,4000000);
assert.equal(below.conditions[0].finalCashback,0);

const met=evaluateCashbackGroup(group,[tx("FOOD",4000000),tx("OTHER",1200000,"FASHION")],card,{mccCategories,referenceDate:"2026-09-15"});
assert.equal(met.totalSpend,5200000);
assert.equal(met.groupSatisfied,true);
assert.equal(met.conditions[0].finalCashback,200000);
assert.equal(met.conditions[2].finalCashback,60000);

const vp={id:"VP",cardId:"CARD",name:"VP StepUp",totalSpendMinimum:100000000,conditionCombination:"AND",conditions:[{id:"VP-ONLINE",name:"Online",rate:.15,max:1500000,eligibleSpendMinimum:10000000,allMcc:true,channel:"Online"}]};
const vpResult=evaluateCashbackGroup(vp,[tx("ONLINE",10000000,"FOOD","Online"),tx("POS",90000000,"FOOD","Offline")],card,{mccCategories,referenceDate:"2026-09-15"});
assert.equal(vpResult.totalSpend,100000000);
assert.equal(vpResult.conditions[0].eligibleSpend,10000000);
assert.equal(vpResult.overallSatisfied,true);
assert.equal(vpResult.totalCashback,1500000);

const bug=evaluateCashbackGroup({...vp,totalSpendMinimum:null},[tx("BUG",10000000,"FOOD","Offline","BUG-LAZADA")],card,{mccCategories,referenceDate:"2026-09-15"});
assert.equal(bug.conditions[0].eligibleSpend,10000000);

const legacy={schemaVersion:15,banks:[],cards:[card],mccCategories,transactions:[],cashbackPrograms:[{id:"LEGACY",cardId:"CARD",name:"Legacy",year:2026,month:9,totalTarget:5000000,rate:.05,max:200000,mccCategoryIds:["FOOD"],channel:"Online",notes:"Giữ lại"}]};
const first=canonicalizeDataWithMigration(legacy);
assert.equal(first.data.schemaVersion,19);
assert.equal(first.data.cashbackProgramGroups.length,1);
assert.equal(first.data.cashbackProgramGroups[0].id,"LEGACY");
assert.equal(first.data.cashbackProgramGroups[0].conditions[0].id,"LEGACY");
assert.equal(first.data.cashbackCardConfigs[0].totalSpendRequirement.amount,5000000);
assert.equal("totalSpendMinimum" in first.data.cashbackProgramGroups[0],false);
assert.equal(first.data.cashbackProgramGroups[0].conditions[0].note,"Giữ lại");
const second=canonicalizeDataWithMigration(first.data);
assert.equal(second.changed,false);
assert.deepEqual(second.data.cashbackProgramGroups,first.data.cashbackProgramGroups);

console.log("cashback group architecture tests passed");
