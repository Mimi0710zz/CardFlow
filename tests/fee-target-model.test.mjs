import assert from "node:assert/strict";
import { activationDateForFeeTarget, feeAmountForTarget, feeTargetWithCardSources, legacyFeeAmount } from "../services/fee-target-model.js";

const card={id:"CAKE",annualFee:500000,activationDate:"2026-02-03"};
assert.equal(feeAmountForTarget({feeType:"annual_fee",feeAmount:300000,annualFee:300000},card),500000);
assert.equal(feeAmountForTarget({feeType:"management_fee",feeAmount:120000,managementFee:120000},card),120000);
assert.equal(legacyFeeAmount({feeType:"management_fee",managementFee:90000}),90000);
assert.equal(legacyFeeAmount({feeType:"management_fee",feeAmount:140000,legacyFeeAmount:90000}),140000);
assert.equal(activationDateForFeeTarget({activationDate:"2025-01-01"},card),"2026-02-03");
assert.equal(activationDateForFeeTarget({activationDate:"2025-01-01"},undefined),"2025-01-01");
assert.deepEqual(
  feeTargetWithCardSources({feeType:"annual_fee",feeAmount:300000,activationDate:"2025-01-01",periodStart:"2025-01-01"},card),
  {feeType:"annual_fee",feeAmount:500000,activationDate:"2026-02-03",periodStart:"2026-02-03"}
);

console.log("fee-target-model tests passed");
