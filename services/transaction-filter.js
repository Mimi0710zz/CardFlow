import { transactionStatusForTransaction } from "./transaction-status.js?v=20260916-transaction-tabs-v1";
import { matchesMultiFilter } from "./multi-filter.js";

export function matchesTransactionFilters(transaction, filters = {}, resolveHostName = value => value){
  return matchesMultiFilter(transaction.cardId,filters.cardId) &&
    matchesMultiFilter(transaction.orderType,filters.category) &&
    matchesMultiFilter(resolveHostName(transaction.host),filters.host) &&
    matchesMultiFilter(transaction.channel,filters.channel) &&
    matchesMultiFilter(transactionStatusForTransaction(transaction),filters.status) &&
    matchesMultiFilter(String(transaction.mcc),filters.mcc) &&
    (!filters.dateFrom || transaction.date >= filters.dateFrom) &&
    (!filters.dateTo || transaction.date <= filters.dateTo);
}
