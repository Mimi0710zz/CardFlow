import { isCardFeeTransaction } from "./order-type.js";
import { TRANSACTION_STATUS, isHostFeeApplicable, normalizeTransactionStatus } from "./transaction-status.js";

function hasRecordedBackAmount(transaction){
  return (Number(transaction?.backAmount) || 0) !== 0;
}

function hasRecordedSentBillStatus(transaction){
  const rawStatus=String(transaction?.status || "").trim();
  return rawStatus !== "" && normalizeTransactionStatus(rawStatus)===TRANSACTION_STATUS.SENT_BILL;
}

export function isDashboardHostBackTransaction(transaction){
  return !isCardFeeTransaction(transaction) && isHostFeeApplicable(transaction);
}

export function isDashboardWaitingHostBackTransaction(transaction){
  return isDashboardHostBackTransaction(transaction) &&
    hasRecordedSentBillStatus(transaction) &&
    !hasRecordedBackAmount(transaction);
}

export function calculateDashboardHostBackMetrics(transactions=[]){
  const hostBackRows=transactions.filter(isDashboardHostBackTransaction);
  const waitingRows=hostBackRows.filter(isDashboardWaitingHostBackTransaction);
  return {
    hostBackRows,
    waitingRows,
    hostBack:hostBackRows.reduce((total,transaction)=>total+(Number(transaction.backAmount)||0),0),
    waiting:waitingRows.reduce((total,transaction)=>total+(Number(transaction.amount)||0),0),
    waitingCount:waitingRows.length
  };
}
