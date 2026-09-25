import {toStorageDate} from "./date.js";

const text=value=>String(value??"").trim();

export function trackingCashbackReceiptKey(value={}){
  return [text(value.cardId),text(value.programId),text(value.periodType).toUpperCase(),text(value.periodKey)].join("|");
}

export function normalizeTrackingCashbackReceipt(value={}){
  const received=value.received===true;
  return {cardId:text(value.cardId),programId:text(value.programId),periodType:text(value.periodType).toUpperCase()==="STATEMENT"?"STATEMENT":"MONTH",periodKey:text(value.periodKey),received,receivedDate:received?toStorageDate(value.receivedDate):""};
}

export function normalizeTrackingCashbackReceipts(values=[]){
  const byKey=new Map();
  (Array.isArray(values)?values:[]).forEach(value=>{const normalized=normalizeTrackingCashbackReceipt(value),key=trackingCashbackReceiptKey(normalized);if(normalized.cardId&&normalized.programId&&normalized.periodKey)byKey.set(key,normalized);});
  return [...byKey.values()];
}

export function upsertTrackingCashbackReceipt(values=[],value={}){
  const normalized=normalizeTrackingCashbackReceipt(value),key=trackingCashbackReceiptKey(normalized),next=normalizeTrackingCashbackReceipts(values),index=next.findIndex(item=>trackingCashbackReceiptKey(item)===key);
  if(index<0)next.push(normalized);else next[index]=normalized;
  return next;
}
