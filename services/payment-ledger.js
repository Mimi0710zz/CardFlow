import { toStorageDate } from "./date.js";
import { normalizeMoney } from "./money.js";
import { getStatementCycleForTransaction, isValidPaymentCycle } from "./payment-due.js";
import { normalizeStatementPayment } from "./payment-statement.js";
import { financialTransactions } from "./financial-totals.js";
import { CASHBACK_RECEIPT_DESTINATION, normalizeCashbackReceiptDestination } from "./cashback-receipt-destination.js";

export const PAYMENT_TRANSACTION_TYPE = Object.freeze({
  STATEMENT: "statement",
  PREPAYMENT: "prepayment",
  EXCESS: "excess"
});

export function paymentTransactionTypeLabel(value){
  if(value===PAYMENT_TRANSACTION_TYPE.STATEMENT) return "Thanh toán sao kê";
  if(value===PAYMENT_TRANSACTION_TYPE.EXCESS) return "Nộp dư";
  return "Thanh toán trước";
}

export function paymentTransactionRecordId(){
  return `PAYTX-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
}

export function normalizePaymentTransaction(transaction={}){
  return {
    ...transaction,
    id:String(transaction.id||paymentTransactionRecordId()),
    cardId:String(transaction.cardId||"").trim(),
    date:toStorageDate(transaction.date||transaction.paymentDate),
    amount:normalizeMoney(transaction.amount??transaction.paidAmount,{emptyValue:0}),
    statementCycle:isValidPaymentCycle(transaction.statementCycle||transaction.paymentCycle)?String(transaction.statementCycle||transaction.paymentCycle):"",
    type:Object.values(PAYMENT_TRANSACTION_TYPE).includes(transaction.type)?transaction.type:PAYMENT_TRANSACTION_TYPE.PREPAYMENT,
    note:String(transaction.note??transaction.notes??"")
  };
}

export function paymentAmountForCycle(paymentTransactions=[],cardId="",cycle=""){
  return (paymentTransactions||[]).map(normalizePaymentTransaction).reduce((total,item)=>total+(item.cardId===cardId&&item.statementCycle===cycle?(Number(item.amount)||0):0),0);
}

export function latestPaymentDateForCycle(paymentTransactions=[],cardId="",cycle=""){
  return (paymentTransactions||[]).map(normalizePaymentTransaction).filter(item=>item.cardId===cardId&&item.statementCycle===cycle&&item.date).sort((a,b)=>b.date.localeCompare(a.date))[0]?.date||"";
}

export function resolvePaymentTransactionCycle({card,payments=[],paymentTransactions=[],date}={}){
  if(!card?.id) return "";
  const statements=(payments||[]).map(payment=>normalizeStatementPayment(payment)).filter(payment=>payment.cardId===card.id&&payment.billRecorded&&isValidPaymentCycle(payment.statementCycle)).sort((a,b)=>a.statementCycle.localeCompare(b.statementCycle));
  for(const statement of statements){
    const paid=paymentAmountForCycle(paymentTransactions,card.id,statement.statementCycle);
    if((Number(statement.statementBillAmount)||0)-paid>0) return statement.statementCycle;
  }
  const cycleInfo=getStatementCycleForTransaction(date,Number(card.statementDay));
  return cycleInfo?.cycle||"";
}

export function classifyPaymentTransaction({card,currentDebt=0,amount=0,statementCycle="",payments=[],paymentTransactions=[]}={}){
  const statement=(payments||[]).map(payment=>normalizeStatementPayment(payment)).find(payment=>payment.cardId===card?.id&&payment.statementCycle===statementCycle&&payment.billRecorded);
  if(statement){
    const alreadyPaid=paymentAmountForCycle(paymentTransactions,card.id,statementCycle);
    if((Number(statement.statementBillAmount)||0)-alreadyPaid>0) return PAYMENT_TRANSACTION_TYPE.STATEMENT;
  }
  return Number(amount)>Math.max(0,Number(currentDebt)||0) ? PAYMENT_TRANSACTION_TYPE.EXCESS : PAYMENT_TRANSACTION_TYPE.PREPAYMENT;
}

export function buildPaymentHistoryRows({cards=[],transactions=[],paymentTransactions=[],cashbackReceipts=[]}={}){
  const cardMap=new Map((cards||[]).map(card=>[String(card.id||""),card]));
  const txByCard=new Map();
  financialTransactions(transactions).forEach(transaction=>{
    const id=String(transaction.cardId||"");
    if(!txByCard.has(id)) txByCard.set(id,[]);
    txByCard.get(id).push({date:toStorageDate(transaction.date),amount:Number(transaction.amount)||0,id:String(transaction.id||"")});
  });
  const cbByCard=new Map();
  (cashbackReceipts||[]).forEach(receipt=>{
    if(normalizeCashbackReceiptDestination(receipt.destination,{legacy:true})!==CASHBACK_RECEIPT_DESTINATION.CREDIT_LIMIT) return;
    const id=String(receipt.cardId||"");
    if(!cbByCard.has(id)) cbByCard.set(id,[]);
    cbByCard.get(id).push({date:toStorageDate(receipt.date),amount:Number(receipt.amount)||0,id:String(receipt.id||"")});
  });

  const rows=[];
  const grouped=new Map();
  (paymentTransactions||[]).map(normalizePaymentTransaction).forEach(item=>{
    if(!grouped.has(item.cardId)) grouped.set(item.cardId,[]);
    grouped.get(item.cardId).push(item);
  });
  grouped.forEach((items,cardId)=>{
    const card=cardMap.get(cardId);
    const spendEvents=(txByCard.get(cardId)||[]).filter(item=>item.date).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
    const cashbackEvents=(cbByCard.get(cardId)||[]).filter(item=>item.date).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
    const sorted=[...items].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
    sorted.forEach((item,index)=>{
      const priorPayments=sorted.slice(0,index).reduce((sum,p)=>sum+(Number(p.amount)||0),0);
      const spentToDate=spendEvents.filter(event=>event.date<=item.date).reduce((sum,event)=>sum+event.amount,0);
      const cashbackToDate=cashbackEvents.filter(event=>event.date<=item.date).reduce((sum,event)=>sum+event.amount,0);
      const netBefore=spentToDate-priorPayments-cashbackToDate;
      const debtBefore=Math.max(0,netBefore);
      const creditBefore=Math.max(0,-netBefore);
      const netAfter=netBefore-(Number(item.amount)||0);
      rows.push({...item,card,debtBefore,creditBefore,debtAfter:Math.max(0,netAfter),creditAfter:Math.max(0,-netAfter)});
    });
  });
  return rows.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}
