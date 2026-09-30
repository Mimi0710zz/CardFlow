import assert from "node:assert/strict";
import {buildCashbackProgramEditorModel,renderCashbackProgramPage} from "../services/cashback-program-config.js";

const cards=[{id:"MB Pla"}];
const programs=[
  {id:"LIFE-ONLINE",cardId:"MB Pla",name:"Mua sắm Online",packageId:"LIFESTYLE",conditions:[{id:"C1",name:"Online",allMcc:true,rate:.05,max:200000}]},
  {id:"LIFE-FOOD",cardId:"MB Pla",name:"Ăn uống",packageId:"LIFESTYLE",conditions:[{id:"C2",name:"Ăn uống",allMcc:true,rate:.05,max:200000}]},
  {id:"DAILY-SHOP",cardId:"MB Pla",name:"Mua sắm",packageId:"DAILY",conditions:[{id:"C3",name:"Mua sắm",allMcc:true,rate:.05,max:200000}]}
];
const labels={DAILY:"Hàng ngày",LIFESTYLE:"Phong cách sống"};

const model=buildCashbackProgramEditorModel({cards,programs,cardCashbackConfigs:[{cardId:"MB Pla",statementMinSpend:5000000}],selection:{cardId:"MB Pla",packageId:"LIFESTYLE"},packageLabels:labels});
assert.equal(model.flatPackageMode,true);
assert.equal(model.selection.packageId,"LIFESTYLE");
assert.deepEqual(model.packageOptions,[{value:"DAILY",label:"Hàng ngày"},{value:"LIFESTYLE",label:"Phong cách sống"}]);
assert.deepEqual(model.programOptions.map(item=>item.value),["LIFE-ONLINE","LIFE-FOOD"]);
assert.equal(model.selectedProgram.id,"LIFE-ONLINE");
assert.deepEqual(model.selectedCardConfig.totalSpendRequirement,{enabled:true,amount:5000000});

const html=renderCashbackProgramPage(model,{escape:String,formatMoney:String,mccOptions:()=>"",transactionMethodOptions:()=>"",calculateSpendToMax:()=>0});
assert.match(html,/Gói hoàn tiền/);
assert.match(html,/Phong cách sống/);
assert.match(html,/Hàng ngày/);
assert.ok(html.indexOf('data-cashback-package-select')<html.indexOf('data-cashback-program-select'),"MB Pla phải chọn Gói trước Chương trình");
console.log("MB Platinum flat-package program editor tests passed");
