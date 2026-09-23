import assert from "node:assert/strict";
import {buildCashbackProgramEditorModel,deriveProgramMaxCashback,programsForCard,resolveCashbackProgramSelection,updateCashbackCondition,visibleCashbackConditions} from "../services/cashback-program-config.js";

const programs=[{id:"A-1",cardId:"CARD-A",name:"Ăn uống",rate:.05,max:200000,allMcc:true},{id:"A-2",cardId:"CARD-A",name:"Mua sắm",rate:.03,max:100000,allMcc:true},{id:"B-1",cardId:"CARD-B",name:"Khác",rate:.01,max:50000,allMcc:true}];
assert.deepEqual(programsForCard(programs,"CARD-A").map(item=>item.id),["A-1","A-2"]);
assert.deepEqual(resolveCashbackProgramSelection({cards:[{id:"CARD-A"},{id:"CARD-B"}],programs,cardId:"CARD-B",programId:"A-2"}),{cardId:"CARD-B",programId:"B-1",packageId:""});
assert.equal(visibleCashbackConditions(programs[0])[0].condition.id,"A-1");
assert.equal(updateCashbackCondition(programs[0],{conditionId:"A-1"},{name:"Đã đổi"}).name,"Đã đổi");
assert.equal(deriveProgramMaxCashback(programs[0]),200000);
const mb=buildCashbackProgramEditorModel({cards:[{id:"MB Pla"}],programs:[{...programs[0],id:"MB-1",cardId:"MB Pla",packageId:"DAILY"}],cashbackCardConfigs:[{cardId:"MB Pla",statementMinSpend:5000000}],selection:{cardId:"MB Pla",programId:"MB-1"}});
assert.deepEqual(mb.packageOptions.map(item=>item.value),["DAILY","LIFESTYLE"]);
assert.equal(mb.selectedPackageId,"DAILY");
assert.equal(mb.cardConfig.statementMinSpend,5000000);
console.log("cashback program config tests passed");
