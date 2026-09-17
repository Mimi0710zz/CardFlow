import assert from "node:assert/strict";
import {calculateSpendToMax} from "../services/cashback.js";
import {buildCashbackMccOptionItems,buildCashbackProgramEditorModel,cacheCashbackProgramSnapshot,cashbackStructureSelection,renderCashbackProgramEditor,renderCashbackProgramPage,renderCashbackProgramStructure,restoreCashbackProgramSnapshot,snapshotCashbackProgram} from "../services/cashback-program-config.js";

const cards=[{id:"CARD-A"},{id:"CARD-B"}];
const simple={id:"SIMPLE",cardId:"CARD-A",name:"Program riêng",conditionMode:"independent",conditions:[{id:"C1",name:"Condition riêng",rate:.05,max:200000,allMcc:true}]};
const packaged={id:"PACKAGED",cardId:"CARD-B",name:"Packaged",conditionMode:"first_match",packages:[
  {id:"PACKAGE-A",name:"Package A",groups:[{id:"GA",conditions:[{id:"A1",name:"A Condition",rate:.05,max:200000,allMcc:true}]}]},
  {id:"PACKAGE-B",name:"Package B",groups:[{id:"GB",conditions:[{id:"B1",name:"B Condition",rate:.03,max:100000,allMcc:true}]}]}
]};
const programs=[simple,{...simple,id:"SIMPLE-2",name:"Program 2"},packaged];
const helpers={escape:value=>String(value??""),formatMoney:value=>String(value??""),calculateSpendToMax,mccOptions:()=>"<option>Tất cả</option>",transactionMethodOptions:()=>"<option>Tất cả</option>"};

const blankModel=buildCashbackProgramEditorModel({cards:[{id:"TECH Every"},{id:"ACB Visa"},{id:"MB Pla"}],programs,selection:{}});
assert.equal(blankModel.selection.cardId,"");
assert.equal(blankModel.selectedCard,null);
assert.deepEqual(blankModel.cardOptions.map(item=>item.value),["ACB Visa","MB Pla","TECH Every"]);
assert.deepEqual(blankModel.programOptions,[]);
const blankHtml=renderCashbackProgramEditor(blankModel,helpers);
assert.match(blankHtml,/<option value="" selected>Chọn thẻ<\/option>/);
assert.match(blankHtml,/data-cashback-program-select[^>]*disabled/);
assert.equal(blankHtml.includes("TECH Every\" selected"),false);
assert.equal(blankHtml.includes("Vui lòng chọn thẻ để cấu hình cashback."),true);

