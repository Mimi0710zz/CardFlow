import assert from "node:assert/strict";
import fs from "node:fs";
import {buildCashbackProgramEditorModel,renderCashbackProgramEditor} from "../services/cashback-program-config.js";

const cards=[{id:"A"},{id:"B"}];
const programs=[
  {id:"A1",cardId:"A",name:"A One",conditionMode:"independent",conditions:[{id:"AC",name:"A Condition",rate:.05,max:200000,allMcc:true}]},
  {id:"B1",cardId:"B",name:"B One",conditionMode:"independent",conditions:[{id:"BC",name:"B Condition",rate:.05,max:200000,allMcc:true}]}
];
const model=buildCashbackProgramEditorModel({cards,programs,selection:{cardId:"B",programId:"A1"}});
assert.equal(model.selectedCard.id,"B");
assert.deepEqual(model.programOptions.map(item=>item.value),["B1"]);
assert.equal(model.selectedProgram.id,"B1");
const html=renderCashbackProgramEditor(model,{escape:String,formatMoney:String,mccOptions:()=>"",transactionMethodOptions:()=>""});
assert.equal(html.includes("A Condition"),false);
assert.equal(html.includes("B Condition"),true);
assert.equal((html.match(/name="cashbackConditionMode"/g)||[]).length,3);
assert.equal((html.match(/checked/g)||[]).length,1);

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
assert.match(app,/renderCashbackProgramEditor/);
assert.match(app,/data-cashback-card-select/);
assert.match(app,/data-cashback-program-select/);
assert.match(app,/data-save-program/);
assert.doesNotMatch(app,/function renderPrograms\(\)[\s\S]{0,2500}<table class="cashback-program-table"/);

console.log("cashback program workflow UI tests passed");
