import { calculateProgramCashback, isCashbackChannelEligible, isCashbackUnlimited, isMccEligible, normalizeCashbackConditions, normalizeCashbackGroup, normalizeCombineOperator } from "./cashback.js";
import { getCashbackPeriodForCard } from "./cashback-period.js";
import { cashbackTransactionsForCardPeriod } from "./cashback-transactions.js";

const sum=(items,selector)=>items.reduce((total,item)=>total+(Number(selector(item))||0),0);
const ratio=(value,target)=>Number(target)>0?Math.min(1,Math.max(0,(Number(value)||0)/Number(target))):null;

export function evaluateCashbackGroup(group,transactions,card,{mccCategories=[],referenceDate=new Date()}={}){
  group=normalizeCashbackGroup(group,mccCategories);
  const period=getCashbackPeriodForCard(card,referenceDate);
  const periodTransactions=cashbackTransactionsForCardPeriod(transactions,group.cardId,period);
  const totalSpend=sum(periodTransactions,item=>item.amount);
  const totalSpendMinimum=group.totalSpendMinimum==null?null:Number(group.totalSpendMinimum);
  const groupProgress=ratio(totalSpend,totalSpendMinimum);
  const hasGroupTarget=totalSpendMinimum!=null&&totalSpendMinimum>0;
  const groupSatisfied=!hasGroupTarget||totalSpend>=totalSpendMinimum;
  const combination=normalizeCombineOperator(group.conditionCombination);
  const conditions=normalizeCashbackConditions(group,mccCategories).map(condition=>{
    const eligibleSpend=sum(periodTransactions.filter(transaction=>
      isCashbackChannelEligible(condition,transaction)&&isMccEligible(condition,transaction,mccCategories)
    ),transaction=>transaction.amount);
    const eligibleTarget=condition.eligibleSpendMinimum==null
      ? (condition.eligibleTarget==null?null:Number(condition.eligibleTarget))
      : Number(condition.eligibleSpendMinimum);
    const eligibleProgress=ratio(eligibleSpend,eligibleTarget);
    const eligibleSatisfied=eligibleTarget==null||eligibleTarget<=0||eligibleSpend>=eligibleTarget;
    const rawCashback=eligibleSpend*(Number(condition.rate)||0);
    const cappedCashback=calculateProgramCashback(condition,eligibleSpend);
    const finalCashback=groupSatisfied&&eligibleSatisfied?cappedCashback:0;
    return {...condition,eligibleSpend,eligibleTarget,eligibleSatisfied,rawCashback,cappedCashback,finalCashback,
      progress:eligibleProgress??(isCashbackUnlimited(condition)?(eligibleSpend>0?1:0):0),
      remainingEligible:eligibleTarget==null?null:Math.max(0,eligibleTarget-eligibleSpend)};
  });
  const conditionStates=conditions.filter(condition=>condition.eligibleTarget!=null).map(condition=>condition.eligibleSatisfied);
  const childTargetsSatisfied=!conditionStates.length||(combination==="AND"?conditionStates.every(Boolean):conditionStates.some(Boolean));
  const overallSatisfied=groupSatisfied&&childTargetsSatisfied;
  const progressParts=[...(groupProgress==null?[]:[groupProgress]),...conditions.filter(condition=>condition.eligibleTarget!=null).map(condition=>condition.progress)];
  const progress=progressParts.length?(combination==="AND"?Math.min(...progressParts):Math.max(...progressParts)):(totalSpend>0?1:0);
  return {group,card,period,transactions:periodTransactions,totalSpend,totalSpendMinimum,groupSatisfied,groupProgress,conditions,conditionCombination:combination,overallSatisfied,progress,totalCashback:sum(conditions,item=>item.finalCashback)};
}

export function evaluateCashbackGroups(groups,transactions,cards,context={}){
  const cardsById=new Map((cards||[]).map(card=>[card.id,card]));
  return (groups||[]).map(group=>evaluateCashbackGroup(group,transactions,cardsById.get(group.cardId),context));
}
