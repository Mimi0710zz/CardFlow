import assert from "node:assert/strict";
import fs from "node:fs";
import {activeFilterValueCount,matchesMultiFilter} from "../services/multi-filter.js";

const filters={card:new Set(["MB Pla","TECH Every"]),brand:new Set(["VISA","MASTER"]),program:new Set(["P1"]),status:new Set(["AVAILABLE","IN_PROGRESS"]),actionable:true};
const rows=[
  {card:"MB Pla",brand:"VISA",program:"P1",status:"AVAILABLE"},
  {card:"TECH Every",brand:"MASTER",program:"P1",status:"IN_PROGRESS"},
  {card:"ACB",brand:"VISA",program:"P1",status:"AVAILABLE"},
  {card:"MB Pla",brand:"VISA",program:"P2",status:"AVAILABLE"},
  {card:"MB Pla",brand:"VISA",program:"P1",status:"COMPLETED"}
];
const matches=row=>matchesMultiFilter(row.card,filters.card)&&matchesMultiFilter(row.brand,filters.brand)&&matchesMultiFilter(row.program,filters.program)&&matchesMultiFilter(row.status,filters.status)&&(!filters.actionable||["AVAILABLE","IN_PROGRESS"].includes(row.status));
assert.deepEqual(rows.filter(matches),rows.slice(0,2));
assert.equal(activeFilterValueCount(filters),8);

const source=fs.readFileSync(new URL("../services/tracking-matrix-ui.js",import.meta.url),"utf8");
assert.match(source,/card:new Set\(\),brand:new Set\(\),program:new Set\(\),status:new Set\(\),actionable:false/);
assert.match(source,/renderMultiFilterGroup\(/);
assert.match(source,/readMultiFilterDraft\(/);
assert.match(source,/wireMultiFilterGroups\(/);
assert.match(source,/activeFilterValueCount\(filters\)/);
assert.match(source,/clearFilterState\(filters\)/);
assert.doesNotMatch(source,/<select data-draft=/);

console.log("tracking multi-filter UI tests passed");
