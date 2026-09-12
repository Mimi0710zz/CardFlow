import assert from "node:assert/strict";
import { summarizeCardsTableRows } from "../services/card-status-summary.js";

const summary=summarizeCardsTableRows([
  {id:"A",bankIdentity:"BIDV",cardType:"credit",limitGroupId:"SHARED",groupLimit:58000000,debt:1000000,annualFee:500000},
  {id:"B",bankIdentity:"BIDV",cardType:"credit",limitGroupId:"SHARED",groupLimit:58000000,debt:2000000,annualFee:"700000"},
  {id:"C",bankIdentity:"ACB",cardType:"debit",limitGroupId:"C",groupLimit:99999999,debt:9000000,annualFee:"Chưa thiết lập"},
  {id:"D",bankIdentity:"",cardType:"credit",limitGroupId:"D",groupLimit:10000000,debt:3000000,annualFee:null}
]);

assert.deepEqual(summary,{bankCount:2,cardCount:4,totalLimit:68000000,outstanding:6000000,annualFee:1200000});
assert.deepEqual(summarizeCardsTableRows([{
  id:"A",bankIdentity:"BIDV",cardType:"credit",limitGroupId:"SHARED",groupLimit:58000000,debt:1000000,annualFee:500000
}]),{bankCount:1,cardCount:1,totalLimit:58000000,outstanding:1000000,annualFee:500000});

console.log("card-table-summary tests passed");
