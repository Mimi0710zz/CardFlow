import { MB_PLATINUM_PACKAGE_IDS, isMbPlatinumCard, mbPlatinumPackageLabel } from "./mb-platinum-cashback.js";

export const CASHBACK_CONDITION_MODES=Object.freeze(["independent","first_match","supporting","all_required"]);

export function normalizeConditionMode(value){
  return CASHBACK_CONDITION_MODES.includes(value)?value:"independent";
}

export function programsForCard(programs=[],cardId=""){
  return (Array.isArray(programs)?programs:[]).filter(program=>String(program?.cardId||"")===String(cardId||""));
}

export function buildCashbackMccOptionItems(mccCategories=[]){
  return (Array.isArray(mccCategories)?mccCategories:[]).map(item=>({
    value:String(item?.id||""),
    label:String(item?.name||"").trim()
  })).filter(item=>item.value).sort((left,right)=>left.label.localeCompare(right.label,"vi",{numeric:true,sensitivity:"base"}));
}

export function deriveProgramMaxCashback(program={}){
  if(!Array.isArray(program?.conditions)&&!Array.isArray(program?.packages))return program?.maxCashbackUnlimited===true||program?.maxType==="UNLIMITED"?0:Math.max(0,Number(program?.max)||0);
  const conditions=Array.isArray(program?.packages)&&program.packages.length
    ? program.packages.flatMap(pkg=>(pkg.groups||[]).flatMap(group=>group.conditions||[]))
    : (program.conditions||[]);
  return conditions.reduce((total,condition)=>{
    const unlimited=condition?.maxCashbackUnlimited===true||condition?.maxType==="UNLIMITED";
    return total+(unlimited?0:Math.max(0,Number(condition?.max)||0));
  },0);
}

export function snapshotCashbackProgram(program){
  return program?.id?JSON.parse(JSON.stringify(program)):null;
}

export function cashbackProgramSnapshotKey(program={}){
  return `${program.year??""}-${program.month??""}-${program.id||""}`;
}

export function cacheCashbackProgramSnapshot(cache,program){
  const snapshot=snapshotCashbackProgram(program);
  if(snapshot&&cache?.set)cache.set(cashbackProgramSnapshotKey(snapshot),snapshot);
  return snapshot;
}

export function restoreCashbackProgramSnapshot(programs=[],snapshot=null){
  if(!snapshot?.id)return Array.isArray(programs)?programs:[];
  const key=cashbackProgramSnapshotKey(snapshot);
  return (Array.isArray(programs)?programs:[]).map(program=>cashbackProgramSnapshotKey(program)===key?snapshotCashbackProgram(snapshot):program);
}

export function resolveCashbackProgramSelection({cards=[],programs=[],cardId="",programId="",packageId=""}={}){
  const availableCards=Array.isArray(cards)?cards:[];
  const selectedCard=availableCards.find(card=>card.id===cardId);
  const cardPrograms=programsForCard(programs,selectedCard?.id);
  const selectedProgram=cardPrograms.find(program=>program.id===programId)||cardPrograms[0];
  const packages=Array.isArray(selectedProgram?.packages)?selectedProgram.packages:[];
  const selectedPackage=packages.find(item=>item.id===packageId)||packages[0];
  return {cardId:selectedCard?.id||"",programId:selectedProgram?.id||"",packageId:selectedProgram?.packageId||selectedPackage?.id||""};
}

function packageFor(program,packageId){
  return (program?.packages||[]).find(item=>item.id===packageId);
}

function groupsFor(program,packageId){
  if(Array.isArray(program?.packages)&&program.packages.length)return packageFor(program,packageId)?.groups||[];
  return [program];
}

