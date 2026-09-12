import assert from "node:assert/strict";
import { getCashbackPeriodForCard, isDateInCashbackPeriod } from "../services/cashback-period.js";
import { buildTrackingMatrix } from "../services/tracking-matrix-engine.js";

const statement={cashbackCycle:"statement",statementDay:20};
assert.deepEqual(getCashbackPeriodForCard(statement,"2026-09-12"),{type:"statement",startDate:"2026-08-21",endDate:"2026-09-20"});
assert.deepEqual(getCashbackPeriodForCard(statement,"2026-09-20"),{type:"statement",startDate:"2026-08-21",endDate:"2026-09-20"});
assert.deepEqual(getCashbackPeriodForCard(statement,"2026-09-21"),{type:"statement",startDate:"2026-09-21",endDate:"2026-10-20"});
assert.deepEqual(getCashbackPeriodForCard({cashbackCycle:"monthly"},"2026-09-12"),{type:"monthly",startDate:"2026-09-01",endDate:"2026-09-30"});
assert.deepEqual(getCashbackPeriodForCard({cashbackCycle:"statement",statementDay:31},"2026-02-28"),{type:"statement",startDate:"2026-02-01",endDate:"2026-02-28"});
assert.equal(getCashbackPeriodForCard({cashbackCycle:"statement"},"2026-09-12").type,"monthly");

const cards=[
  {id:"MONTHLY",bankId:"B",cashbackCycle:"monthly"},
  {id:"CAKE-SIG",bankId:"B",cashbackCycle:"statement",statementDay:20}
];
const program=cardId=>({id:`P-${cardId}`,name:"Target",cardId,year:2026,month:9,combineOperator:"AND",conditions:[{allMcc:true,rate:1,max:200000,eligibleTarget:20000000}],totalSpendCondition:{enabled:true,amount:20000000}});
const transactions=[
  ...[24,25,26,27].map(day=>({id:`S${day}`,cardId:"CAKE-SIG",date:`2026-08-${day}`,amount:5000000,channel:"online",host:"H"})),
  {id:"M-AUG",cardId:"MONTHLY",date:"2026-08-25",amount:20000000,channel:"online",host:"H"}
];
const state={cards,banks:[{id:"B",name:"Bank"}],hosts:[{id:"H",name:"Host"}],mccCategories:[],transactions,cashbackPrograms:cards.map(card=>program(card.id))};
const septemberReference=getCashbackPeriodForCard(cards[1],"2026-09-12");
assert.equal(transactions.filter(tx=>tx.cardId==="CAKE-SIG"&&isDateInCashbackPeriod(tx.date,septemberReference)).reduce((sum,tx)=>sum+tx.amount,0),20000000);
const matrix=buildTrackingMatrix(state,{year:2026,month:9,referenceDate:"2026-09-12"});
assert.equal(matrix.rows.find(row=>row.card.id==="MONTHLY").cells[0].status,"AVAILABLE");
assert.equal(matrix.rows.find(row=>row.card.id==="CAKE-SIG").cells[0].status,"COMPLETED");
const nextCycle=buildTrackingMatrix(state,{year:2026,month:9,referenceDate:"2026-09-21"});
assert.equal(nextCycle.rows.find(row=>row.card.id==="CAKE-SIG").cells[0].status,"AVAILABLE");

console.log("cashback-period tests passed");
