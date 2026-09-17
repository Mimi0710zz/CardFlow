export const CASHBACK_CONDITION_MODES=Object.freeze(["independent","first_match","all_required"]);

export function normalizeConditionMode(value){
  return CASHBACK_CONDITION_MODES.includes(value)?value:"independent";
}

export function programsForCard(programs=[],cardId=""){
  return (Array.isArray(programs)?programs:[]).filter(program=>String(program?.cardId||"")===String(cardId||""));
}

export function buildCashbackMccOptionItems(mccCategories=[]){
  return (Array.isArray(mccCategories)?mccCategories:[]).map(item=>({
    value:String(item?.id||""),
    label:`${String(item?.name||"")} (${String(item?.mcc??"")})`
  })).filter(item=>item.value).sort((left,right)=>left.label.localeCompare(right.label,"vi",{numeric:true,sensitivity:"base"}));
}

export function resolveCashbackProgramSelection({cards=[],programs=[],cardId="",programId="",packageId=""}={}){
  const availableCards=Array.isArray(cards)?cards:[];
  const selectedCard=availableCards.find(card=>card.id===cardId);
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
  if(!Array.isArray(program?.packages)||!program.packages.length){
    return {...program,conditions:(program.conditions||[]).filter(condition=>condition.id!==ref.conditionId)};
  }
  return updateGroups(program,ref.packageId,groups=>groups.map(group=>{
    if(String(group.id||program.id||"")!==String(ref.groupId||""))return group;
    return {...group,conditions:(group.conditions||[]).filter(condition=>condition.id!==ref.conditionId)};
  }).filter(group=>group===program||(group.conditions||[]).length));
}

export function moveCashbackCondition(program={},ref={},direction=0){
  const step=direction<0?-1:direction>0?1:0;
  if(!step)return program;
  return updateGroups(program,ref.packageId,groups=>{
    const flat=groups.flatMap((group,groupIndex)=>(group.conditions||[]).map((condition,conditionIndex)=>({group,groupIndex,condition,conditionIndex})));
    const index=flat.findIndex(item=>item.condition.id===ref.conditionId&&String(item.group.id||program.id||"")===String(ref.groupId||"")),targetIndex=index+step;
    if(index<0||targetIndex<0||targetIndex>=flat.length)return groups;
    const current=flat[index],target=flat[targetIndex];
    if(current.groupIndex===target.groupIndex){
      return groups.map((group,groupIndex)=>{if(groupIndex!==current.groupIndex)return group;const conditions=[...group.conditions];[conditions[current.conditionIndex],conditions[target.conditionIndex]]=[conditions[target.conditionIndex],conditions[current.conditionIndex]];return {...group,conditions};});
    }
    const reordered=[...groups];
    [reordered[current.groupIndex],reordered[target.groupIndex]]=[reordered[target.groupIndex],reordered[current.groupIndex]];
    return reordered;
  });
}

export function buildCashbackProgramEditorModel({cards=[],programs=[],selection={}}={}){
  const resolved=resolveCashbackProgramSelection({...selection,cards,programs});
  const selectedCard=cards.find(card=>card.id===resolved.cardId)||null;
  const cardPrograms=programsForCard(programs,resolved.cardId);
  const selectedProgram=cardPrograms.find(program=>program.id===resolved.programId)||null;
  const packages=Array.isArray(selectedProgram?.packages)?selectedProgram.packages:[];
  const selectedPackage=packages.find(item=>item.id===resolved.packageId)||null;
  return {
    selection:resolved,
    selectedCard,
    selectedProgram,
    selectedPackage,
    programs:cardPrograms,
    cardOptions:cards.map(card=>({value:card.id,label:card.id})).sort((left,right)=>left.label.localeCompare(right.label,"vi",{numeric:true,sensitivity:"base"})),
    programOptions:cardPrograms.map(program=>({value:program.id,label:program.name||program.id})),
    packageOptions:packages.map(item=>({value:item.id,label:item.name||item.id})),
    conditions:selectedProgram?visibleCashbackConditions(selectedProgram,resolved.packageId):[]
  };
}

function optionMarkup(options,selected,escape){
  return options.map(option=>`<option value="${escape(option.value)}" ${option.value===selected?"selected":""}>${escape(option.label)}</option>`).join("");
}

function moneyInputMarkup({attribute,value,escape,disabled=false,readonly=false}){
  return `<div class="money-input cashback-money-input"><input ${attribute} inputmode="numeric" value="${escape(value??"")}" ${disabled?"disabled":""} ${readonly?"readonly":""}><span>đ</span></div>`;
}

