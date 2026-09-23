import { getCashbackPeriodForCard } from "./cashback-period.js";
import { normalizeMoney } from "./money.js";
import { calculateProgramCashback, isCashbackChannelEligible, isMccEligible } from "./cashback.js";
import { cashbackTransactionsForCardPeriod } from "./cashback-transactions.js";

export const MB_PLATINUM_CARD_ID="MB Pla";
export const MB_PLATINUM_PACKAGE_IDS=Object.freeze(["DAILY","LIFESTYLE"]);
export const MB_PLATINUM_PACKAGE_LABELS=Object.freeze({
  DAILY:"Hàng ngày",
  LIFESTYLE:"Phong cách sống"
});

export function isMbPlatinumCard(cardId){
  return String(cardId||"")===MB_PLATINUM_CARD_ID;
}

export function mbPlatinumPackageLabel(packageId){
  return MB_PLATINUM_PACKAGE_LABELS[packageId]||String(packageId||"");
}

export function mbPlatinumPeriodKey(period={}){
  return period.type&&period.startDate&&period.endDate?`${period.type}:${period.startDate}:${period.endDate}`:"";
}

export function normalizeMbPlatinumCardConfig(config={},card={},options={}){
  const period=getCashbackPeriodForCard(card,options.referenceDate||new Date());
  const statementMinSpend=normalizeMoney(config.statementMinSpend,{emptyValue:5000000});
  const anchorPackage=MB_PLATINUM_PACKAGE_IDS.includes(config.rotationAnchorPrimaryPackageId)
    ? config.rotationAnchorPrimaryPackageId
    : "LIFESTYLE";
  return {
    ...config,
    cardId:MB_PLATINUM_CARD_ID,
    statementMinSpend:statementMinSpend==null?5000000:statementMinSpend,
    rotationAnchorPeriodKey:String(config.rotationAnchorPeriodKey||mbPlatinumPeriodKey(period)),
    rotationAnchorPrimaryPackageId:anchorPackage
  };
}

function periodEndFromKey(key){
  const match=String(key||"").match(/^statement:\d{4}-\d{2}-\d{2}:(\d{4})-(\d{2})-\d{2}$/);
  return match?{year:Number(match[1]),month:Number(match[2])}:null;
}

function monthDistance(left,right){
  return (right.year-left.year)*12+(right.month-left.month);
}

export function resolveMbPlatinumPackageRotation(config={},card={},referenceDate=new Date()){
  const normalized=normalizeMbPlatinumCardConfig(config,card,{referenceDate});
  const period=getCashbackPeriodForCard(card,referenceDate),periodKey=mbPlatinumPeriodKey(period);
  const anchorEnd=periodEndFromKey(normalized.rotationAnchorPeriodKey),currentEnd=periodEndFromKey(periodKey);
  const distance=anchorEnd&&currentEnd?monthDistance(anchorEnd,currentEnd):0;
  const alternates=Math.abs(distance)%2===1;
  const primaryPackageId=alternates
    ? (normalized.rotationAnchorPrimaryPackageId==="DAILY"?"LIFESTYLE":"DAILY")
    : normalized.rotationAnchorPrimaryPackageId;
  const secondaryPackageId=primaryPackageId==="DAILY"?"LIFESTYLE":"DAILY";
  return {period,periodKey,primaryPackageId,secondaryPackageId,limits:{DAILY:primaryPackageId==="DAILY"?2:1,LIFESTYLE:primaryPackageId==="LIFESTYLE"?2:1}};
}

export function isMbPlatinumProgramTransactionEligible(program,transaction,mccCategories=[]){
  if(!program||!transaction)return false;
  if(String(program.cardId||"")!==MB_PLATINUM_CARD_ID||String(transaction.cardId||"")!==MB_PLATINUM_CARD_ID)return false;
  if(String(program.id||"")!==String(transaction.cashbackProgramId||""))return false;
  if(String(program.packageId||"")!==String(transaction.cashbackPackageId||""))return false;
  return isCashbackChannelEligible(program,transaction)&&isMccEligible(program,transaction,mccCategories);
}

