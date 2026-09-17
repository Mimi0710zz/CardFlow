import assert from "node:assert/strict";
import {
  addCashbackCondition,
  moveCashbackCondition,
  programsForCard,
  removeCashbackCondition,
  resolveCashbackProgramSelection,
  updateCashbackCondition,
  visibleCashbackConditions
} from "../services/cashback-program-config.js";

const condition=(id,name=id)=>({id,name,rate:.05,max:200000,allMcc:true});
const legacyGroup={
  id:"LEGACY-GROUP",
  name:"Legacy hidden group",
  totalSpendMinimum:5000000,
  conditionCombination:"AND",
  note:"keep me",
  conditions:[condition("A-1"),condition("A-2")]
};
const packaged={id:"PACKAGED",cardId:"CARD-A",name:"Packaged",packages:[
  {id:"PACKAGE-A",name:"A",groups:[legacyGroup]},
  {id:"PACKAGE-B",name:"B",groups:[{id:"GROUP-B",name:"B",conditions:[condition("B-1")]}]}
]};
const programs=[
  {id:"A-1",cardId:"CARD-A",name:"Alpha",conditions:[condition("SIMPLE-A")]},
  {id:"A-2",cardId:"CARD-A",name:"Beta",conditions:[condition("SIMPLE-B")]},
  {id:"B-1",cardId:"CARD-B",name:"Gamma",conditions:[condition("SIMPLE-C")]}
];

assert.deepEqual(programsForCard(programs,"CARD-A").map(item=>item.id),["A-1","A-2"]);

const changedCard=resolveCashbackProgramSelection({
  cards:[{id:"CARD-A"},{id:"CARD-B"}],programs,cardId:"CARD-B",programId:"A-2",packageId:"OLD"
});
assert.deepEqual(changedCard,{cardId:"CARD-B",programId:"B-1",packageId:""});

assert.deepEqual(visibleCashbackConditions(packaged,"PACKAGE-A").map(item=>item.condition.id),["A-1","A-2"]);
assert.deepEqual(visibleCashbackConditions(packaged,"PACKAGE-B").map(item=>item.condition.id),["B-1"]);
assert.deepEqual(visibleCashbackConditions(packaged,"PACKAGE-A")[0].ref,{packageId:"PACKAGE-A",groupId:"LEGACY-GROUP",conditionId:"A-1"});

const updated=updateCashbackCondition(packaged,{packageId:"PACKAGE-A",groupId:"LEGACY-GROUP",conditionId:"A-1"},{name:"Updated"});
assert.equal(updated.packages[0].groups[0].conditions[0].name,"Updated");
assert.equal(updated.packages[0].groups[0].conditions[1].name,"A-2");
assert.equal(updated.packages[0].groups[0].totalSpendMinimum,5000000);
assert.equal(updated.packages[0].groups[0].conditionCombination,"AND");
assert.equal(updated.packages[0].groups[0].note,"keep me");
assert.deepEqual(updated.packages[1],packaged.packages[1]);

const added=addCashbackCondition(packaged,{packageId:"PACKAGE-A"},condition("A-3"));
assert.deepEqual(visibleCashbackConditions(added,"PACKAGE-A").map(item=>item.condition.id),["A-1","A-2","A-3"]);
assert.deepEqual(visibleCashbackConditions(added,"PACKAGE-B").map(item=>item.condition.id),["B-1"]);
assert.equal(added.packages[0].groups.at(-1).conditions.length,1);
assert.equal(added.packages[0].groups.at(-1).conditionCombination,"OR");

const removed=removeCashbackCondition(added,{packageId:"PACKAGE-A",groupId:added.packages[0].groups.at(-1).id,conditionId:"A-3"});
assert.deepEqual(visibleCashbackConditions(removed,"PACKAGE-A").map(item=>item.condition.id),["A-1","A-2"]);
assert.deepEqual(visibleCashbackConditions(removed,"PACKAGE-B").map(item=>item.condition.id),["B-1"]);

const moved=moveCashbackCondition(packaged,{packageId:"PACKAGE-A",groupId:"LEGACY-GROUP",conditionId:"A-2"},-1);
assert.deepEqual(visibleCashbackConditions(moved,"PACKAGE-A").map(item=>item.condition.id),["A-2","A-1"]);
assert.equal(moved.packages[0].groups[0].conditionCombination,"AND");

const crossGroup={...packaged,packages:[{...packaged.packages[0],groups:[
  {id:"G1",name:"One",conditions:[condition("ONE")]},
  {id:"G2",name:"Two",conditions:[condition("TWO")]}
]}]};
const crossMoved=moveCashbackCondition(crossGroup,{packageId:"PACKAGE-A",groupId:"G2",conditionId:"TWO"},-1);
assert.deepEqual(visibleCashbackConditions(crossMoved,"PACKAGE-A").map(item=>item.condition.id),["TWO","ONE"]);

console.log("cashback program config tests passed");