function conditionMarkup(item,index,mode,helpers){
  const {escape,formatMoney,mccOptions,transactionMethodOptions,calculateSpendToMax}=helpers;
  const condition=item.condition,unlimited=condition.maxCashbackUnlimited===true||condition.maxType==="UNLIMITED";
  const spend=unlimited?null:calculateSpendToMax?.(condition.rate,condition.max);
  const ref=`data-package-id="${escape(item.ref.packageId)}" data-group-id="${escape(item.ref.groupId)}" data-condition-id="${escape(item.ref.conditionId)}"`;
  return `<article class="cashback-program-condition" data-condition-card ${ref}>
    <header><strong>${index+1}. ${escape(condition.name||`Điều kiện ${index+1}`)}</strong><div class="cashback-condition-order"><span data-condition-order-actions class="${mode==="first_match"?"":"hidden"}"><button type="button" class="icon-btn" data-move-condition="up" ${index===0?"disabled":""} aria-label="Đưa điều kiện lên">↑</button><button type="button" class="icon-btn" data-move-condition="down" aria-label="Đưa điều kiện xuống">↓</button></span><button type="button" class="icon-btn" data-delete-condition aria-label="Xóa điều kiện">Xóa</button></div></header>
    <div class="cashback-condition-fields">
      <label class="field"><span>Tên điều kiện</span><input data-condition-name value="${escape(condition.name||"")}"></label>
      <div class="field"><span>MCC</span><div class="multi-select cashback-mcc-select"><button type="button" class="multi-select-toggle" data-cashback-mcc-toggle>${escape(helpers.mccSummary?.(condition)||"Chưa chọn")}</button><div class="multi-select-panel">${mccOptions(condition)}</div></div></div>
      <label class="field"><span>Hình thức giao dịch</span><select data-condition-channel>${transactionMethodOptions(condition.channel)}</select></label>
      <label class="field"><span>Tỷ lệ hoàn</span><input data-condition-rate inputmode="decimal" value="${escape((Number(condition.rate)||0)*100)}"></label>
      <label class="field"><span>Giới hạn hoàn</span><select data-condition-max-type><option value="UNLIMITED" ${unlimited?"selected":""}>Không giới hạn</option><option value="LIMITED" ${unlimited?"":"selected"}>Có giới hạn</option></select></label>
      <label class="field"><span>Max hoàn</span>${moneyInputMarkup({attribute:"data-condition-max",value:unlimited?"":formatMoney(condition.max),escape,disabled:unlimited})}</label>
      <label class="field"><span>Chi để đạt Max CB</span>${moneyInputMarkup({attribute:"data-condition-spend-to-max",value:spend==null?"Không áp dụng":formatMoney(spend),escape,readonly:true})}</label>
      <label class="field cashback-condition-spend-minimum"><span>Chi tổng doanh số kèm theo</span>${moneyInputMarkup({attribute:"data-condition-spend-minimum",value:formatMoney(condition.eligibleSpendMinimum),escape})}</label>
      <label class="field cashback-condition-note"><span>Ghi chú</span><textarea data-condition-note>${escape(condition.note||"")}</textarea></label>
    </div>
  </article>`;
}

