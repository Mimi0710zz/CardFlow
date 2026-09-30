import assert from "node:assert/strict";
import {canonicalizeData,canonicalizeDataWithMigration} from "../services/local-repository.js";
import {buildCashbackProgramEditorModel,renderCashbackProgramPage} from "../services/cashback-program-config.js";
import {MB_PLATINUM_PACKAGE_LABELS} from "../services/mb-platinum-cashback.js";

const input={
  schemaVersion:20,
  updatedAt:"2026-09-30T03:00:00.000Z",
  banks:[{id:"BANK-MB",code:"MBB",name:"MB"}],
  cards:[{id:"MB Pla",bankId:"BANK-MB",cardType:"credit",cashbackCycle:"statement",statementDay:20}],
  mccCategories:[],
  cashbackProgramGroups:[
    {id:"PCS-ONLINE",cardId:"MB Pla",name:"[PCS] Mua sắm online: 5% max 200k",conditions:[{id:"C1",name:"Online",allMcc:true,rate:.05,max:200000}]},
    {id:"PCS-FOOD",cardId:"MB Pla",name:"[PCS] Ăn uống: 5% max 200k",conditions:[{id:"C2",name:"Ăn uống",allMcc:true,rate:.05,max:200000}]},
    {id:"HN-SHOP",cardId:"MB Pla",name:"[HN] Mua sắm: 5% max 200k",conditions:[{id:"C3",name:"Mua sắm",allMcc:true,rate:.05,max:200000}]}
  ]
};

const migrated=canonicalizeDataWithMigration(input);
assert.equal(migrated.changed,true,"legacy MB Pla package prefixes must count as a migration");
const canonical=canonicalizeData(input);
assert.deepEqual(canonical.cashbackProgramGroups.map(item=>[item.id,item.packageId]),[
  ["PCS-ONLINE","LIFESTYLE"],
  ["PCS-FOOD","LIFESTYLE"],
  ["HN-SHOP","DAILY"]
]);

const model=buildCashbackProgramEditorModel({
  cards:canonical.cards,
  programs:canonical.cashbackProgramGroups,
  cardCashbackConfigs:canonical.cashbackCardConfigs,
  selection:{cardId:"MB Pla"},
  packageLabels:MB_PLATINUM_PACKAGE_LABELS
});
assert.equal(model.flatPackageMode,true);
assert.deepEqual(model.packageOptions,[{value:"DAILY",label:"Hàng ngày"},{value:"LIFESTYLE",label:"Phong cách sống"}]);
const html=renderCashbackProgramPage(model,{escape:String,formatMoney:String,mccOptions:()=>"",transactionMethodOptions:()=>"",calculateSpendToMax:()=>0});
assert.match(html,/data-cashback-package-select/);
assert.match(html,/Hàng ngày/);
assert.match(html,/Phong cách sống/);
console.log("MB Platinum legacy package migration tests passed");
