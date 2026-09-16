import { TRANSACTION_STATUS, transactionStatusForTransaction } from "./transaction-status.js?v=20260916-transaction-tabs-v1";

export function isPersonalUseTransaction(transaction){
  return transactionStatusForTransaction(transaction) === TRANSACTION_STATUS.PERSONAL_USE;
}

export function orderTransactions(transactions=[]){
  return transactions.filter(transaction=>!isPersonalUseTransaction(transaction));
}

export function personalUseTransactions(transactions=[]){
  return transactions.filter(isPersonalUseTransaction);
}

export function transactionAmountTotal(transactions=[]){
  return transactions.reduce((total,transaction)=>total+(Number(transaction?.amount)||0),0);
}

export function replaceTransactionById(transactions=[],id,nextTransaction){
  const index=transactions.findIndex(transaction=>transaction.id===id);
  if(index<0) return false;
  transactions[index]=nextTransaction;
  return true;
}
