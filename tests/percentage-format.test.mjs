import assert from "node:assert/strict";
import { formatPercentDisplay } from "../services/percentage.js";

assert.equal(formatPercentDisplay(2),"2,00%");
assert.equal(formatPercentDisplay(3.7),"3,70%");
assert.equal(formatPercentDisplay(3.85),"3,85%");
assert.equal(formatPercentDisplay(6),"6,00%");
assert.equal(formatPercentDisplay(null),"—");

const original=3.8576;
assert.equal(formatPercentDisplay(original),"3,86%");
assert.equal(original,3.8576);

console.log("percentage format tests passed");
