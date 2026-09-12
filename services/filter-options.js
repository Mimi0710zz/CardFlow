export function compareNaturalFilterText(left,right){
  return String(left??"").trim().localeCompare(String(right??"").trim(),"vi",{numeric:true,sensitivity:"base"});
}

export function sortedUniqueFilterOptions(items=[],valueFn=item=>item,labelFn=item=>item){
  const seen=new Set();
  return items.reduce((options,item)=>{
    const value=String(valueFn(item)??"");
    if(!value||seen.has(value)) return options;
    seen.add(value);
    options.push({value,label:String(labelFn(item)??"")});
    return options;
  },[]).sort((left,right)=>compareNaturalFilterText(left.label,right.label)||compareNaturalFilterText(left.value,right.value));
}
