import { toStorageDate } from "./date.js";

function validMoney(value){
  if(value==null||String(value).trim()==="") return null;
  const amount=Number(value);
  return Number.isFinite(amount)?amount:null;
}

export function legacyFeeAmount(target={}){
  const feeType=target.feeType==="management_fee"?"management_fee":"annual_fee";
  if(feeType==="management_fee") return validMoney(target.feeAmount??target.managementFee??target.legacyFeeAmount)??0;
  return validMoney(target.feeAmount??target.annualFee??target.legacyFeeAmount)??0;
}

export function feeAmountForTarget(target={},card){
  return legacyFeeAmount(target);
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

export function actualFeeAmountForTarget(target={}){
  const feeAmount=Number(target.feeAmount);
  return target.achieved===true?0:Math.max(0,Number.isFinite(feeAmount)?feeAmount:0);
}

export function feeTargetYear(target={}){
  const date=toStorageDate(target.deadline||target.periodEnd||target.cutoffDate);
  return date?date.slice(0,4):"";
}

export function summarizeFeeTargets(targets=[]){
  return targets.reduce((summary,target)=>{
    const feeAmount=Number(target.feeAmount),actualFeeAmount=Number(target.actualFeeAmount??actualFeeAmountForTarget(target)),targetAmount=Number(target.targetAmount);
    if(Number.isFinite(feeAmount)) summary.feeAmount+=feeAmount;
    if(Number.isFinite(actualFeeAmount)) summary.actualFeeAmount+=actualFeeAmount;
    if(Number.isFinite(targetAmount)) summary.targetAmount+=targetAmount;
    return summary;
  },{feeAmount:0,actualFeeAmount:0,targetAmount:0});
}

export function feeTargetMatchesFilters(target,filters={}){
  return (!filters.bankId||target.bankId===filters.bankId)
    &&(!filters.cardId||target.cardId===filters.cardId)
    &&(!filters.feeType||target.feeType===filters.feeType)
    &&(!filters.year||feeTargetYear(target)===String(filters.year));
}

export function consecutiveGroupSpan(rows,index,valueFn){
  const value=valueFn(rows[index]);
  if(index>0&&valueFn(rows[index-1])===value) return 0;
  let span=1;
  while(index+span<rows.length&&valueFn(rows[index+span])===value) span+=1;
  return span;
}
