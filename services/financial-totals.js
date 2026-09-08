export function isExcludedFromFinancialTotals(transaction){
  return String(transaction?.orderType || "").trim().toUpperCase()==="BUG-LAZADA";
}

export function financialTransactions(transactions=[]){
  return transactions.filter(transaction=>!isExcludedFromFinancialTotals(transaction));
}
