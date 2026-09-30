import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");

assert.match(app,/from "\.\/services\/multi-filter\.js/);
assert.match(app,/from "\.\/services\/multi-filter-ui\.js/);
assert.match(app,/const cardFilters = \{bankId:new Set\(\),cardType:new Set\(\),network:new Set\(\),cardForm:new Set\(\)\}/);
assert.match(app,/const transactionFilters = \{cardId:new Set\(\),category:new Set\(\),host:new Set\(\),channel:new Set\(\),status:new Set\(\),mcc:new Set\(\),dateFrom:"",dateTo:""\}/);
assert.match(app,/const personalTransactionFilters = \{cardId:new Set\(\),category:new Set\(\),mcc:new Set\(\),dateFrom:"",dateTo:""\}/);
assert.match(app,/const feeTargetFilters=\{bankId:new Set\(\),cardId:new Set\(\),feeType:new Set\(\)\}/);
assert.match(app,/const paymentFilters=\{bankId:new Set\(\),cardId:new Set\(\),status:new Set\(\)\}/);
assert.match(app,/renderMultiFilterGroup\(/);
assert.match(app,/activeFilterValueCount\(/);
assert.match(app,/readMultiFilterDraft\(/);
assert.match(app,/clearFilterState\(/);
assert.match(app,/wireMultiFilterGroups\(/);
assert.match(app,/matchesMultiFilter\(card\.bankId,cardFilters\.bankId\)/);
assert.doesNotMatch(app,/<select data-card-filter=/);
assert.doesNotMatch(app,/<select data-fee-target-filter=/);
assert.doesNotMatch(app,/<select data-payment-filter=/);
assert.match(app,/Xóa bộ lọc/);

console.log("multi-filter app UI tests passed");
