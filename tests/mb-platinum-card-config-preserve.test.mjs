import assert from "node:assert/strict";
import {upsertCardCashbackConfig} from "../services/cashback-card-config.js";

const existing=[{cardId:"MB Pla",statementMinSpend:5000000,rotationAnchorPeriodKey:"statement:2026-08-21:2026-09-20",rotationAnchorPrimaryPackageId:"LIFESTYLE",calculationMode:"independent",totalSpendRequirement:{enabled:true,amount:5000000}}];
const next=upsertCardCashbackConfig(existing,{cardId:"MB Pla",calculationMode:"supporting",totalSpendRequirement:{enabled:true,amount:6000000}})[0];
assert.equal(next.statementMinSpend,5000000);
assert.equal(next.rotationAnchorPeriodKey,"statement:2026-08-21:2026-09-20");
assert.equal(next.rotationAnchorPrimaryPackageId,"LIFESTYLE");
assert.equal(next.calculationMode,"supporting");
assert.equal(next.totalSpendRequirement.amount,6000000);
console.log("MB Platinum card config preservation tests passed");
