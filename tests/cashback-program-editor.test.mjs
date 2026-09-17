import assert from "node:assert/strict";
import {buildCashbackProgramEditorModel,renderCashbackProgramEditor} from "../services/cashback-program-config.js";

const cards=[{id:"CARD-A"},{id:"CARD-B"}];
const simple={id:"SIMPLE",cardId:"CARD-A",name:"Program riêng",conditionMode:"independent",conditions:[{id:"C1",name:"Condition riêng",rate:.05,max:200000,allMcc:true}]};
const packaged={id:"PACKAGED",cardId:"CARD-B",name:"Packaged",conditionMode:"first_match",packages:[
  {id:"PACKAGE-A",name:"Package A",groups:[{id:"GA",conditions:[{id:"A1",name:"A Condition",rate:.05,max:200000,allMcc:true}]}]},
  {id:"PACKAGE-B",name:"Package B",groups:[{id:"GB",conditions:[{id:"B1",name:"B Condition",rate:.03,max:100000,allMcc:true}]}]}
]};
const programs=[simple,{...simple,id:"SIMPLE-2",name:"Program 2"},packaged];
const helpers={escape:value=>String(value??""),formatMoney:value=>String(value??""),mccOptions:()=>"<option>Tất cả</option>",transactionMethodOptions:()=>"<option>Tất cả</option>"};

const simpleModel=buildCashbackProgramEditorModel({cards,programs,selection:{cardId:"CARD-A",programId:"SIMPLE"}});
assert.deepEqual(simpleModel.programOptions.map(item=>item.value),["SIMPLE","SIMPLE-2"]);
assert.equal(simpleModel.packageOptions.length,0);
assert.equal(simpleModel.selectedProgram.name,"Program riêng");
assert.equal(simpleModel.conditions[0].condition.name,"Condition riêng");
const simpleHtml=renderCashbackProgramEditor(simpleModel,helpers);
assert.equal(simpleHtml.includes("data-cashback-package-select"),false);
assert.equal(simpleHtml.includes("Program riêng"),true);
assert.equal(simpleHtml.includes("Condition riêng"),true);
assert.equal(simpleHtml.includes("Tên nhóm"),false);
assert.equal(simpleHtml.includes("Chi tổng nhóm"),false);

const packageAModel=buildCashbackProgramEditorModel({cards,programs,selection:{cardId:"CARD-B",programId:"PACKAGED",packageId:"PACKAGE-A"}});
const packageAHtml=renderCashbackProgramEditor(packageAModel,helpers);
assert.equal(packageAHtml.includes("data-cashback-package-select"),true);
assert.equal(packageAHtml.includes("A Condition"),true);
assert.equal(packageAHtml.includes("B Condition"),false);
assert.equal((packageAHtml.match(/name="cashbackConditionMode"/g)||[]).length,3);
assert.match(packageAHtml,/data-condition-spend-to-max[^>]*readonly/);
assert.equal((packageAHtml.match(/data-move-condition/g)||[]).length,2);

const packageBModel=buildCashbackProgramEditorModel({cards,programs,selection:{cardId:"CARD-B",programId:"PACKAGED",packageId:"PACKAGE-B"}});
const packageBHtml=renderCashbackProgramEditor(packageBModel,helpers);
assert.equal(packageBHtml.includes("B Condition"),true);
assert.equal(packageBHtml.includes("A Condition"),false);

console.log("cashback program editor tests passed");
