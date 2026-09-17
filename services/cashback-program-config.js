export const CASHBACK_CONDITION_MODES=Object.freeze(["independent","first_match","all_required"]);

export function normalizeConditionMode(value){
  return CASHBACK_CONDITION_MODES.includes(value)?value:"independent";
}

export function programsForCard(programs=[],cardId=""){
  return (Array.isArray(programs)?programs:[]).filter(program=>String(program?.cardId||"")===String(cardId||""));
}

export function resolveCashbackProgramSelection({cards=[],programs=[],cardId="",programId="",packageId=""}={}){
  const availableCards=Array.isArray(cards)?cards:[];
  const selectedCard=availableCards.find(card=>card.id===cardId)||availableCards[0];
  const cardPrograms=programsForCard(programs,selectedCard?.id);
  const selectedProgram=cardPrograms.find(program=>program.id===programId)||cardPrograms[0];
  const packages=Array.isArray(selectedProgram?.packages)?selectedProgram.packages:[];
  const selectedPackage=packages.find(item=>item.id===packageId)||packages[0];
  return {cardId:selectedCard?.id||"",programId:selectedProgram?.id||"",packageId:selectedPackage?.id||""};
}

function packageFor(program,packageId){
  return (program?.packages||[]).find(item=>item.id===packageId);
}

function groupsFor(program,packageId){
  if(Array.isArray(program?.packages)&&program.packages.length)return packageFor(program,packageId)?.groups||[];
  return [program];
}

export function visibleCashbackConditions(program={},packageId=""){
  return groupsFor(program,packageId).flatMap((group,groupIndex)=>(group?.conditions||[]).map((condition,conditionIndex)=>({
    condition,
    group,
    groupIndex,
    conditionIndex,
    ref:{packageId:packageId||"",groupId:String(group?.id||program?.id||""),conditionId:String(condition?.id||"")}
  })));
}

function updateGroups(program,packageId,updater){
  if(Array.isArray(program?.packages)&&program.packages.length){
    return {...program,packages:program.packages.map(pkg=>pkg.id===packageId?{...pkg,groups:updater(pkg.groups||[])}:pkg)};
  }
  return updater([program])[0]||program;
}

function uniqueConditionId(program,base="CONDITION"){
  const used=new Set((program?.packages||[]).flatMap(pkg=>visibleCashbackConditions(program,pkg.id)).concat(visibleCashbackConditions(program)).map(item=>item.condition.id));
  let id=String(base||"CONDITION"),suffix=2;
  while(used.has(id)){id=`${base}-${suffix++}`;}
  return id;
}

export function addCashbackCondition(program={},scope={},draft={}){
  const conditionId=uniqueConditionId(program,draft.id||`${program.id||"PROGRAM"}-COND`);
  const condition={...draft,id:conditionId,name:String(draft.name||"")};
  const groupId=`${program.id||"PROGRAM"}-GROUP-${conditionId}`;
  const group={id:groupId,name:condition.name,conditionCombination:"OR",totalSpendMinimum:null,note:"",conditions:[condition]};
  if(Array.isArray(program.packages)&&program.packages.length)return updateGroups(program,scope.packageId,groups=>[...groups,group]);
  return {...program,conditions:[...(program.conditions||[]),condition]};
}

export function updateCashbackCondition(program={},ref={},draft={}){
  return updateGroups(program,ref.packageId,groups=>groups.map(group=>{
    if(String(group.id||program.id||"")!==String(ref.groupId||""))return group;
    return {...group,conditions:(group.conditions||[]).map(condition=>condition.id===ref.conditionId?{...condition,...draft,id:condition.id}:condition)};
  }));
}

export function removeCashbackCondition(program={},ref={}){
  return updateGroups(program,ref.packageId,groups=>groups.map(group=>{
    if(String(group.id||program.id||"")!==String(ref.groupId||""))return group;
    return {...group,conditions:(group.conditions||[]).filter(condition=>condition.id!==ref.conditionId)};
  }).filter(group=>group===program||(group.conditions||[]).length));
}

export function moveCashbackCondition(program={},ref={},direction=0){
  const step=direction<0?-1:direction>0?1:0;
  if(!step)return program;
  return updateGroups(program,ref.packageId,groups=>groups.map(group=>{
    if(String(group.id||program.id||"")!==String(ref.groupId||""))return group;
    const conditions=[...(group.conditions||[])],index=conditions.findIndex(item=>item.id===ref.conditionId),target=index+step;
    if(index<0||target<0||target>=conditions.length)return group;
    [conditions[index],conditions[target]]=[conditions[target],conditions[index]];
    return {...group,conditions};
  }));
}
