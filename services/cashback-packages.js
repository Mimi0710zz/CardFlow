import { normalizeCashbackGroup } from "./cashback.js";
import { getCashbackPeriodForCard, isDateInCashbackPeriod } from "./cashback-period.js";

const dateValue=value=>String(value||"").slice(0,10);
const idPart=value=>String(value||"").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"ITEM";

export function hasCashbackPackages(program){
  return Array.isArray(program?.packages)&&program.packages.length>0;
}

export function normalizePackageHistory(history=[],packageIds=[]){
  const allowed=new Set(packageIds);
  return (Array.isArray(history)?history:[]).filter(item=>allowed.has(String(item?.packageId||""))&&dateValue(item?.effectiveFrom)).map((item,index)=>({
    id:String(item.id||`PACKAGE-HISTORY-${index+1}`),packageId:String(item.packageId),effectiveFrom:dateValue(item.effectiveFrom),effectiveTo:item.effectiveTo?dateValue(item.effectiveTo):null
  })).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
}

export function normalizeCashbackPackageProgram(program={},mccCategories=[]){
  if(!hasCashbackPackages(program)) return normalizeCashbackGroup(program,mccCategories);
  const packages=program.packages.map((item,packageIndex)=>{
    const packageId=String(item?.id||`${program.id||"PROGRAM"}-PACKAGE-${packageIndex+1}`);
    return {...item,id:packageId,name:String(item?.name||`Gói ${packageIndex+1}`),groups:(item?.groups||[]).map((group,groupIndex)=>normalizeCashbackGroup({...group,id:group.id||`${packageId}-GROUP-${groupIndex+1}`,cardId:program.cardId},mccCategories))};
  });
  return {...program,id:String(program.id||""),name:String(program.name||""),cardId:String(program.cardId||""),totalSpendMinimum:program.totalSpendMinimum==null||program.totalSpendMinimum===""?null:Math.max(0,Number(program.totalSpendMinimum)||0),maxCashbackPerPeriod:program.maxCashbackPerPeriod==null||program.maxCashbackPerPeriod===""?null:Math.max(0,Number(program.maxCashbackPerPeriod)||0),packageSwitchLimit:Math.max(0,Number(program.packageSwitchLimit)||0),packages,packageHistory:normalizePackageHistory(program.packageHistory,packages.map(item=>item.id))};
}

export function activeCashbackPackage(program,referenceDate){
  if(!hasCashbackPackages(program)) return null;
  const date=dateValue(referenceDate);
  const history=normalizePackageHistory(program.packageHistory,program.packages.map(item=>item.id));
  const entry=[...history].reverse().find(item=>item.effectiveFrom<=date&&(!item.effectiveTo||date<item.effectiveTo));
  return program.packages.find(item=>item.id===(entry?.packageId||program.packages[0]?.id))||null;
}

export function packageSwitchCount(program,period){
  if(!period) return 0;
  const history=normalizePackageHistory(program?.packageHistory,program?.packages?.map(item=>item.id)||[]);
  return history.filter((item,index)=>index>0&&history[index-1].packageId!==item.packageId&&isDateInCashbackPeriod(item.effectiveFrom,period)).length;
}

export function remainingPackageSwitches(program,period){
  return Math.max(0,(Number(program?.packageSwitchLimit)||0)-packageSwitchCount(program,period));
}

export function switchCashbackPackage(program,packageId,effectiveDate,card){
  const normalized=normalizeCashbackPackageProgram(program);
  const target=normalized.packages.find(item=>item.id===packageId);
  if(!target) return {error:"Gói hoàn tiền không hợp lệ."};
  const period=getCashbackPeriodForCard(card,effectiveDate);
  if(!isDateInCashbackPeriod(effectiveDate,period)) return {error:"Ngày đổi gói không thuộc kỳ cashback hiện tại."};
  const current=activeCashbackPackage(normalized,effectiveDate);
  if(current?.id===packageId) return {error:"Gói hoàn tiền này đang được sử dụng."};
  if(remainingPackageSwitches(normalized,period)<=0) return {error:"Đã sử dụng hết số lần đổi gói trong kỳ."};
  const date=dateValue(effectiveDate),history=normalized.packageHistory.map(item=>({...item}));
  const open=[...history].reverse().find(item=>!item.effectiveTo&&item.effectiveFrom<=date);
  if(open) open.effectiveTo=date;
  history.push({id:`${normalized.id}-PACKAGE-HISTORY-${Date.now()}-${idPart(packageId)}`,packageId,effectiveFrom:date,effectiveTo:null});
  return {program:{...normalized,packageHistory:history},period};
}

export function packageHistoryForCarriedProgram(program,targetStartDate,sourceEndDate){
  if(!hasCashbackPackages(program)) return undefined;
  const ending=activeCashbackPackage(program,sourceEndDate)||program.packages[0];
  return ending?[{id:`${program.id}-PACKAGE-HISTORY-${dateValue(targetStartDate)}`,packageId:ending.id,effectiveFrom:dateValue(targetStartDate),effectiveTo:null}]:[];
}