function compareAssignmentTransactions(left,right){
  return String(left.date||"").localeCompare(String(right.date||""))
    ||String(left.transactionTime||"00:00:00").localeCompare(String(right.transactionTime||"00:00:00"))
    ||String(left.id||"").localeCompare(String(right.id||""),"en",{numeric:true});
}

export function deriveMbPlatinumSlotUsage({config={},card={},programs=[],transactions=[],mccCategories=[],referenceDate=new Date(),excludeTransactionId=""}={}){
  const rotation=resolveMbPlatinumPackageRotation(config,card,referenceDate);
  const packages=Object.fromEntries(MB_PLATINUM_PACKAGE_IDS.map(packageId=>[packageId,{packageId,label:mbPlatinumPackageLabel(packageId),limit:rotation.limits[packageId],used:0,remaining:rotation.limits[packageId],occupiedProgramIds:[],transactions:[]}]))
  const programsById=new Map((programs||[]).filter(program=>isMbPlatinumCard(program.cardId)).map(program=>[String(program.id||""),program]));
  const candidates=cashbackTransactionsForCardPeriod(transactions,MB_PLATINUM_CARD_ID,rotation.period)
    .filter(transaction=>!excludeTransactionId||String(transaction.id||"")!==String(excludeTransactionId))
    .sort(compareAssignmentTransactions);
  candidates.forEach(transaction=>{
    const program=programsById.get(String(transaction.cashbackProgramId||""));
    if(!isMbPlatinumProgramTransactionEligible(program,transaction,mccCategories))return;
    const state=packages[program.packageId];
    if(!state)return;
    const duplicate=state.occupiedProgramIds.includes(program.id);
    if(!duplicate&&state.used>=state.limit)return;
    if(!duplicate){state.occupiedProgramIds.push(program.id);state.used+=1;state.remaining=state.limit-state.used;}
    state.transactions.push(transaction);
  });
  return {...rotation,packages,totalUsed:MB_PLATINUM_PACKAGE_IDS.reduce((total,id)=>total+packages[id].used,0),occupiedProgramIds:MB_PLATINUM_PACKAGE_IDS.flatMap(id=>packages[id].occupiedProgramIds)};
}

export function validateMbPlatinumAssignment({transaction={},...context}={}){
  const usage=deriveMbPlatinumSlotUsage({...context,excludeTransactionId:transaction.id||context.excludeTransactionId});
  const program=(context.programs||[]).find(item=>String(item.id||"")===String(transaction.cashbackProgramId||""));
  if(!transaction.cashbackPackageId&&!transaction.cashbackProgramId)return {valid:true,duplicate:false,qualified:false,message:"",usage,program:null};
  if(!program||program.cardId!==MB_PLATINUM_CARD_ID||program.packageId!==transaction.cashbackPackageId){
    return {valid:false,duplicate:false,qualified:false,message:"Chương trình cashback không thuộc Gói đã chọn.",usage,program:program||null};
  }
  const qualified=isMbPlatinumProgramTransactionEligible(program,transaction,context.mccCategories||[]);
  if(!qualified)return {valid:true,duplicate:false,qualified:false,message:"Giao dịch chưa thỏa điều kiện của chương trình cashback đã chọn.",usage,program};
  const packageUsage=usage.packages[program.packageId],duplicate=packageUsage.occupiedProgramIds.includes(program.id);
  if(!duplicate&&packageUsage.used>=packageUsage.limit){
    const nextLabel=mbPlatinumPackageLabel(usage.secondaryPackageId);
    const message=program.packageId===usage.primaryPackageId
      ? `Đã sử dụng ${packageUsage.used}/${packageUsage.limit} chương trình của Gói ${packageUsage.label} trong kỳ sao kê này. Chương trình cashback tiếp theo phải thuộc Gói ${nextLabel}.`
      : `Đã sử dụng ${packageUsage.used}/${packageUsage.limit} chương trình của Gói ${packageUsage.label} trong kỳ sao kê này.`;
    return {valid:false,duplicate:false,qualified:true,message,usage,program};
  }
  return {valid:true,duplicate,qualified:true,message:duplicate?"Chương trình này đã được sử dụng trong kỳ sao kê hiện tại.":"",usage,program};
}

