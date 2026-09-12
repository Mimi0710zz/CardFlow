import assert from "node:assert/strict";
import { canonicalizeData } from "../services/local-repository.js";

const data=canonicalizeData({
  schemaVersion:11,
  banks:[{id:"BANK",code:"BANK",name:"Bank"}],
  cards:[{id:"CAKE",bankId:"BANK",annualFee:500000,activationDate:"2026-02-03"}],
  feeTargets:[{id:"FEE",cardId:"CAKE",feeType:"annual_fee",feeAmount:300000,annualFee:300000,activationDate:"2025-01-01",periodStart:"2025-01-01",deadline:"2026-12-31"}]
});

const target=data.feeTargets[0];
assert.equal(data.schemaVersion,13);
assert.equal(target.feeAmount,300000);
assert.equal(target.activationDate,"2026-02-03");
assert.equal(target.legacyFeeAmount,300000);
assert.equal(target.legacyActivationDate,"2025-01-01");
assert.equal("annualFee" in data.cards[0],false);

const legacyManagement=canonicalizeData({
  schemaVersion:11,
  banks:[{id:"BANK",code:"BANK",name:"Bank"}],
  cards:[{id:"CAKE",bankId:"BANK",activationDate:"2026-02-03"}],
  feeTargets:[{id:"MANAGEMENT",cardId:"CAKE",managementFee:90000,settlementDate:"2026-12-31",waiverTarget:1000000}]
}).feeTargets[0];
assert.equal(legacyManagement.feeType,"management_fee");
assert.equal(legacyManagement.feeAmount,90000);
assert.equal(legacyManagement.deadline,"2026-12-31");
assert.equal(legacyManagement.targetAmount,1000000);

const migratedOnce=canonicalizeData({
  schemaVersion:12,
  banks:[{id:"BANK",code:"BANK",name:"Bank"}],
  cards:[{id:"LEGACY",bankId:"BANK",annualFee:"750.000",activationDate:"2026-03-04"}],
  feeTargets:[]
});
assert.equal(migratedOnce.feeTargets.length,1);
assert.equal(migratedOnce.feeTargets[0].feeType,"annual_fee");
assert.equal(migratedOnce.feeTargets[0].feeAmount,750000);
assert.equal("annualFee" in migratedOnce.cards[0],false);
const migratedTwice=canonicalizeData(migratedOnce);
assert.equal(migratedTwice.feeTargets.length,1);
assert.equal(migratedTwice.feeTargets[0].feeAmount,750000);

console.log("fee-target migration tests passed");
