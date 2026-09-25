import assert from "node:assert/strict";
import {canonicalizeDataWithMigration} from "../services/local-repository.js";
import {seedData} from "../services/default-data.js";

assert.equal(seedData.schemaVersion,19);

const card={id:"CARD",bankId:"BANK",cashbackCycle:"monthly"};
const condition=id=>({id,name:id,rate:.05,max:200000,allMcc:true,eligibleSpendMinimum:4000000});
const history={id:"HISTORY",periodKey:"monthly:2026-09-01:2026-09-30",packageId:"PACKAGE-A",effectiveFrom:"2026-09-01T00:00:00",effectiveTo:null};
const legacyGroup={id:"LEGACY-GROUP",name:"Legacy",totalSpendMinimum:5000000,maxCashback:350000,conditionCombination:"AND",note:"keep",conditions:[condition("C1"),condition("C2")]};
const input={
  schemaVersion:17,
  updatedAt:"2026-09-17T00:00:00.000Z",
  banks:[{id:"BANK",code:"B",name:"Bank"}],
  cards:[card],
  mccCategories:[],
  cashbackProgramGroups:[
    {id:"SIMPLE",cardId:"CARD",name:"Simple",year:2026,month:9,conditions:[condition("S1"),condition("S2")]},
    {id:"PACKAGED",cardId:"CARD",name:"Packaged",year:2026,month:9,packages:[{id:"PACKAGE-A",name:"A",groups:[legacyGroup]}],packageHistory:[history]}
  ]
};

const first=canonicalizeDataWithMigration(input);
assert.equal(first.data.schemaVersion,19);
assert.equal(first.changed,true);
assert.equal(first.data.cashbackCardConfigs[0].calculationMode,"independent");
assert.equal(first.data.cashbackProgramGroups.every(item=>!("conditionMode" in item)&&!("totalSpendMinimum" in item)),true);
const migratedGroup=first.data.cashbackProgramGroups[1].packages[0].groups[0];
assert.deepEqual(migratedGroup.conditions.map(item=>item.id),["C1","C2"]);
assert.equal(migratedGroup.totalSpendMinimum,legacyGroup.totalSpendMinimum);
assert.equal(migratedGroup.maxCashback,legacyGroup.maxCashback);
assert.equal(migratedGroup.conditionCombination,legacyGroup.conditionCombination);
assert.equal(migratedGroup.note,legacyGroup.note);
assert.deepEqual(first.data.cashbackProgramGroups[1].packageHistory,[history]);

const second=canonicalizeDataWithMigration(first.data);
assert.equal(second.changed,false);
assert.deepEqual(second.data.cashbackProgramGroups,first.data.cashbackProgramGroups);

console.log("cashback program migration tests passed");
