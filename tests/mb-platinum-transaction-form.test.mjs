import assert from "node:assert/strict";
import {buildMbPlatinumTransactionFormModel,normalizeMbPlatinumTransactionAssignment,validateMbPlatinumTransactionAssignment} from "../services/mb-platinum-transaction-form.js";

const card={id:"MB Pla",cashbackCycle:"statement",statementDay:20};
const config={cardId:"MB Pla",statementMinSpend:5000000,rotationAnchorPeriodKey:"statement:2026-08-21:2026-09-20",rotationAnchorPrimaryPackageId:"LIFESTYLE"};
const programs=[
  {id:"LIFE-FOOD",cardId:"MB Pla",name:"Ăn uống",packageId:"LIFESTYLE",allMcc:true,channel:"Online"},
  {id:"LIFE-ONLINE",cardId:"MB Pla",name:"Mua sắm Online",packageId:"LIFESTYLE",allMcc:true,channel:"Online"},
  {id:"LIFE-FASHION",cardId:"MB Pla",name:"Thời trang",packageId:"LIFESTYLE",allMcc:true,channel:"Online"},
  {id:"DAILY-FOOD",cardId:"MB Pla",name:"Ăn uống",packageId:"DAILY",allMcc:true,channel:"Online"}
];
const assigned=(id,programId)=>({id,cardId:"MB Pla",date:"2026-09-01",transactionTime:"10:00:00",amount:1000000,channel:"online",cashbackPackageId:"LIFESTYLE",cashbackProgramId:programId});
const transactions=[assigned("T1","LIFE-FOOD"),assigned("T2","LIFE-ONLINE")];
const context={card,config,programs,transactions,mccCategories:[],referenceDate:"2026-09-12"};

assert.deepEqual(buildMbPlatinumTransactionFormModel({...context,card:{id:"OTHER"},transaction:{cardId:"OTHER"}}),{visible:false});
const blank=buildMbPlatinumTransactionFormModel({...context,transaction:{cardId:"MB Pla",date:"2026-09-02",channel:"online"}});
assert.equal(blank.packageId,"");
assert.equal(blank.programId,"");
assert.deepEqual(blank.programOptions,[]);
const lifestyle=buildMbPlatinumTransactionFormModel({...context,transaction:{cardId:"MB Pla",date:"2026-09-02",channel:"online",cashbackPackageId:"LIFESTYLE"}});
assert.deepEqual(lifestyle.programOptions.map(item=>item.id),["LIFE-FOOD","LIFE-ONLINE","LIFE-FASHION"]);
assert.match(lifestyle.packageOptions.find(item=>item.id==="LIFESTYLE").label,/Đã dùng 2\/2 chương trình/);
assert.equal(lifestyle.programOptions.find(item=>item.id==="LIFE-FOOD").disabled,false);
assert.equal(lifestyle.programOptions.find(item=>item.id==="LIFE-FASHION").disabled,true);
assert.match(lifestyle.programOptions.find(item=>item.id==="LIFE-FASHION").explanation,/đã đủ 2\/2/);

const edit=buildMbPlatinumTransactionFormModel({...context,transaction:transactions[0]});
assert.equal(edit.usage.packages.LIFESTYLE.used,1);
const invalid=validateMbPlatinumTransactionAssignment({...context,transaction:{...assigned("T3","LIFE-FASHION")}});
assert.equal(invalid.valid,false);
assert.match(invalid.message,/Đã sử dụng 2\/2/);
assert.deepEqual(normalizeMbPlatinumTransactionAssignment({cardId:"OTHER",cashbackPackageId:"DAILY",cashbackProgramId:"DAILY-FOOD"}),{cashbackPackageId:"",cashbackProgramId:""});
assert.deepEqual(normalizeMbPlatinumTransactionAssignment({cardId:"MB Pla",cashbackPackageId:"DAILY",cashbackProgramId:"DAILY-FOOD"}),{cashbackPackageId:"DAILY",cashbackProgramId:"DAILY-FOOD"});
console.log("MB Platinum transaction form tests passed");
