import { normalizeTransactionStatus } from "./transaction-status.js?v=20260906-order-types-transaction-v1";

export function matchesTransactionFilters(transaction, filters = {}, resolveHostName = value => value){
  return (!filters.cardId || transaction.cardId === filters.cardId) &&
    (!filters.category || transaction.orderType === filters.category) &&
    (!filters.host || resolveHostName(transaction.host) === filters.host) &&
    (!filters.channel || transaction.channel === filters.channel) &&
    (!filters.status || normalizeTransactionStatus(transaction.status) === filters.status) &&
    (!filters.mcc || String(transaction.mcc) === String(filters.mcc)) &&
    (!filters.dateFrom || transaction.date >= filters.dateFrom) &&
    (!filters.dateTo || transaction.date <= filters.dateTo);
}
