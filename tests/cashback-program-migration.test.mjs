import assert from "node:assert/strict";
import {canonicalizeDataWithMigration} from "../services/local-repository.js";
import {seedData} from "../services/default-data.js";

assert.equal(seedData.schemaVersion,19);
const card={id:"CARD",bankId:"BANK",cashbackCycle:"monthly"};
const condition=(id,name=id)=>({id,name,rate:.05,max:200000,allMcc:true,eligibleSpendMinimum:1000000});
const input={schemaVersion:18,updatedAt:"2026-09-17T00:00:00.000Z",banks:[{id:"BANK",code:"B",name:"Bank"}],cards:[card,{id:"MB Pla",bankId:"BANK",cashbackCycle:"statement",statementDay:20}],mccCategories:[],cashbackProgramGroups:[
  {id:"SIMPLE",cardId:"CARD",name:"Legacy parent",year:2026,month:9,totalSpendMinimum:5000000,conditionCombination:"AND",note:"keep",conditions:[condition("FOOD","Ăn uống"),condition("SHOP","Mua sắm")]},
  {id:"PACK-A",cardId:"MB Pla",name:"Packaged",year:2026,month:9,packages:[
    {id:"DAILY",name:"Hàng ngày",groups:[{id:"DG",name:"Daily",conditions:[condition("FOOD","Ăn uống")]}]},
    {id:"LIFESTYLE",name:"Phong cách sống",groups:[{id:"LG",name:"Lifestyle",conditions:[condition("FOOD","Ăn uống")]}]}
  ]}
]};

const first=canonicalizeDataWithMigration(input);
assert.equal(first.data.schemaVersion,19);
assert.equal(first.changed,true);
assert.equal(first.data.cashbackProgramGroups.length,4);
assert.deepEqual(first.data.cashbackProgramGroups.slice(0,2).map(item=>item.name),["Ăn uống","Mua sắm"]);
assert.deepEqual(first.data.cashbackProgramGroups.slice(0,2).map(item=>item.id),["FOOD","SHOP"]);
assert.equal(first.data.cashbackProgramGroups[0].legacyProgram.id,"SIMPLE");
assert.equal(first.data.cashbackProgramGroups[0].legacyProgram.totalSpendMinimum,5000000);
assert.equal(first.data.cashbackProgramGroups[0].conditionCombination,"AND");
assert.equal(first.data.cashbackProgramGroups[0].note,"keep");
const packaged=first.data.cashbackProgramGroups.slice(2);
assert.deepEqual(packaged.map(item=>item.packageId),["DAILY","LIFESTYLE"]);
assert.deepEqual(packaged.map(item=>item.name),["Ăn uống","Ăn uống"]);
assert.deepEqual(packaged.map(item=>item.id),["FOOD-2","FOOD-3"]);

const second=canonicalizeDataWithMigration(first.data);
assert.equal(second.changed,false);
assert.deepEqual(second.data.cashbackProgramGroups,first.data.cashbackProgramGroups);
console.log("cashback program migration tests passed");