const mccOptions=buildCashbackMccOptionItems([
  {id:"MCC-5812",name:"Ăn uống",mcc:"5812"},
  {id:"MCC-5411",name:"Siêu thị",mcc:"5411"}
]);
assert.deepEqual(mccOptions,[
  {value:"MCC-5411",label:"5411 - Siêu thị"},
  {value:"MCC-5812",label:"5812 - Ăn uống"}
]);

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
assert.match(simpleHtml,/class="field cashback-condition-spend-minimum"/);
assert.match(simpleHtml,/class="cashback-rate-input"[^>]*>[\s\S]*data-condition-rate[^>]*value="5\.0"[\s\S]*<span>%<\/span>/);
assert.match(simpleHtml,/data-condition-spend-to-max[^>]*value="4000000"[^>]*readonly/);
assert.equal(simpleHtml.includes("Điều kiện nào đạt trước thì dừng toàn bộ"),true);
assert.equal((simpleHtml.match(/class="money-input /g)||[]).length,5);
assert.equal((simpleHtml.match(/<span>đ<\/span>/g)||[]).length,5);
assert.equal(simpleHtml.includes("Yêu cầu tổng doanh số toàn chương trình phải đạt"),false);
assert.match(simpleHtml,/data-program-total-min[^>]*disabled/);
assert.match(simpleHtml,/data-cancel-program>Huỷ<\/button>/);
const totalSpendHtml=renderCashbackProgramEditor(buildCashbackProgramEditorModel({
  cards,
  programs:[{...simple,totalSpendMinimum:5000000}],
  selection:{cardId:"CARD-A",programId:"SIMPLE"}
}),helpers);
assert.match(totalSpendHtml,/data-program-total-enabled[^>]*checked/);
assert.match(totalSpendHtml,/data-program-total-min[^>]*value="5000000"/);
assert.doesNotMatch(totalSpendHtml,/data-program-total-min[^>]*disabled/);
const simplePage=renderCashbackProgramPage(simpleModel,helpers);
assert.equal(simplePage.includes("<h2>Chương trình cashback</h2>"),false);
assert.equal(simplePage.includes("Cấu hình từng thẻ, chương trình và gói hoàn tiền."),false);
assert.equal(simplePage.includes("cashback-program-layout"),true);

const simpleStructure=renderCashbackProgramStructure(simpleModel,helpers);
assert.equal(simpleStructure.includes("Thẻ: CARD-A"),true);
assert.equal(simpleStructure.includes("1. Program riêng"),true);
assert.equal(simpleStructure.includes("2. Program 2"),true);
assert.equal(simpleStructure.includes("Condition riêng"),true);
assert.equal(simpleStructure.includes("data-structure-program-id=\"SIMPLE\""),true);
assert.equal(simpleStructure.includes("is-selected"),true);

const packageAModel=buildCashbackProgramEditorModel({cards,programs,selection:{cardId:"CARD-B",programId:"PACKAGED",packageId:"PACKAGE-A"}});
const packageAHtml=renderCashbackProgramEditor(packageAModel,helpers);
assert.equal(packageAHtml.includes("data-cashback-package-select"),true);
assert.equal(packageAHtml.includes("A Condition"),true);
assert.equal(packageAHtml.includes("B Condition"),false);
assert.equal((packageAHtml.match(/name="cashbackConditionMode"/g)||[]).length,3);
assert.match(packageAHtml,/data-condition-spend-to-max[^>]*readonly/);
assert.equal((packageAHtml.match(/data-move-condition/g)||[]).length,2);
const packagedStructure=renderCashbackProgramStructure(packageAModel,helpers);
assert.equal(packagedStructure.includes("1. Packaged"),true);
assert.equal(packagedStructure.includes("Package A"),true);
assert.equal(packagedStructure.includes("Package B"),true);
assert.equal(packagedStructure.includes("A Condition"),true);
assert.equal(packagedStructure.includes("B Condition"),true);
assert.equal(packagedStructure.includes("data-structure-package-id=\"PACKAGE-A\""),true);
assert.equal(packagedStructure.includes("data-structure-condition-id=\"A1\""),true);

assert.deepEqual(cashbackStructureSelection({cardId:"CARD-B",programId:"PACKAGED",packageId:"PACKAGE-A"},{programId:"PACKAGED"}),{cardId:"CARD-B",programId:"PACKAGED",packageId:""});
assert.deepEqual(cashbackStructureSelection({cardId:"CARD-B",programId:"PACKAGED",packageId:""},{programId:"PACKAGED",packageId:"PACKAGE-B"}),{cardId:"CARD-B",programId:"PACKAGED",packageId:"PACKAGE-B"});

const snapshot=snapshotCashbackProgram(packaged);
const packagedDraft=snapshotCashbackProgram(packaged);
packagedDraft.packages[0].groups[0].conditions[0].name="Unsaved";
const restoredPrograms=restoreCashbackProgramSnapshot([...programs.filter(program=>program.id!=="PACKAGED"),packagedDraft],snapshot);
assert.equal(restoredPrograms.find(program=>program.id==="PACKAGED").packages[0].groups[0].conditions[0].name,"A Condition");
assert.notEqual(restoredPrograms.find(program=>program.id==="PACKAGED"),snapshot);
const periodSnapshot=snapshotCashbackProgram({...simple,year:2026,month:9,name:"Saved September"});
const scopedRestore=restoreCashbackProgramSnapshot([
  {...simple,year:2026,month:9,name:"Draft September"},
  {...simple,year:2026,month:10,name:"Saved October"}
],periodSnapshot);
assert.deepEqual(scopedRestore.map(program=>program.name),["Saved September","Saved October"]);
const snapshotCache=new Map();
cacheCashbackProgramSnapshot(snapshotCache,{...simple,year:2026,month:9,name:"Before save"});
cacheCashbackProgramSnapshot(snapshotCache,{...simple,year:2026,month:9,name:"After save"});
assert.equal([...snapshotCache.values()][0].name,"After save");

const packageBModel=buildCashbackProgramEditorModel({cards,programs,selection:{cardId:"CARD-B",programId:"PACKAGED",packageId:"PACKAGE-B"}});
const packageBHtml=renderCashbackProgramEditor(packageBModel,helpers);
assert.equal(packageBHtml.includes("B Condition"),true);
assert.equal(packageBHtml.includes("A Condition"),false);

console.log("cashback program editor tests passed");
