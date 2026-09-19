import { isDateInCashbackPeriod } from "./cashback-period.js";

export function cashbackTransactions(transactions=[]){
  return Array.isArray(transactions) ? transactions : [];
}

export function cashbackTransactionsForCardPeriod(transactions=[],cardId,period){
  return cashbackTransactions(transactions).filter(transaction=>
    transaction.cardId===cardId&&isDateInCashbackPeriod(transaction.date,period)
  );
}
export function summarizeCashbackReceipts(receipts=[]){
  const rows=Array.isArray(receipts)?receipts:[];
  const cardIds=new Set(rows.map(receipt=>String(receipt?.cardId||"").trim()).filter(Boolean));
  const totalCashback=rows.reduce((total,receipt)=>total+(Number(receipt?.amount)||0),0);
  return {cardCount:cardIds.size,totalCashback};
}

