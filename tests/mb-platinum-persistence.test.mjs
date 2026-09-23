import assert from "node:assert/strict";
import {canonicalizeData} from "../services/local-repository.js";
import {canonicalPersistedDataEqual} from "../services/sync-service.js";

const input={schemaVersion:19,updatedAt:"2026-09-23T00:00:00.000Z",banks:[{id:"BANK-MB",code:"MBB",name:"MB"}],cards:[{id:"MB Pla",bankId:"BANK-MB",cardType:"credit",cashbackCycle:"statement",statementDay:20}],mccCategories:[],cashbackProgramGroups:[{id:"DAILY-FOOD",cardId:"MB Pla",name:"Ăn uống",packageId:"DAILY",year:2026,month:9,allMcc:true,rate:.05,max:200000}],cashbackCardConfigs:[{cardId:"MB Pla",statementMinSpend:5000000,rotationAnchorPeriodKey:"statement:2026-08-21:2026-09-20",rotationAnchorPrimaryPackageId:"LIFESTYLE"}],transactions:[{id:"TX",cardId:"MB Pla",date:"2026-09-01",amount:1000000,cashbackPackageId:"DAILY",cashbackProgramId:"DAILY-FOOD"}]};
const canonical=canonicalizeData(input);
assert.equal(canonical.transactions[0].cashbackPackageId,"DAILY");
assert.equal(canonical.transactions[0].cashbackProgramId,"DAILY-FOOD");
assert.equal(canonical.cashbackCardConfigs[0].statementMinSpend,5000000);
assert.equal(canonicalPersistedDataEqual(canonical,structuredClone(canonical)),true);
console.log("MB Platinum persistence tests passed");
