import {calculateProgramCashback,calculateRuleProgress,isCashbackCombinationSatisfied,isCashbackUnlimited,isMccEligible,normalizeCashbackConditions,normalizeCombineOperator,normalizeTransactionMethod} from './cashback.js?v=20260907-tracking-matrix-v1';
import {financialTransactions} from './financial-totals.js?v=20260909-bug-lazada-financial-exclusion-v1';
import {getCashbackPeriodForCard,getCashbackReferenceDate,isDateInCashbackPeriod} from './cashback-period.js?v=20260912-statement-cycle-v1';

const compare=(a,b)=>String(a||'').localeCompare(String(b||''),'vi',{sensitivity:'base',numeric:true});
const sum=(items,fn)=>items.reduce((total,item)=>total+(Number(fn(item))||0),0);

export const formatMatrixHostName=name=>{
  const words=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(words.length<=1) return words[0]||'—';
  return words.map((word,index)=>index===words.length-1?word:`${Array.from(word)[0]?.toLocaleUpperCase('vi')||''}.`).join('');
};

function eligibleSpend(condition,program,transactions,mccCategories){
  return sum(transactions.filter(tx=>{
    if(tx.cardId!==program.cardId) return false;
    if(condition.channel && normalizeTransactionMethod(tx.channel)!==normalizeTransactionMethod(condition.channel)) return false;
    return isMccEligible({...condition,cardId:program.cardId},tx,mccCategories);
  }),tx=>tx.amount);
}

function hostMatches(tx,host){
  const value=String(tx?.host||'').trim();
  return value===String(host?.id||'').trim() || value===String(host?.name||'').trim();
}

export function buildTrackingMatrix(state,{year,month,referenceDate}={}){
  const hosts=[...(state.hosts||[])].sort((a,b)=>compare(a.name,b.name)||compare(a.id,b.id));
  const banks=new Map((state.banks||[]).map(bank=>[bank.id,bank]));
  const cards=new Map((state.cards||[]).map(card=>[card.id,card]));
  const financialTxs=financialTransactions(state.transactions||[]);
  const programs=(state.cashbackPrograms||[]).filter(program=>Number(program.year)===Number(year)&&Number(program.month)===Number(month)&&cards.has(program.cardId));
  const rows=programs.map(program=>{
    const card=cards.get(program.cardId),bank=banks.get(card.bankId);
    const cashbackPeriod=getCashbackPeriodForCard(card,referenceDate||getCashbackReferenceDate(year,month));
    const periodTransactions=financialTxs.filter(tx=>tx.cardId===program.cardId&&isDateInCashbackPeriod(tx.date,cashbackPeriod));
    const cells=hosts.map(host=>{
      const transactions=periodTransactions.filter(tx=>tx.cardId===program.cardId&&hostMatches(tx,host));
      const total=sum(transactions,tx=>tx.amount);
      const combineOperator=normalizeCombineOperator(program.combineOperator);
      const conditions=normalizeCashbackConditions(program,state.mccCategories||[]).map(condition=>{
        const eligible=eligibleSpend(condition,program,transactions,state.mccCategories||[]);
        const progress=isCashbackUnlimited(condition)?(eligible>0?1:0):calculateRuleProgress(condition,eligible,total);
        return {...condition,eligible,rawCashback:calculateProgramCashback(condition,eligible),progress,remaining:condition.eligibleTarget==null?null:Math.max(0,condition.eligibleTarget-eligible)};
      });
      const totalCondition=program.totalSpendCondition||{enabled:program.totalTarget!=null,amount:program.totalTarget};
      const totalTarget=totalCondition.enabled?Number(totalCondition.amount)||0:null;
      const totalMetric=totalCondition.enabled?{progress:totalTarget>0?Math.min(1,total/totalTarget):0,remaining:Math.max(0,totalTarget-total)}:null;
      const parts=totalMetric?[...conditions,totalMetric]:conditions;
      const combinationSatisfied=parts.length?isCashbackCombinationSatisfied(parts.map(part=>({...part,combineOperator}))):false;
      const allUnlimited=conditions.length>0&&conditions.every(condition=>isCashbackUnlimited(condition));
      const completed=combinationSatisfied&&(!allUnlimited||totalTarget!=null);
      const eligible=sum(conditions,item=>item.eligible);
      const eligibleTarget=sum(conditions,item=>item.eligibleTarget)||null;
      const remainingValues=conditions.map(item=>item.remaining).filter(value=>value!=null);
      const remainingEligible=remainingValues.length?(combineOperator==='AND'?sum(remainingValues,value=>value):Math.min(...remainingValues)):null;
      const cashbackEstimated=sum(conditions,item=>item.rawCashback);
      const progress=parts.length?(combineOperator==='AND'?Math.min(...parts.map(part=>Number(part.progress)||0)):Math.max(...parts.map(part=>Number(part.progress)||0))):0;
      const status=completed?'COMPLETED':(total>0||eligible>0?'IN_PROGRESS':'AVAILABLE');
      return {host,card,bank,program,transactions,total,eligible,eligibleTarget,totalTarget,remainingEligible,remainingTotal:totalTarget==null?null:Math.max(0,totalTarget-total),cashbackEstimated,progress,conditions,combineOperator,combinationSatisfied,status};
    });
    return {bank,card,program,cells};
  });
  rows.sort((a,b)=>compare(a.bank?.name,b.bank?.name)||compare(a.card.id,b.card.id)||compare(a.program.name,b.program.name)||compare(a.program.id,b.program.id));
  return {hosts,rows,year:Number(year),month:Number(month)};
}

export function trackingOrderPreset(cell,state){
  const conditionMcc=[...new Set((cell.conditions||[]).flatMap(condition=>condition.allMcc?[]:(condition.mccCategoryIds||[])))];
  return {cardId:cell.card.id,host:cell.host.name,mccCategoryId:conditionMcc.length===1?conditionMcc[0]:''};
}
