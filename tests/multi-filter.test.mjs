import assert from "node:assert/strict";
import {
  activeFilterValueCount,
  clearFilterState,
  cloneFilterState,
  matchesMultiFilter,
  selectAllState,
  toFilterSet,
  toggleAllFilterValues
} from "../services/multi-filter.js";

assert.deepEqual([...toFilterSet("")],[]);
const arraySource=["MB","TECH"],arraySet=toFilterSet(arraySource);
assert.deepEqual([...arraySet],["MB","TECH"]);
arraySource.push("ACB");
assert.deepEqual([...arraySet],["MB","TECH"]);
const sourceSet=new Set(["sent_bill"]),setClone=toFilterSet(sourceSet);
assert.notEqual(setClone,sourceSet);
assert.deepEqual([...setClone],["sent_bill"]);

assert.equal(matchesMultiFilter("MB",new Set(["MB"])),true);
assert.equal(matchesMultiFilter("TECH",new Set(["MB","TECH"])),true);
assert.equal(matchesMultiFilter("ACB",new Set(["MB","TECH"])),false);
assert.equal(matchesMultiFilter("anything",new Set()),true);
const rows=[
  {bank:"MB",status:"sent_bill"},
  {bank:"TECH",status:"host_back"},
  {bank:"ACB",status:"sent_bill"}
];
assert.deepEqual(rows.filter(row=>matchesMultiFilter(row.bank,new Set(["MB","TECH"]))&&matchesMultiFilter(row.status,new Set(["sent_bill"]))),[rows[0]]);

const state={bankId:new Set(["MB"]),status:new Set(["sent_bill","host_back"]),dateFrom:"2026-09-01",dateTo:"",actionable:true};
const cloned=cloneFilterState(state);
assert.notEqual(cloned.bankId,state.bankId);
cloned.bankId.add("TECH");
assert.deepEqual([...state.bankId],["MB"]);
assert.deepEqual(clearFilterState(state),{bankId:new Set(),status:new Set(),dateFrom:"",dateTo:"",actionable:false});
assert.equal(activeFilterValueCount(state),5);
assert.equal(activeFilterValueCount({bankId:new Set(["REMOVED"])}),1);
assert.deepEqual(clearFilterState({bankId:new Set(["REMOVED"])}),{bankId:new Set()});

const options=[{value:"MB",label:"MB"},{value:"TECH",label:"Techcombank"}];
assert.deepEqual(selectAllState([],new Set()),{checked:false,indeterminate:false});
assert.deepEqual(selectAllState(options,new Set()),{checked:false,indeterminate:false});
assert.deepEqual(selectAllState(options,new Set(["MB"])),{checked:false,indeterminate:true});
assert.deepEqual(selectAllState(options,new Set(["MB","TECH"])),{checked:true,indeterminate:false});
assert.deepEqual([...toggleAllFilterValues(options,true)],["MB","TECH"]);
assert.deepEqual([...toggleAllFilterValues(options,false)],[]);
assert.equal(toggleAllFilterValues([{value:"all",label:"Tất cả"},...options],true).has("all"),false);

console.log("multi-filter tests passed");
