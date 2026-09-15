import {getCashbackReferenceDate} from './cashback-period.js?v=20260912-statement-cycle-v1';
import {evaluateCashbackGroup} from './cashback-evaluation.js?v=20260915-cashback-group-v1';
import {reminderUrgencyTone} from './payment-statement.js?v=20260914-reminder-urgency-v1';

const compare=(a,b)=>String(a||'').localeCompare(String(b||''),'vi',{sensitivity:'base',numeric:true});
const sum=(items,fn)=>items.reduce((total,item)=>total+(Number(fn(item))||0),0);
const DAY_MS=24*60*60*1000;
export const TRACKING_COLUMNS=['Ngân hàng','Card ID','Phôi','Chương trình cashback','Tổng chi','Thời hạn','Ghi chú'];

function storageDayNumber(value){
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match?Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])):null;
}

export function trackingDeadline(period,today=new Date(),completed=false){
  const deadlineDate=period?.endDate||'';
  const deadlineDay=storageDayNumber(deadlineDate);
  const todayDate=today instanceof Date?`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`:String(today||'');
  const todayDay=storageDayNumber(todayDate);
  if(deadlineDay==null||todayDay==null)return {date:deadlineDate,daysRemaining:null,text:'—',tone:'neutral'};
  const daysRemaining=Math.round((deadlineDay-todayDay)/DAY_MS);
  const text=daysRemaining>0?`Còn ${daysRemaining} ngày`:daysRemaining===0?'Hết hạn hôm nay':`Quá hạn ${Math.abs(daysRemaining)} ngày`;
  return {date:deadlineDate,daysRemaining,text,tone:completed?'paid':reminderUrgencyTone(daysRemaining)};
}

export function buildTrackingMatrix(state,{year,month,referenceDate,today=new Date()}={}){
  const banks=new Map((state.banks||[]).map(bank=>[bank.id,bank]));
  const cards=new Map((state.cards||[]).map(card=>[card.id,card]));
  const programs=(state.cashbackProgramGroups||state.cashbackPrograms||[]).filter(program=>Number(program.year)===Number(year)&&Number(program.month)===Number(month)&&cards.has(program.cardId));
  const rows=programs.flatMap(program=>{
    const card=cards.get(program.cardId),bank=banks.get(card.bankId);
    const evaluation=evaluateCashbackGroup(program,state.transactions,card,{mccCategories:state.mccCategories||[],referenceDate:referenceDate||getCashbackReferenceDate(year,month)});
    const cashbackPeriod=evaluation.period,transactions=evaluation.transactions,total=evaluation.totalSpend;
    const combineOperator=evaluation.conditionCombination;
    const conditions=evaluation.conditions.map(condition=>({...condition,eligible:condition.eligibleSpend,remaining:condition.remainingEligible,rawCashback:condition.finalCashback}));
    const totalTarget=evaluation.totalSpendMinimum;
    const combinationSatisfied=evaluation.overallSatisfied;
    const completed=evaluation.overallSatisfied;
    const eligible=sum(conditions,item=>item.eligible);
    const eligibleTarget=sum(conditions,item=>item.eligibleTarget)||null;
    const remainingValues=conditions.map(item=>item.remaining).filter(value=>value!=null);
    const remainingEligible=remainingValues.length?(combineOperator==='AND'?sum(remainingValues,value=>value):Math.min(...remainingValues)):null;
    const cashbackEstimated=evaluation.totalCashback;
    const progress=evaluation.progress;
    const status=completed?'COMPLETED':(total>0||eligible>0?'IN_PROGRESS':'AVAILABLE');
    const deadline=trackingDeadline(cashbackPeriod,today,completed);
    return conditions.map(condition=>{
      const conditionCompleted=evaluation.groupSatisfied&&condition.eligibleSatisfied;
      const conditionProgressParts=[...(evaluation.groupProgress==null?[]:[evaluation.groupProgress]),...(condition.eligibleTarget==null?[]:[condition.progress])];
      const conditionProgress=conditionProgressParts.length?Math.min(...conditionProgressParts):(condition.eligible>0?1:0);
      const conditionStatus=conditionCompleted?'COMPLETED':(total>0||condition.eligible>0?'IN_PROGRESS':'AVAILABLE');
      const metric={card,bank,program,condition,transactions,total,eligible:condition.eligible,eligibleTarget:condition.eligibleTarget,totalTarget,remainingEligible:condition.remaining,remainingTotal:totalTarget==null?null:Math.max(0,totalTarget-total),cashbackEstimated:condition.rawCashback,progress:conditionProgress,conditions:[condition],combineOperator,combinationSatisfied:conditionCompleted,status:conditionStatus,cashbackPeriod,deadline:trackingDeadline(cashbackPeriod,today,conditionCompleted),note:String(condition.note||program.note||'')};
      return {bank,card,program:{...program,name:`${program.name} · ${condition.name}`},group:program,condition,metric};
    });
  });
  rows.sort((a,b)=>compare(a.bank?.name,b.bank?.name)||compare(a.card.id,b.card.id)||compare(a.program.name,b.program.name)||compare(a.program.id,b.program.id));
  return {rows,year:Number(year),month:Number(month)};
}

export function trackingOrderPreset(metric){
  const conditionMcc=[...new Set((metric.conditions||[]).flatMap(condition=>condition.allMcc?[]:(condition.mccCategoryIds||[])))];
  return {cardId:metric.card.id,mccCategoryId:conditionMcc.length===1?conditionMcc[0]:''};
}
