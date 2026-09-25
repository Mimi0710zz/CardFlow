import assert from "node:assert/strict";
import {cardCashbackConfigFor,normalizeCardCashbackConfigs,upsertCardCashbackConfig} from "../services/cashback-card-config.js";
import {canonicalizeDataWithMigration} from "../services/local-repository.js";

const programs=[
  {id:"P1",cardId:"CARD-A",conditionMode:"supporting",totalSpendMinimum:10000000,conditions:[]},
  {id:"P2",cardId:"CARD-A",conditionMode:"first_match",totalSpendMinimum:5000000,conditions:[]},
  {id:"P3",cardId:"CARD-B",conditionMode:"all_required",totalSpendMinimum:7000000,conditions:[]}
];
const migrated=normalizeCardCashbackConfigs([],programs);
assert.deepEqual(cardCashbackConfigFor(migrated,"CARD-A"),{cardId:"CARD-A",calculationMode:"supporting",totalSpendRequirement:{enabled:true,amount:10000000}});
assert.equal(cardCashbackConfigFor(migrated,"CARD-B").calculationMode,"all_required");
const updated=upsertCardCashbackConfig(migrated,{cardId:"CARD-A",calculationMode:"first_match",totalSpendRequirement:{enabled:true,amount:12000000}});
assert.equal(cardCashbackConfigFor(updated,"CARD-A").totalSpendRequirement.amount,12000000);
assert.equal(cardCashbackConfigFor(updated,"CARD-B").totalSpendRequirement.amount,7000000);
const persisted=canonicalizeDataWithMigration({schemaVersion:18,banks:[],cards:[{id:"CARD-A"},{id:"CARD-B"}],cashbackProgramGroups:programs,cashbackCardConfigs:updated,mccCategories:[],transactions:[]}).data;
assert.equal(persisted.schemaVersion,20);
assert.deepEqual(persisted.cashbackCardConfigs,updated);
assert.equal(persisted.cashbackProgramGroups.length,3);
console.log("cashback card config tests passed");
