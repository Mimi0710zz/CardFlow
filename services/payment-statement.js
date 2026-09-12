import { toStorageDate } from "./date.js";
import { normalizeMoney } from "./money.js";
import { effectivePaymentDueDateForCycle, getEffectiveMonthlyDay, isValidPaymentCycle } from "./payment-due.js";

const pad2=value=>String(value).padStart(2,"0");

export function statementPaymentCycle(year,month){
  const numericYear=Number(year),numericMonth=Number(month);
  if(!Number.isInteger(numericYear)||!Number.isInteger(numericMonth)||numericMonth<1||numericMonth>12) return "";
  return `${numericYear}-${pad2(numericMonth)}`;
}

function dateToStorage(date){
  if(!(date instanceof Date)||Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;
}

export function statementPaymentRecordId(cardId,year,month){
  const cardKey=String(cardId||"").trim().toUpperCase().replace(/[^A-Z0-9-]+/g,"-").replace(/^-|-$/g,"")||"CARD";
  return `PAY-${cardKey}-${statementPaymentCycle(year,month)}`;
}

export function deriveStatementPeriod(card,year,month){
  const cycle=statementPaymentCycle(year,month);
  const statementDay=Number(card?.statementDay);
  if(!cycle||!Number.isInteger(statementDay)||statementDay<1||statementDay>31) return {cycle,startDate:"",endDate:"",label:"—"};
  const endDate=getEffectiveMonthlyDay(Number(year),Number(month),statementDay);
  const startMonthDate=new Date(Number(year),Number(month)-2,1);
  const startDate=getEffectiveMonthlyDay(startMonthDate.getFullYear(),startMonthDate.getMonth()+1,statementDay);
  const start=dateToStorage(startDate),end=dateToStorage(endDate);
  return {cycle,startDate:start,endDate:end,label:`${formatDayMonth(start)} - ${formatDayMonth(end)}`};
}

export function statementPaymentDueDate(card,year,month){
  const cycle=statementPaymentCycle(year,month);
  const dueDate=effectivePaymentDueDateForCycle(card?.paymentDueDay,cycle);
  return dateToStorage(dueDate);
}

export function formatDayMonth(value,{emptyText="—"}={}){
  const storage=toStorageDate(value);
  if(!storage) return emptyText;
  const [,month,day]=storage.split("-");
  return `${day}/${month}`;
}

export function normalizeStatementPayment(payment={},fallback={}){
  const sourceCycle=String(payment.statementCycle||payment.paymentCycle||fallback.statementCycle||"").trim();
  const cycle=isValidPaymentCycle(sourceCycle) ? sourceCycle : statementPaymentCycle(payment.statementYear??fallback.statementYear,payment.statementMonth??fallback.statementMonth);
  const [cycleYear,cycleMonth]=cycle.split("-").map(Number);
  const statementYear=Number.isInteger(Number(payment.statementYear)) ? Number(payment.statementYear) : cycleYear;
  const statementMonth=Number.isInteger(Number(payment.statementMonth)) ? Number(payment.statementMonth) : cycleMonth;
  const cardId=String(payment.cardId||fallback.cardId||"").trim();
  const statementBillAmount=normalizeMoney(payment.statementBillAmount??payment.billAmount,{emptyValue:0});
  const paidAmount=normalizeMoney(payment.paidAmount??payment.amount,{emptyValue:0});
  const paymentDate=toStorageDate(payment.paymentDate||payment.date);
  const id=payment.id||statementPaymentRecordId(cardId,statementYear,statementMonth);
  const outstandingAmount=paidAmount-statementBillAmount;
  return {
    ...payment,
    id,
    cardId,
    statementYear,
    statementMonth,
    statementCycle:statementPaymentCycle(statementYear,statementMonth),
    paymentCycle:statementPaymentCycle(statementYear,statementMonth),
    statementBillAmount,
    billAmount:statementBillAmount,
    paidAmount,
    amount:paidAmount,
    paymentDate,
    date:paymentDate,
    outstandingAmount,
    paymentStatus:payment.paymentStatus || (statementBillAmount>0&&paidAmount>=statementBillAmount ? "paid" : ""),
    note:String(payment.note||payment.notes||"")
  };
}

export function findStatementPayment(payments=[],cardId,year,month){
  const cycle=statementPaymentCycle(year,month);
  return (payments||[]).find(payment=>{
    const normalized=normalizeStatementPayment(payment);
    return String(normalized.cardId||"")===String(cardId||"")&&normalized.statementCycle===cycle;
  });
}

export function buildStatementPaymentRows(cards=[],payments=[],year,month,filters={}){
  const rows=(cards||[]).filter(card=>card.cardType!=="debit").map(card=>{
    const payment=findStatementPayment(payments,card.id,year,month);
    const normalized=normalizeStatementPayment(payment||{}, {cardId:card.id,statementYear:year,statementMonth:month});
    const period=deriveStatementPeriod(card,year,month);
    const dueDate=statementPaymentDueDate(card,year,month);
    return {
      ...normalized,
      id:payment?.id||normalized.id,
      card,
      bankId:card.bankId||"",
      period,
      statementPeriodLabel:period.label,
      statementStartDate:period.startDate,
      statementEndDate:period.endDate,
      dueDate,
      dueDateLabel:formatDayMonth(dueDate),
      outstandingAmount:normalized.paidAmount-normalized.statementBillAmount
    };
  }).filter(row=>(!filters.bankId||row.bankId===filters.bankId)&&(!filters.cardId||row.cardId===filters.cardId));
  return rows;
}

export function summarizeStatementPaymentRows(rows=[]){
  return rows.reduce((summary,row)=>({
    count:summary.count+1,
    statementBillAmount:summary.statementBillAmount+(Number(row.statementBillAmount)||0),
    paidAmount:summary.paidAmount+(Number(row.paidAmount)||0),
    outstandingAmount:summary.outstandingAmount+(Number(row.outstandingAmount)||0)
  }),{count:0,statementBillAmount:0,paidAmount:0,outstandingAmount:0});
}
