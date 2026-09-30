import {cloneFilterState,selectAllState,toFilterSet,toggleAllFilterValues} from "./multi-filter.js";

const optionValues=group=>[...group.querySelectorAll("[data-multi-filter-option]")].map(input=>({value:input.value}));

export function filterControlKey(control){
  const dataset=control?.dataset||{};
  return dataset.cardFilter||dataset.transactionFilter||dataset.feeTargetFilter||dataset.paymentFilter||dataset.reminderFilter||"";
}

export function registerMultiFilterOutsideClose(documentTarget,panel,trigger,onClose){
  const handler=event=>{const path=event.composedPath?.()||[];if(path.includes(panel)||path.includes(trigger)||panel?.contains?.(event.target)||trigger?.contains?.(event.target))return;onClose();};
  documentTarget?.addEventListener?.("pointerdown",handler);
  return ()=>documentTarget?.removeEventListener?.("pointerdown",handler);
}

export function renderMultiFilterGroup({key,label,options=[],selectedValues,escape=value=>String(value)}){
  const selected=toFilterSet(selectedValues),items=options.filter(option=>String(option?.value??"")!=="all"),allState=selectAllState(items,selected);
  const selectedLabels=items.filter(option=>selected.has(String(option.value))).map(option=>option.label);
  const summary=selectedLabels.length?`${label} (${selectedLabels.length})`:`${label}: Tất cả`;
  return `<div class="multi-filter-group" data-multi-filter-key="${escape(key)}"><button type="button" class="multi-filter-trigger" data-multi-filter-trigger aria-expanded="false"><span>${escape(summary)}</span><span aria-hidden="true">▾</span></button><div class="multi-filter-menu" data-multi-filter-menu hidden><label class="multi-filter-option multi-filter-all"><input type="checkbox" data-multi-filter-all ${allState.checked?"checked ":""}${items.length?"":"disabled"}> <span>Tất cả</span></label>${items.map(option=>`<label class="multi-filter-option"><input type="checkbox" data-multi-filter-option value="${escape(option.value)}" ${selected.has(String(option.value))?"checked":""}> <span>${escape(option.label)}</span></label>`).join("")}${items.length?"":'<div class="multi-filter-empty">Không có lựa chọn</div>'}</div></div>`;
}

export function readMultiFilterDraft(root,selector="[data-multi-filter-key]",baseState={}){
  const draft=cloneFilterState(baseState);
  root?.querySelectorAll(selector).forEach(group=>{
    draft[group.dataset.multiFilterKey]=new Set([...group.querySelectorAll("[data-multi-filter-option]:checked")].map(input=>input.value));
  });
  return draft;
}

export function syncMultiFilterSelectAll(group){
  const all=group?.querySelector("[data-multi-filter-all]");
  if(!all)return;
  const options=optionValues(group),selected=new Set([...group.querySelectorAll("[data-multi-filter-option]:checked")].map(input=>input.value)),state=selectAllState(options,selected);
  all.checked=state.checked;
  all.indeterminate=state.indeterminate;
}

export function wireMultiFilterGroups(root){
  root?.querySelectorAll("[data-multi-filter-key]").forEach(group=>{
    const trigger=group.querySelector("[data-multi-filter-trigger]"),menu=group.querySelector("[data-multi-filter-menu]"),all=group.querySelector("[data-multi-filter-all]");
    trigger?.addEventListener("click",()=>{const open=menu.hidden;menu.hidden=!open;trigger.setAttribute("aria-expanded",String(open));});
    all?.addEventListener("change",()=>{const selected=toggleAllFilterValues(optionValues(group),all.checked);group.querySelectorAll("[data-multi-filter-option]").forEach(input=>{input.checked=selected.has(input.value);});syncMultiFilterSelectAll(group);});
    group.querySelectorAll("[data-multi-filter-option]").forEach(input=>input.addEventListener("change",()=>syncMultiFilterSelectAll(group)));
    syncMultiFilterSelectAll(group);
  });
}
