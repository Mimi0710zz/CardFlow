const TIME_PATTERN=/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

function pad2(value){
  return String(value).padStart(2,"0");
}

export const LEGACY_TRANSACTION_TIME="00:00:00";

export function currentTransactionTime(now=new Date()){
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}

export function normalizeTransactionTime(value,{fallback=LEGACY_TRANSACTION_TIME}={}){
  const text=String(value ?? "").trim();
  const match=text.match(TIME_PATTERN);
  if(!match) return fallback;
  return `${match[1]}:${match[2]}:${match[3] || "00"}`;
}

export function isValidTransactionTime(value){
  return normalizeTransactionTime(value,{fallback:""}) !== "";
}

export function resolveTransactionTimeForSave(value,existing={}){
  return normalizeTransactionTime(value,{fallback:normalizeTransactionTime(existing.transactionTime)});
}

export function compareTransactionsNewestFirst(left={},right={}){
  return String(right.date || "").localeCompare(String(left.date || "")) ||
    normalizeTransactionTime(right.transactionTime).localeCompare(normalizeTransactionTime(left.transactionTime)) ||
    String(right.id || "").localeCompare(String(left.id || ""));
}
