import { calculateProgramCashback, isCashbackChannelEligible, isCashbackUnlimited, isMccEligible, normalizeCashbackConditions, normalizeCashbackGroup, normalizeCombineOperator } from "./cashback.js";
import { getCashbackPeriodForCard } from "./cashback-period.js";
import { cashbackTransactionsForCardPeriod } from "./cashback-transactions.js";
import { getActiveCashbackPackage, getPackageSwitchCount, getRemainingPackageSwitches, hasCashbackPackages, normalizeCashbackPackageProgram, resolvePackageForTransaction } from "./cashback-packages.js";

const sum=(items,selector)=>items.reduce((total,item)=>total+(Number(selector(item))||0),0);
const ratio=(value,target)=>Number(target)>0?Math.min(1,Math.max(0,(Number(value)||0)/Number(target))):null;

export function evaluateCashbackGroup(group,transactions,card,{mccCategories=[],referenceDate=new Date()}={}){
  if(hasCashbackPackages(group)) return evaluateCashbackProgram(group,transactions,card,{mccCategories,referenceDate});
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
  const uncappedCashback=sum(conditions,item=>item.finalCashback);
  const totalCashback=group.maxCashback==null?uncappedCashback:Math.min(Number(group.maxCashback)||0,uncappedCashback);
  return {group,card,period,transactions:periodTransactions,totalSpend,totalSpendMinimum,groupSatisfied,groupProgress,conditions,conditionCombination:combination,overallSatisfied,progress,uncappedCashback,totalCashback};
}

export function evaluateCashbackGroups(groups,transactions,cards,context={}){
  const cardsById=new Map((cards||[]).map(card=>[card.id,card]));
  return (groups||[]).map(group=>evaluateCashbackGroup(group,transactions,cardsById.get(group.cardId),context));
}

export function evaluateCashbackProgram(program,transactions,card,{mccCategories=[],referenceDate=new Date()}={}){
  program=normalizeCashbackPackageProgram(program,mccCategories);
  if(!hasCashbackPackages(program)) return {...evaluateCashbackGroup(program,transactions,card,{mccCategories,referenceDate}),packaged:false};
  const period=getCashbackPeriodForCard(card,referenceDate);
  const periodTransactions=cashbackTransactionsForCardPeriod(transactions,program.cardId,period);
  const totalSpend=sum(periodTransactions,item=>item.amount);
  const minimum=program.totalSpendMinimum==null?null:Number(program.totalSpendMinimum);
  const programSatisfied=minimum==null||minimum<=0||totalSpend>=minimum;
  const packageTransactions=new Map(program.packages.map(item=>[item.id,[]]));
  periodTransactions.forEach(transaction=>{
    const active=resolvePackageForTransaction(program,transaction,card);
    if(active) packageTransactions.get(active.id)?.push(transaction);
  });
  const packages=program.packages.map(item=>{
    const packageTx=packageTransactions.get(item.id)||[];
    const groups=item.groups.map(group=>evaluateCashbackGroup({...group,cardId:program.cardId},packageTx,card,{mccCategories,referenceDate}));
    return {...item,transactions:packageTx,groups,totalCashback:sum(groups,group=>group.totalCashback)};
  });
  const uncappedCashback=programSatisfied?sum(packages,item=>item.totalCashback):0;
  const cap=program.maxCashbackPerPeriod==null?null:Number(program.maxCashbackPerPeriod);
  const totalCashback=cap==null?uncappedCashback:Math.min(cap,uncappedCashback);
  const conditions=packages.flatMap(item=>item.groups.flatMap(group=>group.conditions.map(condition=>({...condition,packageId:item.id,packageName:item.name,groupId:group.group.id,groupName:group.group.name}))));
  const currentPackage=getActiveCashbackPackage(program,period,referenceDate);
  const totalSpendMinimum=minimum;
  const progress=ratio(totalSpend,totalSpendMinimum)??(totalSpend>0?1:0);
  return {program,group:program,card,period,transactions:periodTransactions,totalSpend,totalSpendMinimum,programSatisfied,groupSatisfied:programSatisfied,groupProgress:ratio(totalSpend,totalSpendMinimum),packaged:true,packages,conditions,conditionCombination:"OR",currentPackage,packageSwitchCount:getPackageSwitchCount(program,period),remainingPackageSwitches:getRemainingPackageSwitches(program,period),maxCashbackPerPeriod:cap,uncappedCashback,totalCashback,progress,overallSatisfied:programSatisfied};
}

export function evaluateCashbackPrograms(programs,transactions,cards,context={}){
  const cardsById=new Map((cards||[]).map(card=>[card.id,card]));
  return (programs||[]).map(program=>evaluateCashbackProgram(program,transactions,cardsById.get(program.cardId),context));
}
