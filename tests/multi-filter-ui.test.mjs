import assert from "node:assert/strict";
import fs from "node:fs";
import {renderMultiFilterGroup} from "../services/multi-filter-ui.js";

const escape=value=>String(value).replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;");
const options=[
  {value:"TECH",label:"Techcombank"},
  {value:"MB",label:"MB"},
  {value:"all",label:"Pseudo all"}
];
const html=renderMultiFilterGroup({key:"bankId",label:"Ngân hàng",options,selectedValues:new Set(["MB"]),escape});
assert.match(html,/class="multi-filter-group"/);
assert.match(html,/data-multi-filter-key="bankId"/);
assert.match(html,/<button[^>]*data-multi-filter-trigger[^>]*aria-expanded="false"/);
assert.match(html,/data-multi-filter-all/);
assert.match(html,/>Tất cả</);
assert.match(html,/<label[^>]*class="multi-filter-option"[^>]*>\s*<input[^>]*type="checkbox"[^>]*value="MB"[^>]*checked/);
assert.ok(html.indexOf("Techcombank")<html.indexOf(">MB<"),"renderer must preserve caller option order");
assert.equal((html.match(/Pseudo all/g)||[]).length,0);
assert.equal((html.match(/data-multi-filter-option/g)||[]).length,2);
assert.doesNotMatch(html,/indeterminate=/);

const empty=renderMultiFilterGroup({key:"status",label:"Trạng thái",options:[],selectedValues:new Set(),escape});
assert.match(empty,/data-multi-filter-all[^>]*disabled/);
assert.match(empty,/Không có lựa chọn/);

const source=fs.readFileSync(new URL("../services/multi-filter-ui.js",import.meta.url),"utf8");
assert.match(source,/all\.indeterminate=state\.indeterminate/);
assert.match(source,/function wireMultiFilterGroups/);
assert.doesNotMatch(source,/renderAll\(/);

console.log("multi-filter UI tests passed");
