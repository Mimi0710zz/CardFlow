import {getCashbackReferenceDate} from './cashback-period.js?v=20260912-statement-cycle-v1';
import {evaluateCashbackProgram} from './cashback-evaluation.js';
import {reminderUrgencyTone} from './payment-statement.js?v=20260914-reminder-urgency-v1';
import {trackingCashbackReceiptKey} from './tracking-cashback-receipts.js';
import {evaluateMbPlatinumCashback,isMbPlatinumCard} from './mb-platinum-cashback.js';

const compare=(a,b)=>String(a||'').localeCompare(String(b||''),'vi',{sensitivity:'base',numeric:true});
const sum=(items,fn)=>items.reduce((total,item)=>total+(Number(fn(item))||0),0);
const DAY_MS=24*60*60*1000;
export const TRACKING_COLUMNS=['Ngân hàng','Thẻ','Phôi','Chương trình cashback','Tổng chi','Thời hạn','Tiền CB max','Hình thức hoàn','Ghi chú'];

function storageDayNumber(value){const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return match?Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])):null;}

export function trackingDeadline(period,today=new Date(),completed=false){
  const deadlineDate=period?.endDate||'',deadlineDay=storageDayNumber(deadlineDate),todayDate=today instanceof Date?`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`:String(today||''),todayDay=storageDayNumber(todayDate);
  if(deadlineDay==null||todayDay==null)return {date:deadlineDate,daysRemaining:null,text:'—',tone:'neutral'};
  const daysRemaining=Math.round((deadlineDay-todayDay)/DAY_MS);
  return {date:deadlineDate,daysRemaining,text:daysRemaining>0?`Còn ${daysRemaining} ngày`:daysRemaining===0?'Hết hạn hôm nay':`Quá hạn ${Math.abs(daysRemaining)} ngày`,tone:completed?'paid':reminderUrgencyTone(daysRemaining)};
}

export function cashbackPeriodIdentity(period){
  const periodType=period?.type==='statement'?'STATEMENT':'MONTH',periodKey=periodType==='MONTH'?String(period?.startDate||'').slice(0,7):`${period?.startDate||''}:${period?.endDate||''}`;
  return {periodType,periodKey};
}

export function summarizeTrackingCashback(rows=[]){
  const unique=new Map();rows.forEach(row=>unique.set(trackingCashbackReceiptKey(row),row));
  return [...unique.values()].reduce((result,row)=>{if(row.noCashback)return result;const amount=Number(row.maxCashback)||0;result.total+=amount;if(row.received)result.received+=amount;return result;},{received:0,total:0});
}

