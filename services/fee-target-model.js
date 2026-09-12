import { toStorageDate } from "./date.js";

function validMoney(value){
  if(value==null||String(value).trim()==="") return null;
  const amount=Number(value);
  return Number.isFinite(amount)?amount:null;
}

export function legacyFeeAmount(target={}){
  const feeType=target.feeType==="management_fee"?"management_fee":"annual_fee";
  if(feeType==="management_fee") return validMoney(target.feeAmount??target.managementFee??target.legacyFeeAmount)??0;
  return validMoney(target.legacyFeeAmount??target.feeAmount??target.annualFee)??0;
}

export function feeAmountForTarget(target={},card){
  if(target.feeType==="management_fee") return legacyFeeAmount(target);
  return validMoney(card?.annualFee) ?? legacyFeeAmount(target);
}

export function activationDateForFeeTarget(target={},card){
  if(card) return toStorageDate(card.activationDate);
  return toStorageDate(target.activationDate||target.periodStart);
}

export function feeTargetWithCardSources(target={},card){
  const feeAmount=feeAmountForTarget(target,card);
  const activationDate=activationDateForFeeTarget(target,card);
  return {...target,feeAmount,activationDate,periodStart:activationDate||target.periodStart||target.legacyActivationDate||""};
}