export function visibleCashbackConditions(program={},packageId=""){
  if(!Array.isArray(program?.conditions)&&!Array.isArray(program?.packages))return [{condition:program,group:program,groupIndex:0,conditionIndex:0,ref:{packageId:String(program.packageId||""),groupId:String(program.id||""),conditionId:String(program.id||"")}}];
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
  if(!Array.isArray(program?.conditions)&&!Array.isArray(program?.packages))return String(program.id||"")===String(ref.conditionId||program.id||"")?{...program,...draft,id:program.id}:program;
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

export function buildCashbackProgramEditorModel({cards=[],programs=[],cashbackCardConfigs=[],selection={}}={}){
  const resolved=resolveCashbackProgramSelection({...selection,cards,programs});
  const selectedCard=cards.find(card=>card.id===resolved.cardId)||null;
  const cardPrograms=programsForCard(programs,resolved.cardId);
  const selectedProgram=cardPrograms.find(program=>program.id===resolved.programId)||null;
  const mb=isMbPlatinumCard(selectedCard?.id),packages=Array.isArray(selectedProgram?.packages)?selectedProgram.packages:[];
  const selectedPackage=packages.find(item=>item.id===resolved.packageId)||null;
  const packageOptions=mb?MB_PLATINUM_PACKAGE_IDS.map(id=>({value:id,label:mbPlatinumPackageLabel(id)})):packages.map(item=>({value:item.id,label:item.name||item.id}));
  return {
    selection:resolved,
    selectedCard,
    selectedProgram,
    selectedPackage,
    programs:cardPrograms,
    cardOptions:cards.map(card=>({value:card.id,label:card.id})).sort((left,right)=>left.label.localeCompare(right.label,"vi",{numeric:true,sensitivity:"base"})),
    programOptions:cardPrograms.map(program=>({value:program.id,label:program.name||program.id})),
    packageOptions,
    selectedPackageId:selectedProgram?.packageId||resolved.packageId||"",
    cardConfig:(cashbackCardConfigs||[]).find(config=>config.cardId===selectedCard?.id)||null,
    mbPlatinum:mb,
    conditions:selectedProgram?visibleCashbackConditions(selectedProgram,resolved.packageId):[]
  };
}

function optionMarkup(options,selected,escape){
  return options.map(option=>`<option value="${escape(option.value)}" ${option.value===selected?"selected":""}>${escape(option.label)}</option>`).join("");
}

function moneyInputMarkup({attribute,value,escape,disabled=false,readonly=false,ariaLabel="",placeholder=""}){
  return `<div class="money-input cashback-money-input"><input ${attribute} inputmode="numeric" value="${escape(value??"")}" ${disabled?"disabled":""} ${readonly?"readonly":""} ${ariaLabel?`aria-label="${escape(ariaLabel)}"`:""} ${placeholder?`placeholder="${escape(placeholder)}"`:""}><span>đ</span></div>`;
}

function cashbackRateInputMarkup(condition,escape){
  const percentage=((Number(condition?.rate)||0)*100).toFixed(1);
  return `<div class="cashback-rate-input"><input data-condition-rate inputmode="decimal" value="${escape(percentage)}"><span>%</span></div>`;
}

function conditionMarkup(item,index,mode,helpers){
  const {escape,formatMoney,mccOptions,transactionMethodOptions,calculateSpendToMax}=helpers;
  const condition=item.condition,unlimited=condition.maxCashbackUnlimited===true||condition.maxType==="UNLIMITED";
  const spend=unlimited?null:calculateSpendToMax?.(condition.rate,condition.max);
  const ref=`data-package-id="${escape(item.ref.packageId)}" data-group-id="${escape(item.ref.groupId)}" data-condition-id="${escape(item.ref.conditionId)}"`;
  return `<article class="cashback-program-condition" data-condition-card ${ref}>
    <header><strong>${escape(condition.name||`Chương trình ${index+1}`)}</strong></header>
    <div class="cashback-condition-fields">
      <label class="field"><span>Tên chương trình</span><input data-condition-name value="${escape(condition.name||"")}"></label>
      <div class="field"><span>MCC</span><div class="multi-select cashback-mcc-select"><button type="button" class="multi-select-toggle" data-cashback-mcc-toggle>${escape(helpers.mccSummary?.(condition)||"Chưa chọn")}</button><div class="multi-select-panel">${mccOptions(condition)}</div></div></div>
      <label class="field"><span>Hình thức giao dịch</span><select data-condition-channel>${transactionMethodOptions(condition.channel)}</select></label>
      <label class="field"><span>Tỷ lệ hoàn</span>${cashbackRateInputMarkup(condition,escape)}</label>
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
  const packageSection=model.mbPlatinum?`<section class="cashback-program-section"><h3>GÓI CASHBACK MB PLATINUM</h3><label class="field cashback-package-selector"><span>Gói</span><select data-program-package-id><option value="">Chọn Gói</option>${optionMarkup(model.packageOptions,model.selectedPackageId,escape)}</select></label><label class="field"><span>Mức chi tối thiểu kỳ sao kê</span>${moneyInputMarkup({attribute:"data-card-statement-min",value:formatMoney(model.cardConfig?.statementMinSpend??5000000),escape})}</label></section>`:"";
  return `<section class="cashback-program-workflow">${selectors}
    <section class="cashback-program-section cashback-calculation-layout"><div class="cashback-mode-panel"><h3>CÁCH TÍNH CASHBACK</h3><div class="cashback-condition-modes">
      <label><input type="radio" name="cashbackConditionMode" value="independent" ${mode==="independent"?"checked":""}> Hoàn tiền độc lập</label>
      <label><input type="radio" name="cashbackConditionMode" value="first_match" ${mode==="first_match"?"checked":""}> Chương trình đạt trước được ưu tiên</label>
      <label><input type="radio" name="cashbackConditionMode" value="supporting" ${mode==="supporting"?"checked":""}> Các chương trình bổ trợ cho nhau</label>
      <label><input type="radio" name="cashbackConditionMode" value="all_required" ${mode==="all_required"?"checked":""}> Tất cả chương trình đều phải đạt</label>
    </div></div><div class="cashback-total-spend-panel"><h3>YÊU CẦU DOANH SỐ</h3><div class="cashback-total-spend-control"><label class="check-field"><input type="checkbox" data-program-total-enabled aria-label="Bật yêu cầu doanh số" ${requiresTotal?"checked":""}></label>${moneyInputMarkup({attribute:"data-program-total-min",value:formatMoney(program.totalSpendMinimum),escape,disabled:!requiresTotal,ariaLabel:"Tiền yêu cầu tổng doanh số",placeholder:"Tiền yêu cầu tổng doanh số"})}</div></div></section>
    ${packageSection}
    <section class="cashback-program-section"><h3>CHƯƠNG TRÌNH CASHBACK</h3><div class="cashback-program-condition-list">${(model.conditions||[]).map((item,index)=>conditionMarkup(item,index,mode,renderHelpers)).join("")}</div></section>
    <div class="cashback-program-save"><button type="button" class="secondary-btn" data-cancel-program>Huỷ</button><button type="button" class="primary" data-save-program>Lưu thay đổi</button></div>
  </section>`;
}

export function cashbackStructureSelection(selection={},target={}){
  return {cardId:selection.cardId||"",programId:target.programId||"",packageId:target.packageId||""};
}

export function renderCashbackProgramStructure(model={},helpers={}){
  const escape=helpers.escape||String,selected=model.selection||{};
  const programs=(model.programs||[]).map((program,programIndex)=>`<li class="cashback-structure-program ${program.id===selected.programId?"is-selected":""}"><button type="button" data-structure-program-id="${escape(program.id)}">${programIndex+1}. ${escape(program.name||program.id)}${program.packageId?` <small>(${escape(mbPlatinumPackageLabel(program.packageId))})</small>`:""}</button></li>`).join("");
  return `<aside class="cashback-program-structure" aria-label="Cấu trúc chương trình"><h3>CẤU TRÚC CHƯƠNG TRÌNH</h3><p class="cashback-structure-card">Thẻ: ${escape(model.selectedCard?.id||"—")}</p>${programs?`<ol>${programs}</ol>`:'<p class="empty-state">Chưa có chương trình cashback.</p>'}</aside>`;
}

export function renderCashbackProgramPage(model={},helpers={}){
  return `<div class="cashback-program-layout"><div class="cashback-program-main">${renderCashbackProgramEditor(model,helpers)}<div data-cashback-runtime-root></div></div>${renderCashbackProgramStructure(model,helpers)}</div>`;
}
