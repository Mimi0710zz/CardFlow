import { normalizeCashbackGroup } from "./cashback.js";
import { getCashbackPeriodForCard, isDateInCashbackPeriod } from "./cashback-period.js";
import { normalizeConditionMode } from "./cashback-program-config.js";

const idPart=value=>String(value||"").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"ITEM";
const storageDate=value=>String(value||"").slice(0,10);
function localTimestamp(value){
  if(value instanceof Date)return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}T${String(value.getHours()).padStart(2,"0")}:${String(value.getMinutes()).padStart(2,"0")}:${String(value.getSeconds()).padStart(2,"0")}`;
  const raw=String(value||"").trim().replace(" ","T");
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return `${raw}T00:00:00`;
  const match=raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  return match?`${match[1]}T${match[2]}:${match[3]}:${match[4]||"00"}`:"";
}

export function hasCashbackPackages(program){return Array.isArray(program?.packages)&&program.packages.length>0;}
export function cashbackPackagePeriodKey(period){return period?.type&&period?.startDate&&period?.endDate?`${period.type}:${period.startDate}:${period.endDate}`:"";}
export function cashbackTransactionTimestamp(transaction){return localTimestamp(`${storageDate(transaction?.date)}T${String(transaction?.transactionTime||"00:00:00")}`);}
export function normalizePackageHistory(history=[],packageIds=[],card){
  const allowed=new Set(packageIds);
  return (Array.isArray(history)?history:[]).filter(item=>allowed.has(String(item?.packageId||""))&&localTimestamp(item?.effectiveFrom)).map((item,index)=>{const effectiveFrom=localTimestamp(item.effectiveFrom),effectiveTo=item.effectiveTo?localTimestamp(item.effectiveTo):null,inferredPeriod=card?getCashbackPeriodForCard(card,effectiveFrom):null;return {id:String(item.id||`PACKAGE-HISTORY-${index+1}`),periodKey:String(item.periodKey||cashbackPackagePeriodKey(inferredPeriod)),packageId:String(item.packageId),effectiveFrom,effectiveTo};}).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
}
export function normalizeCashbackPackageProgram(program={},mccCategories=[],card){
  if(!hasCashbackPackages(program))return normalizeCashbackGroup(program,mccCategories);
  const packages=program.packages.map((item,packageIndex)=>{const packageId=String(item?.id||`${program.id||"PROGRAM"}-PACKAGE-${packageIndex+1}`);return {...item,id:packageId,name:String(item?.name||`Gói ${packageIndex+1}`),groups:(item?.groups||[]).map((group,groupIndex)=>normalizeCashbackGroup({...group,id:group.id||`${packageId}-GROUP-${groupIndex+1}`,cardId:program.cardId},mccCategories))};});
  return {...program,id:String(program.id||""),name:String(program.name||""),cardId:String(program.cardId||""),conditionMode:normalizeConditionMode(program.conditionMode),totalSpendMinimum:program.totalSpendMinimum==null||program.totalSpendMinimum===""?null:Math.max(0,Number(program.totalSpendMinimum)||0),maxCashbackPerPeriod:program.maxCashbackPerPeriod==null||program.maxCashbackPerPeriod===""?null:Math.max(0,Number(program.maxCashbackPerPeriod)||0),packageSwitchLimit:Math.max(0,Number(program.packageSwitchLimit)||0),packages,packageHistory:normalizePackageHistory(program.packageHistory,packages.map(item=>item.id),card)};
}
export function getPackageHistoryForPeriod(program,period){const key=cashbackPackagePeriodKey(period);return normalizePackageHistory(program?.packageHistory,program?.packages?.map(item=>item.id)||[]).filter(item=>item.periodKey?item.periodKey===key:isDateInCashbackPeriod(item.effectiveFrom,period));}
export function getActivePackageHistory(program,period,referenceTimestamp){const timestamp=localTimestamp(referenceTimestamp);return [...getPackageHistoryForPeriod(program,period)].reverse().find(item=>item.effectiveFrom<=timestamp&&(!item.effectiveTo||timestamp<item.effectiveTo))||null;}
export function getActiveCashbackPackage(program,period,referenceTimestamp){if(!hasCashbackPackages(program))return null;const entry=getActivePackageHistory(program,period,referenceTimestamp);return entry?program.packages.find(item=>item.id===entry.packageId)||null:null;}
export function getPackageSwitchCount(program,period){const history=getPackageHistoryForPeriod(program,period);return history.reduce((count,item,index)=>count+(index>0&&history[index-1].packageId!==item.packageId?1:0),0);}
export function getRemainingPackageSwitches(program,period){return Math.max(0,(Number(program?.packageSwitchLimit)||0)-getPackageSwitchCount(program,period));}
function runtimeProgram(program,card){return {...program,packageHistory:normalizePackageHistory(program?.packageHistory,program?.packages?.map(item=>item.id)||[],card)};}
export function initializePeriodPackage(program,packageId,period){
  const normalized=runtimeProgram(program),target=normalized.packages.find(item=>item.id===packageId);
  if(!target)return {error:"Gói hoàn tiền không hợp lệ."};
  if(getPackageHistoryForPeriod(normalized,period).length)return {error:"Gói hoàn tiền đầu kỳ đã được thiết lập."};
  const history=[...normalized.packageHistory,{id:`${normalized.id}-PACKAGE-HISTORY-${cashbackPackagePeriodKey(period)}-${idPart(packageId)}`,periodKey:cashbackPackagePeriodKey(period),packageId,effectiveFrom:`${period.startDate}T00:00:00`,effectiveTo:null}];
  return {program:{...normalized,packageHistory:history},period};
}
export function switchCashbackPackage(program,packageId,effectiveTimestamp,card){
  const normalized=runtimeProgram(program,card),timestamp=localTimestamp(effectiveTimestamp),target=normalized.packages.find(item=>item.id===packageId);
  if(!target)return {error:"Gói hoàn tiền không hợp lệ."};
  const period=getCashbackPeriodForCard(card,timestamp);
  if(!isDateInCashbackPeriod(timestamp,period))return {error:"Thời điểm đổi gói không thuộc kỳ cashback hiện tại."};
  const currentEntry=getActivePackageHistory(normalized,period,timestamp),current=getActiveCashbackPackage(normalized,period,timestamp);
  if(!currentEntry||!current)return {error:"Vui lòng chọn gói hoàn tiền ban đầu."};
  if(current.id===packageId)return {error:"Gói hoàn tiền này đang được sử dụng."};
  if(getRemainingPackageSwitches(normalized,period)<=0)return {error:"Đã sử dụng hết số lần đổi gói trong kỳ."};
  const history=normalized.packageHistory.map(item=>item.id===currentEntry.id?{...item,effectiveTo:timestamp}:{...item});
  history.push({id:`${normalized.id}-PACKAGE-HISTORY-${Date.now()}-${idPart(packageId)}`,periodKey:cashbackPackagePeriodKey(period),packageId,effectiveFrom:timestamp,effectiveTo:null});
  return {program:{...normalized,packageHistory:history},period};
}
export function resolvePackageForTransaction(program,transaction,card){const timestamp=cashbackTransactionTimestamp(transaction),period=getCashbackPeriodForCard(card,timestamp);return getActiveCashbackPackage(program,period,timestamp);}

export function packageHistoryForCarriedProgram(program,targetPeriod,sourcePeriod){if(!hasCashbackPackages(program))return undefined;const ending=getActiveCashbackPackage(program,sourcePeriod,`${sourcePeriod.endDate}T23:59:59`);return ending?initializePeriodPackage({...program,packageHistory:[]},ending.id,targetPeriod).program.packageHistory:[];}
