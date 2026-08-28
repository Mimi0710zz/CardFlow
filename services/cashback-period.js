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
