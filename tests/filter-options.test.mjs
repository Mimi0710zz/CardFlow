import assert from "node:assert/strict";
import { sortedUniqueFilterOptions } from "../services/filter-options.js";

assert.deepEqual(
  sortedUniqueFilterOptions(["20","3","1","10","2","3",""]),
  ["1","2","3","10","20"].map(value=>({value,label:value}))
);

const banks=[
  {id:"T",name:"Techcombank"},{id:"B",name:"BIDV"},{id:"A",name:"ACB"},
  {id:"C",name:"Cake"},{id:"B",name:"BIDV duplicate"}
];
assert.deepEqual(
  sortedUniqueFilterOptions(banks,bank=>bank.id,bank=>bank.name),
  [{value:"A",label:"ACB"},{value:"B",label:"BIDV"},{value:"C",label:"Cake"},{value:"T",label:"Techcombank"}]
);

console.log("filter-options tests passed");
