import { toStorageDate } from "./date.js";
import { isCancelledTransactionStatus } from "./transaction-status.js";

const SEVERITY_RANK = {red:4,orange:3,yellow:2,green:1,none:0};

function localToday(){
  const now=new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

function daysBetween(from,to){
  const start=new Date(`${from}T00:00:00`);
  const end=new Date(`${to}T00:00:00`);
  return Math.round((end-start)/86400000);
}

function transactionMccId(transaction,mccCategories){
  return mccCategories.find(item=>item.id===transaction.mccCategoryId || item.name===transaction.category || Number(item.mcc)===Number(transaction.mcc))?.id || "";
}

export function isFeeTargetTransactionEligible(target,transaction,mccCategories=[]){
  if(transaction.cardId!==target.cardId) return false;
  const date=toStorageDate(transaction.date);
  if(!date || date<target.periodStart || date>target.periodEnd) return false;
  if(isCancelledTransactionStatus(transaction.status)) return false;
  if(target.channel && target.channel!=="all" && String(transaction.channel || "").toLowerCase()!==String(target.channel).toLowerCase()) return false;
  if(target.allMcc===true) return true;
  return (target.mccCategoryIds || []).includes(transactionMccId(transaction,mccCategories));
}

export function calculateFeeTargetMetrics(target,transactions=[],mccCategories=[],today=localToday()){
  const eligibleSpend=transactions.filter(transaction=>isFeeTargetTransactionEligible(target,transaction,mccCategories)).reduce((sum,transaction)=>sum+(Number(transaction.amount)||0),0);
  const targetAmount=Number(target.targetAmount)||0;
  const remainingAmount=Math.max(targetAmount-eligibleSpend,0);
  const progressPercent=targetAmount>0?Math.min(eligibleSpend/targetAmount*100,100):0;
  const rawDaysLeft=daysBetween(today,target.periodEnd);
  const daysLeft=Math.max(rawDaysLeft,0);
  const achieved=targetAmount>0 && eligibleSpend>=targetAmount;
  const expired=rawDaysLeft<0 && !achieved;
  const remainingRatio=targetAmount>0?remainingAmount/targetAmount:1;
  const status=achieved?"achieved":expired?"expired":remainingRatio<=0.3?"near":"tracking";
  let warning="none";
  if(achieved) warning="green";
  else if(remainingRatio<=0.1 || rawDaysLeft<=30) warning="red";
  else if(remainingRatio<=0.15) warning="orange";
  else if(remainingRatio<=0.3) warning="yellow";
  return {...target,eligibleSpend,remainingAmount,progressPercent,daysLeft,rawDaysLeft,status,warning};
}

export function feeTargetReminder(metric,formatMoney=value=>String(value)){
  if(metric.status==="achieved") return `${metric.cardId} đã đạt điều kiện hoàn phí thường niên.`;
  if(metric.status==="expired") return `${metric.cardId} đã hết chu kỳ nhưng chưa đạt chỉ tiêu.`;
  if(metric.rawDaysLeft<=30) return `${metric.cardId} còn ${metric.daysLeft} ngày và còn thiếu ${formatMoney(metric.remainingAmount)}.`;
  return `${metric.cardId} còn thiếu ${formatMoney(metric.remainingAmount)} để đạt điều kiện hoàn phí thường niên.`;
}

export function sortFeeTargetMetrics(metrics=[]){
  const statusRank={tracking:0,near:0,achieved:1,expired:2};
  return [...metrics].sort((a,b)=>
    (statusRank[a.status]??0)-(statusRank[b.status]??0) ||
    (SEVERITY_RANK[b.warning]||0)-(SEVERITY_RANK[a.warning]||0) ||
    String(a.periodEnd||"").localeCompare(String(b.periodEnd||""))
  );
}

export function sortFeeReminderMetrics(metrics=[]){
  return [...metrics].sort((a,b)=>(SEVERITY_RANK[b.warning]||0)-(SEVERITY_RANK[a.warning]||0) || String(a.periodEnd||"").localeCompare(String(b.periodEnd||"")));
}

export function formatFeeProgress(percent){
  return `${(Number(percent)||0).toLocaleString("vi-VN",{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
}

export function buildFeeTargetId(cardId,feeType,periodStart,existingIds=[]){
  const typeCodes={annual_fee:"ANNUAL",management_fee:"MANAGEMENT",maintenance_fee:"MAINTENANCE",other:"OTHER"};
  const year=String(periodStart||"").slice(0,4)||"PERIOD";
  const base=`FEE-${cardId}-${typeCodes[feeType]||"OTHER"}-${year}`;
  const ids=new Set(existingIds);
  if(!ids.has(base)) return base;
  let suffix=2;
  while(ids.has(`${base}-${suffix}`)) suffix+=1;
  return `${base}-${suffix}`;
}
