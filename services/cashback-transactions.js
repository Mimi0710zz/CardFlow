import { isDateInCashbackPeriod } from "./cashback-period.js";

export function cashbackTransactions(transactions=[]){
  return Array.isArray(transactions) ? transactions : [];
}

export function cashbackTransactionsForCardPeriod(transactions=[],cardId,period){
  return cashbackTransactions(transactions).filter(transaction=>
    transaction.cardId===cardId&&isDateInCashbackPeriod(transaction.date,period)
  );
}
