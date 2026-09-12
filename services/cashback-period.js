import { toStorageDate } from "./date.js";
import { getEffectiveMonthlyDay } from "./payment-due.js";

function storageDate(value){
  return value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`
    : toStorageDate(value);
}

function addLocalDays(value,days){
  return new Date(value.getFullYear(),value.getMonth(),value.getDate()+days);
}

export function getCashbackPeriodForCard(card,referenceDate=new Date()){
  const reference=storageDate(referenceDate);
  if(!reference) return null;
  const [year,month,day]=reference.split("-").map(Number);
  const monthlyPeriod=()=>({
    type:"monthly",
    startDate:storageDate(new Date(year,month-1,1)),
    endDate:storageDate(new Date(year,month,0))
  });
  if(card?.cashbackCycle!=="statement") return monthlyPeriod();

  const statementDate=getEffectiveMonthlyDay(year,month,card.statementDay);
  if(!statementDate) return monthlyPeriod();
  const currentDate=new Date(year,month-1,day);
  let startStatement,endStatement;
  if(currentDate<=statementDate){
    startStatement=getEffectiveMonthlyDay(year,month-1,card.statementDay);
    endStatement=statementDate;
  }else{
    startStatement=statementDate;
    endStatement=getEffectiveMonthlyDay(year,month+1,card.statementDay);
  }
  return {
    type:"statement",
    startDate:storageDate(addLocalDays(startStatement,1)),
    endDate:storageDate(endStatement)
  };
}

export function isDateInCashbackPeriod(value,period){
  const date=storageDate(value);
  return Boolean(date&&period?.startDate&&period?.endDate&&date>=period.startDate&&date<=period.endDate);
}

export function getCashbackReferenceDate(year,month,today=new Date()){
  const lastDay=new Date(Number(year),Number(month),0).getDate();
  return new Date(Number(year),Number(month)-1,Math.min(today.getDate(),lastDay));
}

export function cashbackPeriod(year, month){
  const date=new Date(Number(year),Number(month)-1,1);
  return {year:date.getFullYear(),month:date.getMonth()+1,key:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`};
}

export function previousCashbackPeriod(year, month){
  return cashbackPeriod(year,Number(month)-1);
}

export function cashbackProgramsForPeriod(programs=[], year, month){
  return programs.filter(program=>Number(program.year)===Number(year) && Number(program.month)===Number(month));
}

function copiedProgramId(program,target,usedIds){
  const base=`${program.id || "CASHBACK"}-${target.key.replace("-","")}`;
  let id=base;
  let suffix=2;
  while(usedIds.has(id)){
    id=`${base}-${suffix}`;
    suffix+=1;
  }
  usedIds.add(id);
  return id;
}

export function carryForwardCashbackPrograms(programs=[], year, month){
  const target=cashbackPeriod(year,month);
  if(cashbackProgramsForPeriod(programs,target.year,target.month).length) return {programs,copiedCount:0,source:null};
  const source=previousCashbackPeriod(target.year,target.month);
  const sourcePrograms=cashbackProgramsForPeriod(programs,source.year,source.month);
  if(!sourcePrograms.length) return {programs,copiedCount:0,source};
  const usedIds=new Set(programs.map(program=>program.id).filter(Boolean));
  const copies=sourcePrograms.map(program=>{
    const copy=JSON.parse(JSON.stringify(program));
    return {...copy,id:copiedProgramId(program,target,usedIds),year:target.year,month:target.month,carriedFromPeriod:source.key,carriedFromProgramId:program.id || ""};
  });
  return {programs:[...programs,...copies],copiedCount:copies.length,source};
}
