import assert from "node:assert/strict";
import {
  MB_PLATINUM_CARD_ID,
  MB_PLATINUM_PACKAGE_IDS,
  MB_PLATINUM_PACKAGE_LABELS,
  isMbPlatinumCard,
  mbPlatinumPackageLabel,
  normalizeMbPlatinumCardConfig
} from "../services/mb-platinum-cashback.js";

const card={id:"MB Pla",cashbackCycle:"statement",statementDay:20};

assert.equal(MB_PLATINUM_CARD_ID,"MB Pla");
assert.deepEqual(MB_PLATINUM_PACKAGE_IDS,["DAILY","LIFESTYLE"]);
assert.deepEqual(MB_PLATINUM_PACKAGE_LABELS,{DAILY:"Hàng ngày",LIFESTYLE:"Phong cách sống"});
assert.equal(isMbPlatinumCard("MB Pla"),true);
assert.equal(isMbPlatinumCard("MB Platinum"),false);
assert.equal(mbPlatinumPackageLabel("DAILY"),"Hàng ngày");
assert.equal(mbPlatinumPackageLabel("UNKNOWN"),"UNKNOWN");

assert.deepEqual(normalizeMbPlatinumCardConfig({},card,{referenceDate:"2026-09-12"}),{
  cardId:"MB Pla",
  statementMinSpend:5000000,
  rotationAnchorPeriodKey:"statement:2026-08-21:2026-09-20",
  rotationAnchorPrimaryPackageId:"LIFESTYLE"
});

assert.deepEqual(normalizeMbPlatinumCardConfig({
  cardId:"MB Pla",
  statementMinSpend:"6.000.000",
  rotationAnchorPeriodKey:"statement:2026-09-21:2026-10-20",
  rotationAnchorPrimaryPackageId:"DAILY",
  legacyNote:"keep"
},card,{referenceDate:"2026-09-12"}),{
  cardId:"MB Pla",
  statementMinSpend:6000000,
  rotationAnchorPeriodKey:"statement:2026-09-21:2026-10-20",
  rotationAnchorPrimaryPackageId:"DAILY",
  legacyNote:"keep"
});

console.log("MB Platinum cashback config tests passed");
