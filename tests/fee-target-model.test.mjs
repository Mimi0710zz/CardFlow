import assert from "node:assert/strict";
import { activationDateForFeeTarget, feeAmountForTarget, feeTargetWithCardSources, legacyFeeAmount, summarizeFeeTargets } from "../services/fee-target-model.js";

const card={id:"CAKE",activationDate:"2026-02-03"};
assert.equal(feeAmountForTarget({feeType:"annual_fee",feeAmount:300000,annualFee:300000},card),300000);
assert.equal(feeAmountForTarget({feeType:"annual_fee",feeAmount:450000,legacyFeeAmount:300000},card),450000);
assert.equal(feeAmountForTarget({feeType:"management_fee",feeAmount:120000,managementFee:120000},card),120000);
assert.equal(legacyFeeAmount({feeType:"management_fee",managementFee:90000}),90000);
assert.equal(legacyFeeAmount({feeType:"management_fee",feeAmount:140000,legacyFeeAmount:90000}),140000);
assert.equal(activationDateForFeeTarget({activationDate:"2025-01-01"},card),"2026-02-03");
assert.equal(activationDateForFeeTarget({activationDate:"2025-01-01"},undefined),"2025-01-01");
assert.deepEqual(
  feeTargetWithCardSources({feeType:"annual_fee",feeAmount:300000,activationDate:"2025-01-01",periodStart:"2025-01-01"},card),
  {feeType:"annual_fee",feeAmount:300000,activationDate:"2026-02-03",periodStart:"2026-02-03"}
);

const fees=[
  {id:"A",cardId:"A",feeType:"annual_fee",feeAmount:599000,targetAmount:5000000},
  {id:"B",cardId:"B",feeType:"annual_fee",feeAmount:1499000,targetAmount:10000000},
  {id:"C",cardId:"C",feeType:"management_fee",feeAmount:120000,targetAmount:2000000}
];
assert.deepEqual(summarizeFeeTargets(fees),{feeAmount:2218000,targetAmount:17000000});
assert.deepEqual(summarizeFeeTargets(fees.filter(item=>item.cardId==="A")),{feeAmount:599000,targetAmount:5000000});
assert.deepEqual(summarizeFeeTargets([]),{feeAmount:0,targetAmount:0});
assert.deepEqual(summarizeFeeTargets(fees.map(item=>item.id==="A"?{...item,feeAmount:699000}:item)),{feeAmount:2318000,targetAmount:17000000});
assert.deepEqual(summarizeFeeTargets(fees.filter(item=>item.id!=="B")),{feeAmount:719000,targetAmount:7000000});

console.log("fee-target-model tests passed");