export function evaluateMbPlatinumCashback({config={},card={},programs=[],transactions=[],mccCategories=[],referenceDate=new Date()}={}){
  const normalizedConfig=normalizeMbPlatinumCardConfig(config,card,{referenceDate});
  const usage=deriveMbPlatinumSlotUsage({config:normalizedConfig,card,programs,transactions,mccCategories,referenceDate});
  const periodTransactions=cashbackTransactionsForCardPeriod(transactions,MB_PLATINUM_CARD_ID,usage.period);
  const occupied=new Set(usage.occupiedProgramIds);
  const programResults=(programs||[]).filter(program=>occupied.has(program.id)).map(program=>{
    const eligibleTransactions=periodTransactions.filter(transaction=>isMbPlatinumProgramTransactionEligible(program,transaction,mccCategories));
    const eligibleSpend=eligibleTransactions.reduce((total,transaction)=>total+(Number(transaction.amount)||0),0);
    const eligibleTarget=program.eligibleSpendMinimum==null?null:Number(program.eligibleSpendMinimum);
    const eligibleSatisfied=eligibleTarget==null||eligibleTarget<=0||eligibleSpend>=eligibleTarget;
    const rawCashback=eligibleSpend*(Number(program.rate)||0);
    const cappedCashback=calculateProgramCashback(program,eligibleSpend);
    return {program,eligibleTransactions,eligibleSpend,eligibleTarget,eligibleSatisfied,rawCashback,cappedCashback,finalCashback:eligibleSatisfied?cappedCashback:0};
  });
  const eligibleSpend=programResults.reduce((total,result)=>total+result.eligibleSpend,0);
  const statementMinSpend=Number(normalizedConfig.statementMinSpend)||0;
  const statementMinimumSatisfied=statementMinSpend<=0||eligibleSpend>=statementMinSpend;
  const uncappedCashback=programResults.reduce((total,result)=>total+result.finalCashback,0);
  const totalCashback=statementMinimumSatisfied?uncappedCashback:0;
  const conditions=programResults.map(result=>({...result.program,eligibleSpend:result.eligibleSpend,eligibleTarget:result.eligibleTarget,eligibleSatisfied:result.eligibleSatisfied,rawCashback:result.rawCashback,cappedCashback:result.cappedCashback,finalCashback:statementMinimumSatisfied?result.finalCashback:0,remainingEligible:result.eligibleTarget==null?null:Math.max(0,result.eligibleTarget-result.eligibleSpend),progress:result.eligibleTarget>0?Math.min(1,result.eligibleSpend/result.eligibleTarget):(result.eligibleSpend>0?1:0)}));
  const aggregateProgram={id:`MB-PLATINUM-${usage.periodKey}`,cardId:MB_PLATINUM_CARD_ID,name:"MB Platinum",year:Number(String(usage.period.endDate).slice(0,4)),month:Number(String(usage.period.endDate).slice(5,7))};
  return {mbPlatinum:true,program:aggregateProgram,group:aggregateProgram,card,period:usage.period,transactions:programResults.flatMap(result=>result.eligibleTransactions),totalSpend:eligibleSpend,eligibleSpend,totalSpendMinimum:statementMinSpend,statementMinSpend,statementMinimumSatisfied,programSatisfied:statementMinimumSatisfied,groupSatisfied:statementMinimumSatisfied,overallSatisfied:statementMinimumSatisfied,groupProgress:statementMinSpend>0?Math.min(1,eligibleSpend/statementMinSpend):null,progress:statementMinSpend>0?Math.min(1,eligibleSpend/statementMinSpend):(eligibleSpend>0?1:0),conditionMode:"independent",conditionCombination:"OR",conditions,programResults,usage,uncappedCashback,totalCashback,packaged:false};
}
