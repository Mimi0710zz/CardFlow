import assert from "node:assert/strict";
import {deriveMbPlatinumSlotUsage,resolveMbPlatinumPackageRotation,validateMbPlatinumAssignment} from "../services/mb-platinum-cashback.js";

const card={id:"MB Pla",cashbackCycle:"statement",statementDay:20};
const config={cardId:"MB Pla",statementMinSpend:5000000,rotationAnchorPeriodKey:"statement:2026-08-21:2026-09-20",rotationAnchorPrimaryPackageId:"LIFESTYLE"};
assert.deepEqual(resolveMbPlatinumPackageRotation(config,card,"2026-09-12"),{period:{type:"statement",startDate:"2026-08-21",endDate:"2026-09-20"},periodKey:"statement:2026-08-21:2026-09-20",primaryPackageId:"LIFESTYLE",secondaryPackageId:"DAILY",limits:{DAILY:1,LIFESTYLE:2}});
assert.equal(resolveMbPlatinumPackageRotation(config,card,"2026-09-21").primaryPackageId,"DAILY");
assert.equal(resolveMbPlatinumPackageRotation(config,card,"2026-10-21").primaryPackageId,"LIFESTYLE");

const febCard={...card,statementDay:31};
const febConfig={...config,rotationAnchorPeriodKey:"statement:2026-02-01:2026-02-28"};
assert.equal(resolveMbPlatinumPackageRotation(febConfig,febCard,"2026-03-15").primaryPackageId,"DAILY");

const programs=[
  {id:"L-A",cardId:"MB Pla",name:"A",packageId:"LIFESTYLE",allMcc:true,channel:"Online"},
  {id:"L-B",cardId:"MB Pla",name:"B",packageId:"LIFESTYLE",allMcc:true,channel:"Online"},
  {id:"L-C",cardId:"MB Pla",name:"C",packageId:"LIFESTYLE",allMcc:true,channel:"Online"},
  {id:"D-A",cardId:"MB Pla",name:"A",packageId:"DAILY",allMcc:false,mccCategoryIds:["FOOD"],channel:"Online"}
];
const tx=(id,programId,packageId="LIFESTYLE",extra={})=>({id,cardId:"MB Pla",date:"2026-09-01",transactionTime:"10:00:00",amount:1000000,channel:"online",cashbackPackageId:packageId,cashbackProgramId:programId,...extra});
const mccCategories=[{id:"FOOD",name:"Ăn uống",mcc:"5812"},{id:"SHOP",name:"Mua sắm",mcc:"5411"}];
const base=[tx("2","L-B"),tx("1","L-A"),tx("3","L-A")];
const usage=deriveMbPlatinumSlotUsage({config,card,programs,transactions:base,mccCategories,referenceDate:"2026-09-12"});
assert.deepEqual(usage.packages.LIFESTYLE.occupiedProgramIds,["L-A","L-B"]);
assert.equal(usage.packages.LIFESTYLE.used,2);
assert.equal(usage.packages.LIFESTYLE.limit,2);

const reversed=deriveMbPlatinumSlotUsage({config,card,programs,transactions:[...base].reverse(),mccCategories,referenceDate:"2026-09-12"});
assert.deepEqual(reversed.packages.LIFESTYLE.occupiedProgramIds,usage.packages.LIFESTYLE.occupiedProgramIds);

const duplicate=validateMbPlatinumAssignment({config,card,programs,transactions:base,mccCategories,transaction:tx("4","L-A"),referenceDate:"2026-09-12"});
assert.equal(duplicate.valid,true);
assert.equal(duplicate.duplicate,true);
const third=validateMbPlatinumAssignment({config,card,programs,transactions:base,mccCategories,transaction:tx("4","L-C"),referenceDate:"2026-09-12"});
assert.equal(third.valid,false);
assert.match(third.message,/Đã sử dụng 2\/2 chương trình của Gói Phong cách sống/);

const secondary=deriveMbPlatinumSlotUsage({config,card,programs,transactions:[...base,tx("5","D-A","DAILY",{mccCategoryId:"FOOD",mcc:"5812"})],mccCategories,referenceDate:"2026-09-12"});
assert.deepEqual(secondary.packages.DAILY.occupiedProgramIds,["D-A"]);
assert.equal(secondary.totalUsed,3);

const unqualified=[
  tx("U1","",""),
  tx("U2","D-A","DAILY",{mccCategoryId:"SHOP",mcc:"5411"}),
  tx("U3","L-C","LIFESTYLE",{channel:"pos"}),
  tx("U4","D-A","LIFESTYLE",{mccCategoryId:"FOOD",mcc:"5812"})
];
assert.equal(deriveMbPlatinumSlotUsage({config,card,programs,transactions:unqualified,mccCategories,referenceDate:"2026-09-12"}).totalUsed,0);
assert.equal(deriveMbPlatinumSlotUsage({config,card,programs,transactions:base,mccCategories,referenceDate:"2026-09-21"}).totalUsed,0);
assert.equal(deriveMbPlatinumSlotUsage({config,card,programs,transactions:base,mccCategories,referenceDate:"2026-09-12",excludeTransactionId:"1"}).packages.LIFESTYLE.used,2);
assert.equal(deriveMbPlatinumSlotUsage({config,card,programs,transactions:[tx("1","L-A")],mccCategories,referenceDate:"2026-09-12",excludeTransactionId:"1"}).totalUsed,0);

console.log("MB Platinum cashback slot tests passed");
