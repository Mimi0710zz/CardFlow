import assert from "node:assert/strict";
import {evaluateCashbackProgram} from "../services/cashback-evaluation.js";
import {exportCashbackProgramRows,importCashbackProgramRows} from "../services/cashback-program-excel.js";
import {buildTrackingMatrix} from "../services/tracking-matrix-engine.js";
import {formatMoneyInput,parseMoney} from "../services/money.js";

assert.equal(formatMoneyInput("10000000",{allowEmpty:true}),"10.000.000");
assert.equal(parseMoney("10.000.000"),10000000);
assert.equal(formatMoneyInput("",{allowEmpty:true}),"");
assert.equal(parseMoney("0",{emptyValue:null}),0);

const card={id:"CARD",bankId:"BANK",cashbackCycle:"monthly"};
const condition={id:"NO-CB",name:"Doanh sá»‘ chá»‰ tiÃªu",rate:.99,max:999999,maxType:"NO_CASHBACK",allMcc:true,eligibleSpendMinimum:1000000};
const program={id:"PROGRAM",cardId:"CARD",name:"Program",year:2026,month:9,conditions:[condition]};
const transaction={id:"TX",cardId:"CARD",date:"2026-09-10",amount:1000000,status:"TiÃªu cÃ¡ nhÃ¢n"};
const result=evaluateCashbackProgram(program,[transaction],card,{referenceDate:"2026-09-15"});
assert.equal(result.conditions[0].eligibleSpend,1000000);
assert.equal(result.conditions[0].eligibleSatisfied,true);
assert.equal(result.conditions[0].finalCashback,0);

const configs=[{cardId:"CARD",calculationMode:"supporting",totalSpendRequirement:{enabled:true,amount:9000000}}];
const rows=exportCashbackProgramRows([program],{cards:[card],cardCashbackConfigs:configs});
assert.equal(rows[0]["Limit Type"],"NO_CASHBACK");
assert.equal(rows[0]["Card Calculation Mode"],"supporting");
assert.equal(rows[0]["Card Total Spend"],9000000);
const imported=importCashbackProgramRows(rows,{cards:[card]});
assert.equal(imported[0].conditions[0].maxType,"NO_CASHBACK");
assert.deepEqual(imported.cardCashbackConfigs,configs);

const tracking=buildTrackingMatrix({banks:[{id:"BANK",name:"Bank"}],cards:[card],cashbackPrograms:[{...program,name:"Ä‚n uá»‘ng",conditions:[{...condition,id:"FOOD",name:"Ä‚n uá»‘ng"},{...condition,id:"FOOD",name:"Ä‚n uá»‘ng"}]}],transactions:[transaction]},{year:2026,month:9,referenceDate:"2026-09-15"});
assert.equal(tracking.rows.length,1);
assert.equal(tracking.rows[0].program.name,"Ä‚n uá»‘ng");

console.log("cashback enhancements tests passed");
