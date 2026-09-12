export const BUG_LAZADA_ORDER_TYPE = "BUG-LAZADA";

export function isBugLazadaTransaction(transaction){
  const values=[
    transaction?.orderTypeId,
    transaction?.orderTypeCode,
    transaction?.orderType,
    transaction?.code,
    transaction?.name
  ];
  return values.some(value=>String(value || "").trim().toUpperCase()===BUG_LAZADA_ORDER_TYPE);
}

export function isExcludedFromFinancialTotals(transaction){
  return isBugLazadaTransaction(transaction);
}

export function financialTransactions(transactions=[]){
  return transactions.filter(transaction=>!isExcludedFromFinancialTotals(transaction));
}
