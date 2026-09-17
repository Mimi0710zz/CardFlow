import assert from "node:assert/strict";
import {exportCashbackProgramRows,importCashbackProgramRows} from "../services/cashback-program-excel.js";

const mccCategories=[{id:"FOOD",name:"Ăn uống",mcc:"5812"}];
const condition=(id,name)=>({id,name,rate:.05,max:200000,maxCashbackUnlimited:false,eligibleSpendMinimum:1000000,allMcc:false,mccCategoryIds:["FOOD"],channel:"Online",note:`Note ${id}`});
const history=[{id:"H",periodKey:"monthly:2026-09-01:2026-09-30",packageId:"PA",effectiveFrom:"2026-09-01T00:00:00",effectiveTo:null}];
const programs=[
  {id:"SIMPLE",cardId:"CARD",name:"Simple Program",year:2026,month:9,conditionMode:"all_required",totalSpendMinimum:5000000,maxCashbackPerPeriod:300000,conditionCombination:"AND",conditions:[condition("S1","First"),condition("S2","Second")]},
  {id:"PACKAGED",cardId:"CARD",name:"Packaged Program",year:2026,month:9,conditionMode:"first_match",totalSpendMinimum:6000000,maxCashbackPerPeriod:400000,packageSwitchLimit:1,packages:[{id:"PA",name:"Package A",groups:[{id:"GA",name:"Legacy Group",totalSpendMinimum:2000000,conditionCombination:"AND",note:"Legacy note",conditions:[condition("P1","Package condition")]}]}],packageHistory:history}
];
const context={mccCategories,cards:[{id:"CARD"}],existingPrograms:programs};

const rows=exportCashbackProgramRows(programs,context);
assert.equal(rows.length,3);
assert.deepEqual(rows.filter(row=>row["Program ID"]==="SIMPLE").map(row=>row["Thứ tự điều kiện"]),[1,2]);
assert.deepEqual(rows.filter(row=>row["Program ID"]==="PACKAGED").map(row=>row["Thứ tự điều kiện"]),[1]);
assert.equal(rows.filter(row=>row["Program ID"]==="SIMPLE").every(row=>row["Condition Mode"]==="all_required"),true);
assert.equal(rows.find(row=>row["Program ID"]==="PACKAGED")["Condition Mode"],"first_match");
assert.equal(rows.find(row=>row["Program ID"]==="SIMPLE")["Tên chương trình"],"Simple Program");
assert.equal(rows.find(row=>row["Program ID"]==="SIMPLE")["Chi tổng doanh số kèm theo"],1000000);
assert.equal(rows.some(row=>Object.keys(row).some(key=>key.toLowerCase().includes("packagehistory"))),false);

const imported=importCashbackProgramRows(rows,context);
const importedSimple=imported.find(item=>item.id==="SIMPLE"),importedPackaged=imported.find(item=>item.id==="PACKAGED");
assert.equal(importedSimple.name,"Simple Program");
assert.equal(importedPackaged.name,"Packaged Program");
assert.equal(importedSimple.conditionMode,"all_required");
assert.equal(importedPackaged.conditionMode,"first_match");
assert.deepEqual(importedSimple.conditions.map(item=>item.id),["S1","S2"]);
assert.equal(importedPackaged.packages[0].groups[0].conditionCombination,"AND");
assert.equal(importedPackaged.packages[0].groups[0].totalSpendMinimum,2000000);
assert.deepEqual(importedPackaged.packageHistory,history);

const legacyRows=[{
  "Năm":2026,"Tháng":9,"Card ID":"CARD","Group ID":"LEGACY","Tên nhóm":"Legacy Program","Tổng chi tối thiểu":5000000,"Điều kiện kết hợp":"AND","Condition ID":"LC","Tên điều kiện":"Legacy condition","% CB":"5%","Max CB":200000,"Chi nhóm tối thiểu":1000000,"Hình thức giao dịch":"Online","Mã MCC":"5812"
}];
const legacy=importCashbackProgramRows(legacyRows,context);
assert.equal(legacy[0].name,"Legacy Program");
assert.equal(legacy[0].conditionMode,"independent");
assert.equal(legacy[0].conditions.length,1);
assert.equal(legacy[0].conditions[0].eligibleSpendMinimum,1000000);

console.log("cashback program Excel tests passed");