export function renderCashbackProgramEditor(model={},helpers={}){
  const escape=helpers.escape||String,formatMoney=helpers.formatMoney||(value=>value==null?"":String(value));
  const renderHelpers={...helpers,escape,formatMoney,mccOptions:helpers.mccOptions||(()=>""),transactionMethodOptions:helpers.transactionMethodOptions||(()=>"")};
  const program=model.selectedProgram,selection=model.selection||{};
  const hasCard=Boolean(model.selectedCard),hasPrograms=(model.programOptions||[]).length>0;
  const cardOptions=`<option value="" ${selection.cardId?"":"selected"}>Chọn thẻ</option>${optionMarkup(model.cardOptions||[],selection.cardId,escape)}`;
  const programOptions=hasPrograms?optionMarkup(model.programOptions||[],selection.programId,escape):'<option value="" selected>Chưa có chương trình</option>';
  const selectors=`<div class="cashback-program-selectors"><label class="field"><span>Thẻ</span><select data-cashback-card-select>${cardOptions}</select></label><label class="field"><span>Chương trình</span><select data-cashback-program-select ${hasPrograms?"":"disabled"}>${programOptions}</select></label><div class="cashback-program-actions"><button type="button" class="secondary-btn" data-add-program ${hasCard?"":"disabled"}>+ Thêm chương trình</button>${program?'<button type="button" class="secondary-btn" data-rename-program>Đổi tên</button><button type="button" class="delete-btn" data-delete-program>Xóa</button>':""}</div></div>`;
  if(!model.selectedCard)return `<section class="cashback-program-workflow">${selectors}<p class="empty-state">${(model.cardOptions||[]).length?"Vui lòng chọn thẻ để cấu hình cashback.":"Chưa có thẻ để cấu hình cashback."}</p></section>`;
  if(!program)return `<section class="cashback-program-workflow">${selectors}<p class="empty-state">Thẻ này chưa có chương trình cashback.</p></section>`;
  const mode=normalizeConditionMode(program.conditionMode),requiresTotal=program.totalSpendMinimum!=null;
  const packageSection=(model.packageOptions||[]).length?`<section class="cashback-program-section"><h3>GÓI HOÀN TIỀN</h3><label class="field cashback-package-selector"><span>Gói hoàn tiền</span><select data-cashback-package-select>${optionMarkup(model.packageOptions,selection.packageId,escape)}</select></label></section>`:"";
  return `<section class="cashback-program-workflow">${selectors}
    <section class="cashback-program-section"><h3>THÔNG TIN CHUNG</h3><div class="cashback-program-field-grid"><label class="field"><span>Tên chương trình</span><input data-program-name value="${escape(program.name||"")}"></label><label class="field"><span>Max cashback toàn chương trình</span>${moneyInputMarkup({attribute:"data-program-max",value:formatMoney(program.maxCashbackPerPeriod),escape})}</label></div></section>
    <section class="cashback-program-section cashback-calculation-layout"><div class="cashback-mode-panel"><h3>CÁCH TÍNH CASHBACK</h3><div class="cashback-condition-modes">
      <label><input type="radio" name="cashbackConditionMode" value="independent" ${mode==="independent"?"checked":""}> Các điều kiện hoàn tiền riêng lẻ</label>
      <label><input type="radio" name="cashbackConditionMode" value="first_match" ${mode==="first_match"?"checked":""}> Điều kiện nào đạt trước thì dừng toàn bộ</label>
      <label><input type="radio" name="cashbackConditionMode" value="all_required" ${mode==="all_required"?"checked":""}> Tất cả điều kiện đều phải đạt</label>
    </div></div><div class="cashback-total-spend-panel"><h3>YÊU CẦU DOANH SỐ</h3><label class="check-field"><input type="checkbox" data-program-total-enabled ${requiresTotal?"checked":""}> Yêu cầu tổng doanh số toàn chương trình phải đạt</label><label class="field cashback-program-total ${requiresTotal?"":"hidden"}"><span>Tổng doanh số tối thiểu</span>${moneyInputMarkup({attribute:"data-program-total-min",value:formatMoney(program.totalSpendMinimum),escape})}</label></div></section>
    ${packageSection}
    <section class="cashback-program-section"><h3>ĐIỀU KIỆN CASHBACK</h3><div class="cashback-program-condition-list">${(model.conditions||[]).map((item,index)=>conditionMarkup(item,index,mode,renderHelpers)).join("")}</div><button type="button" class="secondary-btn" data-add-condition>+ Thêm điều kiện</button></section>
    <div class="cashback-program-save"><button type="button" class="primary" data-save-program>Lưu thay đổi</button></div>
  </section>`;
}

export function cashbackStructureSelection(selection={},target={}){
  return {cardId:selection.cardId||"",programId:target.programId||"",packageId:target.packageId||""};
}

export function renderCashbackProgramStructure(model={},helpers={}){
  const escape=helpers.escape||String,selected=model.selection||{};
  const programs=(model.programs||[]).map((program,programIndex)=>{
    const selectedProgram=program.id===selected.programId,packages=Array.isArray(program.packages)?program.packages:[];
    const children=packages.length?packages.map(pkg=>{
      const conditions=visibleCashbackConditions(program,pkg.id);
      return `<li class="cashback-structure-package ${selectedProgram&&pkg.id===selected.packageId?"is-selected":""}"><button type="button" data-structure-program-id="${escape(program.id)}" data-structure-package-id="${escape(pkg.id)}">${escape(pkg.name||pkg.id)}</button><ul>${conditions.map(item=>`<li><button type="button" data-structure-program-id="${escape(program.id)}" data-structure-package-id="${escape(pkg.id)}" data-structure-condition-id="${escape(item.condition.id)}">${escape(item.condition.name||item.condition.id)}</button></li>`).join("")}</ul></li>`;
    }).join(""):`<li class="cashback-structure-conditions"><ul>${visibleCashbackConditions(program).map(item=>`<li><button type="button" data-structure-program-id="${escape(program.id)}" data-structure-condition-id="${escape(item.condition.id)}">${escape(item.condition.name||item.condition.id)}</button></li>`).join("")}</ul></li>`;
    return `<li class="cashback-structure-program ${selectedProgram?"is-selected":""}"><button type="button" data-structure-program-id="${escape(program.id)}">${programIndex+1}. ${escape(program.name||program.id)}</button><ul>${children}</ul></li>`;
  }).join("");
  return `<aside class="cashback-program-structure" aria-label="Cấu trúc chương trình"><h3>CẤU TRÚC CHƯƠNG TRÌNH</h3><p class="cashback-structure-card">Thẻ: ${escape(model.selectedCard?.id||"—")}</p>${programs?`<ol>${programs}</ol>`:'<p class="empty-state">Chưa có chương trình cashback.</p>'}</aside>`;
}

export function renderCashbackProgramPage(model={},helpers={}){
  return `<div class="cashback-program-layout"><div class="cashback-program-main">${renderCashbackProgramEditor(model,helpers)}<div data-cashback-runtime-root></div></div>${renderCashbackProgramStructure(model,helpers)}</div>`;
}
