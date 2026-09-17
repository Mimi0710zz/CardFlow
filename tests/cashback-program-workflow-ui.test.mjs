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
const css=fs.readFileSync(new URL("../styles.css",import.meta.url),"utf8");
assert.match(app,/renderCashbackProgramPage/);
assert.match(app,/cashbackStructureSelection/);
assert.match(app,/data-cashback-card-select/);
assert.match(app,/data-cashback-program-select/);
assert.match(app,/data-save-program/);
assert.match(app,/data-structure-program-id/);
assert.match(app,/scrollIntoView/);
assert.match(app,/data-cancel-program/);
assert.match(app,/restoreCashbackProgramSnapshot/);
assert.match(app,/data-program-total-min[^\n]*disabled/);
assert.match(app,/data-condition-rate[^\n]*blur/);
assert.doesNotMatch(app,/function renderPrograms\(\)[\s\S]{0,2500}<table class="cashback-program-table"/);
assert.match(css,/\.cashback-program-selectors\{/);
assert.match(css,/\.cashback-program-section\{/);
assert.match(css,/\.cashback-program-condition-list\{/);
assert.match(css,/\.cashback-program-condition\{/);
assert.match(css,/\.cashback-program-layout\{[^}]*grid-template-columns:minmax\(0,4fr\) minmax\(220px,1fr\)/);
assert.match(css,/\.cashback-program-structure\{/);
assert.match(css,/\.cashback-calculation-layout\{[^}]*grid-template-columns/);
assert.match(css,/\.cashback-money-input>span\{/);
assert.match(css,/\.cashback-program-workflow\{[^}]*font-size:12px/);
assert.match(css,/\.cashback-condition-spend-minimum\{/);
assert.match(css,/\.cashback-mcc-select \.multi-option input\{[^}]*width:16px/);
assert.match(css,/\.cashback-total-spend-control\{/);
assert.match(css,/@media\(max-width:960px\)[\s\S]*\.cashback-program-layout\{grid-template-columns:1fr\}/);
assert.match(css,/@media\(max-width:767px\)[\s\S]*\.cashback-program-field-grid/);

console.log("cashback program workflow UI tests passed");