export function buildTrackingMatrix(state,{year,month,referenceDate,today=new Date()}={}){
  const banks=new Map((state.banks||[]).map(bank=>[bank.id,bank])),cards=new Map((state.cards||[]).map(card=>[card.id,card])),receipts=new Map((state.trackingCashbackReceipts||[]).map(item=>[trackingCashbackReceiptKey(item),item]));
  const programs=(state.cashbackProgramGroups||state.cashbackPrograms||[]).filter(program=>Number(program.year)===Number(year)&&Number(program.month)===Number(month)&&cards.has(program.cardId));
  const mbPrograms=programs.filter(program=>isMbPlatinumCard(program.cardId)),mbCard=cards.get(mbPrograms[0]?.cardId),mbEvaluation=mbCard&&mbPrograms.length?evaluateMbPlatinumCashback({config:(state.cashbackCardConfigs||[]).find(config=>isMbPlatinumCard(config.cardId))||{},card:mbCard,programs:mbPrograms,transactions:state.transactions,mccCategories:state.mccCategories||[],referenceDate:referenceDate||getCashbackReferenceDate(year,month)}):null;
  const rows=programs.map(program=>{
    const card=cards.get(program.cardId),bank=banks.get(card.bankId),cardConfig=(state.cashbackCardConfigs||[]).find(config=>config.cardId===program.cardId);
    const mbResult=mbEvaluation?.programResults?.find(item=>item.program.id===program.id);
    const evaluation=isMbPlatinumCard(program.cardId)?{period:mbEvaluation.period,transactions:mbResult?.eligibleTransactions||[],totalSpend:mbEvaluation.eligibleSpend,totalSpendMinimum:mbEvaluation.statementMinSpend,conditions:[{...program,eligibleSpend:mbResult?.eligibleSpend||0,eligibleTarget:mbResult?.eligibleTarget??null,eligibleSatisfied:mbResult?.eligibleSatisfied??true,remainingEligible:mbResult?.eligibleTarget==null?null:Math.max(0,mbResult.eligibleTarget-(mbResult?.eligibleSpend||0)),finalCashback:mbEvaluation.statementMinimumSatisfied?(mbResult?.finalCashback||0):0}],maxCashbackPerPeriod:program.maxCashbackUnlimited?null:Number(program.max)||0,totalCashback:mbEvaluation.statementMinimumSatisfied?(mbResult?.finalCashback||0):0,overallSatisfied:mbEvaluation.statementMinimumSatisfied&&(mbResult?.eligibleSatisfied??true),progress:mbEvaluation.progress,conditionCombination:'OR'}:evaluateCashbackProgram(program,state.transactions,card,{mccCategories:state.mccCategories||[],referenceDate:referenceDate||getCashbackReferenceDate(year,month),cardCashbackConfig:cardConfig});
    const conditions=(evaluation.conditions||[]).map(item=>({...item,eligible:item.eligibleSpend,remaining:item.remainingEligible})),eligibleSpend=sum(conditions,item=>item.eligibleSpend),eligibleTarget=sum(conditions,item=>item.eligibleTarget)||null,noCashback=conditions.length>0&&conditions.every(item=>item.maxType==='NO_CASHBACK');
    const maxCashback=noCashback?0:Math.max(0,Number(evaluation.maxCashbackPerPeriod??evaluation.totalCashback)||0),{periodType,periodKey}=cashbackPeriodIdentity(evaluation.period),receipt=receipts.get(trackingCashbackReceiptKey({cardId:card.id,programId:program.id,periodType,periodKey}));
    const completed=evaluation.overallSatisfied,status=completed?'COMPLETED':(evaluation.totalSpend>0||eligibleSpend>0?'IN_PROGRESS':'AVAILABLE'),deadline=trackingDeadline(evaluation.period,today,completed),note=String(program.note||'');
    const metric={card,bank,program,transactions:evaluation.transactions,total:evaluation.totalSpend,eligible:eligibleSpend,eligibleTarget,totalTarget:evaluation.totalSpendMinimum,remainingEligible:eligibleTarget==null?null:Math.max(0,eligibleTarget-eligibleSpend),remainingTotal:evaluation.totalSpendMinimum==null?null:Math.max(0,evaluation.totalSpendMinimum-evaluation.totalSpend),cashbackEstimated:evaluation.totalCashback,progress:evaluation.progress,conditions,combineOperator:evaluation.conditionCombination||'OR',combinationSatisfied:completed,status,cashbackPeriod:evaluation.period,deadline,note};
    return {cardId:card.id,bank,card,cardTemplate:card.network||'',program,programId:program.id,programName:program.name,periodType,periodKey,eligibleSpend,totalSpend:evaluation.totalSpend,deadline,maxCashback,cashbackCycle:periodType==='STATEMENT'?'statement':'monthly',received:receipt?.received===true,receivedDate:receipt?.receivedDate||'',noCashback,note,metric};
  });
  rows.sort((a,b)=>compare(a.bank?.name,b.bank?.name)||compare(a.card.id,b.card.id)||compare(a.program.name,b.program.name)||compare(a.program.id,b.program.id));
  return {rows,year:Number(year),month:Number(month)};
}

export function trackingOrderPreset(metric){const conditionMcc=[...new Set((metric.conditions||[]).flatMap(condition=>condition.allMcc?[]:(condition.mccCategoryIds||[])))];return {cardId:metric.card.id,mccCategoryId:conditionMcc.length===1?conditionMcc[0]:''};}
