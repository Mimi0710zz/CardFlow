const normalizedFilterValue=value=>String(value??"");

export function toFilterSet(value){
  if(value instanceof Set)return new Set([...value].map(normalizedFilterValue).filter(Boolean));
  if(Array.isArray(value))return new Set(value.map(normalizedFilterValue).filter(Boolean));
  const normalized=normalizedFilterValue(value);
  return new Set(normalized?[normalized]:[]);
}

export function cloneFilterState(state={}){
  return Object.fromEntries(Object.entries(state).map(([key,value])=>[key,value instanceof Set?new Set(value):value]));
}

export function clearFilterState(state={}){
  return Object.fromEntries(Object.entries(state).map(([key,value])=>[key,value instanceof Set?new Set():typeof value==="boolean"?false:""]));
}

export function matchesMultiFilter(value,selectedValues){
  const selected=toFilterSet(selectedValues);
  return selected.size===0||selected.has(normalizedFilterValue(value));
}

export function activeFilterValueCount(state={}){
  return Object.values(state).reduce((count,value)=>count+(value instanceof Set?value.size:value?1:0),0);
}

export function selectAllState(options=[],selectedValues){
  const values=options.map(option=>normalizedFilterValue(option?.value)).filter(value=>value&&value!=="all");
  if(values.length===0)return {checked:false,indeterminate:false};
  const selected=toFilterSet(selectedValues),selectedCount=values.filter(value=>selected.has(value)).length;
  return {checked:selectedCount===values.length,indeterminate:selectedCount>0&&selectedCount<values.length};
}

export function toggleAllFilterValues(options=[],checked){
  if(!checked)return new Set();
  return new Set(options.map(option=>normalizedFilterValue(option?.value)).filter(value=>value&&value!=="all"));
}
