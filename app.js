import { LocalRepository } from "./services/local-repository.js";
import { DriveAuth } from "./services/drive-auth.js";
import { DriveRepository } from "./services/drive-repository.js";
import { SyncService } from "./services/sync-service.js";
import { cloneSeed } from "./services/default-data.js";
import { buildCardId, normalizeCardNameForId } from "./services/card-id.js";

const localRepository = new LocalRepository();
let state = cloneSeed();
let selectedYear = new Date().getFullYear();
let selectedMonth = new Date().getMonth() + 1;
let currentView = "dashboard";
let setupStep = 0;
let appUnlocked = false;
let startupReconnectAttempting = localRepository.loadMeta().googleConnectionPreferred === true;
let startupReconnectMessage = startupReconnectAttempting ? "Đang kết nối Google Drive..." : "";
let authAttemptId = 0;
const selectedRows = {};
const searchTerms = {};

const VIEW_META = {
  dashboard: {title:"Dashboard", description:"Tổng quan dòng tiền, dư nợ và cashback."},
  transactions: {title:"Giao dịch", description:"Quản lý giao dịch và theo dõi trạng thái hoàn tiền."},
  cards: {title:"Thẻ tín dụng", description:"Quản lý thông tin thẻ, hạn mức và ngày sao kê."},
  programs: {title:"Cashback", description:"Thiết lập và theo dõi các chương trình hoàn tiền."},
  payments: {title:"Thanh toán thẻ", description:"Quản lý các khoản thanh toán và dư nợ thẻ."},
  hosts: {title:"Hosts", description:"Quản lý danh sách Host sử dụng trong giao dịch."},
  mcc: {title:"Nhóm MCC", description:"Quản lý danh mục MCC phục vụ phân loại giao dịch."},
  banks: {title:"Mã ngân hàng", description:"Quản lý ngân hàng và mã viết tắt dùng để tạo Card ID."},
  about: {title:"Giới thiệu", description:"Thông tin nền tảng và tác giả."}
};

const auth = new DriveAuth(window.CardFlowConfig || {});
const syncService = new SyncService({
  localRepository,
  auth,
  driveRepository: new DriveRepository(auth),
  getState: () => state,
  setState: next => { state = next; renderAll(); }
});

function money(v){ return new Intl.NumberFormat("vi-VN").format(Math.round(Number(v)||0)) + " ₫"; }
function moneyInput(v){ return new Intl.NumberFormat("vi-VN").format(Math.round(Number(v)||0)); }
function parseMoney(v){ return Number(String(v || "").replace(/\./g,"").replace(/[^\d-]/g,"")) || 0; }
function pct(v){ return Math.round((Number(v)||0)*100) + "%"; }
function uuid(prefix = "ID"){ return crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
function sum(arr, pick=x=>x){ return arr.reduce((a,x)=>a+(Number(pick(x))||0),0); }
function toast(msg){ const el=document.querySelector("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2400); }
function isoMonth(date){ if(!date) return null; const d=new Date(date+"T00:00:00"); return {year:d.getFullYear(),month:d.getMonth()+1}; }
function inPeriod(t){ const p=isoMonth(t.date); return p && p.year===selectedYear && p.month===selectedMonth; }
function hostName(idOrName){ const h=state.hosts.find(x=>x.id===idOrName || x.name===idOrName); return h ? h.name : idOrName; }
function categoryByName(name){ return state.mccCategories.find(x=>x.name===name); }
function bankName(bankId, fallback=""){ const b=state.banks.find(x=>x.id===bankId); return b ? b.name : fallback; }
function bankCode(bankId){ return state.banks.find(x=>x.id===bankId)?.code || ""; }
function cardName(id){ const c=state.cards.find(x=>x.id===id); return c ? `${bankName(c.bankId,c.bank)} ${c.name}` : id; }
function programs(){ return state.cashbackPrograms; }
function periodTx(){ return state.transactions.filter(inPeriod); }
function normalizeBankCode(code){ return String(code || "").trim().toUpperCase(); }
function normalizeBankName(name){ return String(name || "").trim(); }
function bankIdFromCode(code){ return `BANK-${normalizeBankCode(code)}`; }
function generateCardId(bankId, cardNameValue){
  return buildCardId(bankCode(bankId), cardNameValue);
}
function cardFormLabel(value){
  return value === "physical" ? "Vật lý" : value === "virtual" ? "Phi vật lý" : "Chưa chọn";
}
function cardDisplayName(card){
  return `${bankName(card.bankId,card.bank)} - ${card.name}`.trim();
}
function groupIdForCard(card){
  return card.limitGroupId || `LG-${String(card.limitGroup || card.id).trim().toUpperCase().replace(/[^A-Z0-9-]+/g,"-").replace(/-+/g,"-")}`;
}
function groupMembers(groupId){
  return state.cards.filter(card => groupIdForCard(card) === groupId);
}
function groupLimit(groupId){
  const members = groupMembers(groupId);
  return Number(members[0]?.groupLimit || 0);
}
function sharedLimitLabel(card){
  const members = groupMembers(groupIdForCard(card)).filter(x=>x.id!==card.id);
  return members.length ? members.map(cardDisplayName).join(", ") : "Không";
}
function selectedSharedCardsForForm(card={}){
  if(!card.id) return ["__NONE__"];
  const members = groupMembers(groupIdForCard(card)).filter(x=>x.id!==card.id);
  return members.length ? members.map(x=>x.id) : ["__NONE__"];
}
function sharedLimitOptions(currentId=""){
  return [
    {value:"__NONE__", label:"Không"},
    ...state.cards.filter(card=>card.id!==currentId).map(card=>({value:card.id, label:cardDisplayName(card)}))
  ];
}
function sharedLimitSummary(selectedIds=[]){
  const selected = normalizeSharedSelection(selectedIds);
  if(!selected.length) return "Không";
  const cards = selected.map(id=>state.cards.find(card=>card.id===id)).filter(Boolean);
  if(cards.length === 1) return cardDisplayName(cards[0]);
  if(cards.length === 2) return `${cardDisplayName(cards[0])} + 1 thẻ khác`;
  return `Đang dùng chung với ${cards.length} thẻ`;
}
function normalizeSharedSelection(selection=[]){
  const selected = Array.isArray(selection) ? selection : [selection];
  return selected.includes("__NONE__") ? [] : selected.filter(Boolean);
}
function syncGroupLimits(groupId, limit){
  state.cards.forEach(card => {
    if(groupIdForCard(card) === groupId) card.groupLimit = Number(limit) || 0;
  });
}
function repairLimitGroups(){
  const groups = new Map();
  state.cards.forEach(card => {
    const groupId = groupIdForCard(card);
    if(!groups.has(groupId)) groups.set(groupId, []);
    groups.get(groupId).push(card);
  });
  groups.forEach(members => {
    if(members.length === 1){
      members[0].limitGroupId = `LG-${members[0].id}`;
      members[0].limitGroup = members[0].id;
    }else{
      const limit = Number(members[0].groupLimit) || 0;
      members.forEach(card => { card.groupLimit = limit; });
    }
  });
}
function applySharedLimit(card, selectedIds, enteredLimit){
  const selected = normalizeSharedSelection(selectedIds);
  if(!selected.length){
    card.limitGroupId = `LG-${card.id}`;
    card.limitGroup = card.id;
    card.groupLimit = Number(enteredLimit) || 0;
    return {card};
  }
  const groups = [...new Set(selected.map(id => state.cards.find(card => card.id === id)).filter(Boolean).map(groupIdForCard))];
  if(groups.length !== 1) return {error:"Các thẻ đã chọn đang thuộc các nhóm hạn mức khác nhau. Vui lòng chọn các thẻ trong cùng một nhóm hạn mức."};
  const targetGroupId = groups[0];
  const inheritedLimit = groupLimit(targetGroupId);
  card.limitGroupId = targetGroupId;
  card.limitGroup = state.cards.find(x=>groupIdForCard(x)===targetGroupId)?.limitGroup || targetGroupId;
  card.groupLimit = inheritedLimit;
  return {card, inheritedLimit, targetGroupId};
}
function statementDayLabel(value){
  return value ? `Ngày ${value}` : "Chưa thiết lập";
}
function statementDayOptions(value=""){
  return [{value:"", label:"Chưa thiết lập"}, ...Array.from({length:31}, (_,i)=>({value:String(i+1), label:`Ngày ${i+1}`}))].map(x=>({...x, value:x.value}));
}
function limitHealthClass(remaining, limit){
  const ratio = limit ? remaining / limit : 1;
  if(ratio <= 0.1) return "limit-bad";
  if(ratio <= 0.3) return "limit-warn";
  return "limit-good";
}
function progressClass(progress){
  if(progress >= 1) return "progress-done";
  if(progress >= 0.75) return "progress-warn";
  return "";
}

function saveState(message){
  state = localRepository.save(state, {dirty:true});
  const meta = localRepository.loadMeta();
  localRepository.saveMeta({...meta, status:meta.fileId || auth.hasToken() ? "dirty" : "disconnected"});
  renderAll();
  syncService.schedule();
  if(message) toast(message);
}

function allDebt(cardId){
  const spent=sum(state.transactions.filter(t=>t.cardId===cardId),t=>t.amount);
  const paid=sum(state.payments.filter(p=>p.cardId===cardId),p=>p.amount);
  return Math.max(0, spent-paid);
}
function groupDebt(groupId){
  return sum(groupMembers(groupId), card => allDebt(card.id));
}

function eligibleSpend(program, txs){
  return sum(txs.filter(t=>{
    if(t.cardId!==program.cardId) return false;
    if(program.channel && t.channel!==program.channel) return false;
    if(program.categories?.length && !program.categories.includes(t.category)) return false;
    return true;
  }),t=>t.amount);
}

function programMetrics(txs){
  const base = programs().map(p=>{
    const eligible=eligibleSpend(p,txs);
    const total=sum(txs.filter(t=>t.cardId===p.cardId),t=>t.amount);
    return {...p, eligible, total, rawCashback:Math.min(p.max, eligible*p.rate),
      remainEligible:Math.max(0,p.eligibleTarget-eligible),
      remainTotal:Math.max(0,p.totalTarget-total),
      progress:p.totalTarget ? Math.min(1,total/p.totalTarget) : 0};
  });
  const groups={};
  for(const x of base){ if(x.shared){ (groups[x.shared] ||= []).push(x); } }
  for(const list of Object.values(groups)){
    const cap=list[0].max;
    const earned=Math.min(cap,sum(list,x=>x.rawCashback));
    list.forEach((x,i)=>x.countedCashback=i===0?earned:0);
  }
  base.forEach(x=>{ if(x.countedCashback===undefined) x.countedCashback=x.rawCashback; });
  return base;
}

function renderDashboard(){
  const txs=periodTx();
  const totalSpend=sum(txs,t=>t.amount);
  const hostBack=sum(txs,t=>t.backAmount);
  const waiting=Math.max(0,totalSpend-hostBack);
  const orderDelta=sum(txs,t=>(Number(t.backAmount)||0)-(Number(t.amount)||0));
  const pm=programMetrics(txs);
  const cashback=sum(pm,x=>x.countedCashback);
  const profit=orderDelta+cashback;
  const cardRows=state.cards.map(c=>{
    const monthSpend=sum(txs.filter(t=>t.cardId===c.id),t=>t.amount);
    const debt=allDebt(c.id);
    const groupId = groupIdForCard(c);
    const actualGroupLimit = groupLimit(groupId) || c.groupLimit;
    const remaining=actualGroupLimit-groupDebt(groupId);
    const cb=sum(pm.filter(x=>x.cardId===c.id),x=>x.countedCashback);
    const orderProfit=sum(txs.filter(t=>t.cardId===c.id),t=>(Number(t.backAmount)||0)-(Number(t.amount)||0));
    return {...c,monthSpend,debt,groupLimit:actualGroupLimit,remaining:Math.max(0,remaining),cb,profit:orderProfit+cb};
  });
  const reminders=[];
  pm.forEach(x=>{
    const remain = Math.max(x.remainEligible,x.remainTotal);
    if(x.remainTotal===0 && x.remainEligible===0) reminders.push(`<div class="reminder good">${esc(cardName(x.cardId))} - ${esc(x.name)}: đã đạt mục tiêu theo rule demo.</div>`);
    else reminders.push(`<div class="reminder ${x.progress>=0.75?"near":"warn"}">${esc(cardName(x.cardId))} - ${esc(x.name)}: còn ${money(remain)} theo chỉ tiêu đang theo dõi.</div>`);
  });
  const waitingCount=txs.filter(t=>!t.backAmount).length;
  if(waitingCount) reminders.unshift(`<div class="reminder warn">${waitingCount} giao dịch chưa ghi nhận tiền Back.</div>`);
  document.querySelector("#view-dashboard").innerHTML = `
    <div class="grid kpis">${kpi("Tổng tiền đơn",totalSpend,false,"blue")}${kpi("Host đã Back",hostBack,false,"teal")}${kpi("Đang chờ Back",waiting,false,"amber")}${kpi("Chênh lệch đơn",orderDelta,true,orderDelta>0?"green":orderDelta<0?"red":"")}${kpi("Cashback theo rule",cashback,false,"indigo")}${kpi("Lợi nhuận tháng",profit,true,profit>0?"green":profit<0?"red":"")}</div>
    <div class="grid two-col">
      <div class="card"><div class="section-title"><h2>Tình trạng thẻ</h2><small>Dư nợ = giao dịch - thanh toán đã nhập</small></div>
        <div class="table-wrap"><table><thead><tr><th>Thẻ</th><th>Hạn mức nhóm</th><th>Chi tháng</th><th>Dư nợ</th><th>Còn hạn mức</th><th>Cashback</th><th>Lợi nhuận</th></tr></thead>
        <tbody>${cardRows.map(x=>`<tr><td>${esc(`${bankName(x.bankId,x.bank)} ${x.name}`)}</td><td class="num">${money(x.groupLimit)}</td><td class="num">${money(x.monthSpend)}</td><td class="num">${money(x.debt)}</td><td class="num ${limitHealthClass(x.remaining,x.groupLimit)}">${money(x.remaining)}</td><td class="num">${money(x.cb)}</td><td class="num ${x.profit<0?"negative":x.profit>0?"positive":"neutral"}">${money(x.profit)}</td></tr>`).join("")}</tbody></table></div>
      </div>
      <div class="card"><div class="section-title"><h2>Nhắc nhở</h2></div><div class="reminders">${reminders.join("")||'<div class="reminder good">Chưa có nhắc nhở.</div>'}</div></div>
    </div>
    <div class="card top-space"><div class="section-title"><h2>Tiến độ Cashback / Chỉ tiêu</h2><small>Rule demo theo dữ liệu đã chốt</small></div>
      <div class="table-wrap"><table><thead><tr><th>Thẻ</th><th>Chương trình</th><th>Đúng nhóm</th><th>Tổng chi</th><th>Còn thiếu nhóm</th><th>Còn thiếu chỉ tiêu</th><th>Tiến độ</th><th>CB ghi nhận</th></tr></thead>
      <tbody>${pm.map(x=>`<tr><td>${esc(cardName(x.cardId))}</td><td>${esc(x.name)}</td><td class="num">${money(x.eligible)}</td><td class="num">${money(x.total)}</td><td class="num">${money(x.remainEligible)}</td><td class="num">${money(x.remainTotal)}</td><td><div class="limit-meter"><div class="progress ${progressClass(x.progress)}"><i style="width:${Math.round(x.progress*100)}%"></i></div><span>${pct(x.progress)}</span></div></td><td class="num">${money(x.countedCashback)}</td></tr>`).join("")}</tbody></table></div>
    </div>`;
}
function kpi(label,value,signed=false,tone=""){ return `<div class="card kpi ${tone}"><span>${esc(label)}</span><strong class="${signed?(value<0?"negative":value>0?"positive":"neutral"):""}">${money(value)}</strong></div>`; }

function toolbar(entity, addText = "+ Thêm"){
  return `<div class="crud-toolbar"><input data-search="${entity}" placeholder="Tìm kiếm"><button class="primary" data-add="${entity}">${addText}</button><button class="secondary-btn" data-edit="${entity}">Chỉnh sửa</button><button class="delete-btn" data-remove="${entity}">Xóa</button></div>`;
}
function selectRow(entity, id){
  selectedRows[entity]=id;
  document.querySelectorAll(`[data-entity="${entity}"] tr[data-id]`).forEach(tr=>tr.classList.toggle("selected",tr.dataset.id===id));
}
function filteredRows(entity, rows, textFn){
  const term=(searchTerms[entity]||"").toLowerCase();
  return term ? rows.filter(row=>textFn(row).toLowerCase().includes(term)) : rows;
}
function wireToolbar(entity, handlers){
  const search=document.querySelector(`[data-search="${entity}"]`);
  if(search){
    search.value=searchTerms[entity]||"";
    search.addEventListener("input",()=>{searchTerms[entity]=search.value; renderAll();});
  }
  document.querySelector(`[data-add="${entity}"]`)?.addEventListener("click", handlers.add);
  document.querySelector(`[data-edit="${entity}"]`)?.addEventListener("click",()=>{ const id=selectedRows[entity]; if(!id) return toast("Vui lòng chọn một dòng để chỉnh sửa."); handlers.edit(id); });
  document.querySelector(`[data-remove="${entity}"]`)?.addEventListener("click",()=>{ const id=selectedRows[entity]; if(!id) return toast("Vui lòng chọn một dòng để xóa."); handlers.remove(id); });
  document.querySelectorAll(`[data-entity="${entity}"] tr[data-id]`).forEach(tr=>{
    tr.addEventListener("click",()=>selectRow(entity,tr.dataset.id));
    tr.addEventListener("dblclick",()=>handlers.edit(tr.dataset.id));
  });
}

async function openForm(title, fields, initial = {}, onRender = null){
  const modal=document.querySelector("#formModal");
  const body=modal.querySelector(".modal-body");
  modal.querySelector("h2").textContent=title;
  body.innerHTML = fields.map(f => {
    const value = initial[f.name] ?? f.value ?? "";
    if(f.type === "select") return `<div class="field"><label>${esc(f.label)}</label><select name="${esc(f.name)}">${f.options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?"selected":""}>${esc(o.label)}</option>`).join("")}</select></div>`;
    if(f.type === "multiselect"){
      const values = Array.isArray(value) ? value.map(String) : [String(value || "")];
      return `<div class="field full"><label>${esc(f.label)}</label><div class="multi-select" data-multiselect-name="${esc(f.name)}">
        <button type="button" class="multi-select-toggle" data-multiselect-toggle>Không</button>
        <div class="multi-select-panel">
          ${f.options.map(o=>`<label class="multi-option"><input type="checkbox" value="${esc(o.value)}" ${values.includes(String(o.value))?"checked":""}> <span>${esc(o.label)}</span></label>`).join("")}
        </div>
      </div><small>${esc(f.hint || "")}</small></div>`;
    }
    if(f.type === "textarea") return `<div class="field full"><label>${esc(f.label)}</label><textarea name="${esc(f.name)}">${esc(value)}</textarea></div>`;
    if(f.type === "note") return `<div class="note full">${esc(f.label)}</div>`;
    const inputType = f.kind === "money" ? "text" : (f.type || "text");
    const inputValue = f.kind === "money" ? moneyInput(value) : value;
    return `<div class="field"><label>${esc(f.label)}</label><input name="${esc(f.name)}" type="${esc(inputType)}" value="${esc(inputValue)}" ${f.step?`step="${esc(f.step)}"`:""} ${f.readonly?"readonly":""}></div>`;
  }).join("");
  body.querySelectorAll("[data-money]").forEach(input => input.addEventListener("input", () => {
    const raw = parseMoney(input.value);
    input.value = raw ? moneyInput(raw) : "";
  }));
  body.querySelectorAll(".field input").forEach(input => {
    const field = fields.find(x => x.name === input.name);
    if(field?.kind === "money"){
      input.dataset.money = "true";
      input.addEventListener("input", () => {
        const raw = parseMoney(input.value);
        input.value = raw ? moneyInput(raw) : "";
      });
    }
  });
  if(onRender) onRender(modal, fields);
  modal.classList.add("show");
  return new Promise(resolve => {
    const form=modal.querySelector("form");
    const close = result => { modal.classList.remove("show"); form.onsubmit=null; modal.querySelector("[data-cancel-modal]").onclick=null; resolve(result); };
    modal.querySelector("[data-cancel-modal]").onclick=()=>close(null);
    form.onsubmit=e=>{
      e.preventDefault();
      const fd=new FormData(form);
      const values={};
      fields.forEach(f=>{
        if(f.type === "note") return;
        const raw=fd.get(f.name);
        values[f.name] = f.type === "multiselect" ? [...body.querySelectorAll(`[data-multiselect-name="${f.name}"] input:checked`)].map(x=>x.value) : f.kind === "number" ? Number(raw || 0) : f.kind === "money" ? parseMoney(raw) : raw;
      });
      close(values);
    };
  });
}

function bankFields(bank={}){
  return [
    {name:"code", label:"Mã ngân hàng", value:bank.code || "", type:"text"},
    {name:"name", label:"Tên ngân hàng", value:bank.name || "", type:"text"}
  ];
}

function validateBank(values, existingId=""){
  const code = normalizeBankCode(values.code);
  const name = normalizeBankName(values.name);
  if(!code) return {error:"Vui lòng nhập mã ngân hàng."};
  if(!name) return {error:"Vui lòng nhập tên ngân hàng."};
  if(/\s/.test(code)) return {error:"Mã ngân hàng không được chứa khoảng trắng."};
  if(!/^[A-Z0-9-]+$/.test(code)) return {error:"Mã ngân hàng chỉ được dùng chữ, số và dấu gạch ngang."};
  if(state.banks.some(x => x.id !== existingId && x.code === code)) return {error:"Mã ngân hàng đã tồn tại."};
  if(state.banks.some(x => x.id !== existingId && x.name === name)) return {error:"Tên ngân hàng đã tồn tại."};
  return {bank:{id:existingId || bankIdFromCode(code), code, name}};
}

function networkOptions(current=""){
  const values = ["Visa","Mastercard","JCB","American Express","UnionPay","Napas","Khác"];
  if(current && !values.includes(current)) values.push(current);
  return values.map(x=>({value:x,label:x}));
}

function cardFormOptions(includeEmpty=true){
  const options = [
    {value:"physical", label:"Vật lý"},
    {value:"virtual", label:"Phi vật lý"}
  ];
  return includeEmpty ? [{value:"", label:"Chưa chọn"}, ...options] : options;
}

function cardFields(card={}, mode="add"){
  if(!state.banks.length){
    return [{type:"note", label:"Chưa có mã ngân hàng. Vui lòng cấu hình tab Mã ngân hàng trước khi thêm thẻ."}];
  }
  return [
    {name:"bankId", label:"Ngân hàng", value:card.bankId || state.banks[0]?.id || "", type:"select", options:selectOptions(state.banks, b=>b.name)},
    {name:"name", label:"Tên thẻ", value:card.name || "", type:"text"},
    {name:"network", label:"Loại thẻ", value:card.network || "Visa", type:"select", options:networkOptions(card.network)},
    {name:"cardForm", label:"Hình thức thẻ", value:card.cardForm || "", type:"select", options:cardFormOptions(true)},
    {name:"statementDay", label:"Ngày sao kê", value:card.statementDay || "", type:"select", options:statementDayOptions(card.statementDay)},
    {name:"sharedLimitCards", label:"Dùng chung hạn mức", value:selectedSharedCardsForForm(card), type:"multiselect", options:sharedLimitOptions(card.id), hint:"Chọn Không nếu thẻ dùng hạn mức riêng, hoặc chọn một/nhiều thẻ đang dùng chung hạn mức."},
    {name:"groupLimit", label:"Hạn mức nhóm (VND)", value:card.groupLimit || 0, type:"text", kind:"money"}
  ];
}

function wireSharedLimitForm(modal){
  const shared = modal.querySelector('[data-multiselect-name="sharedLimitCards"]');
  const limit = modal.querySelector('[name="groupLimit"]');
  if(!shared || !limit) return;
  const toggle = shared.querySelector("[data-multiselect-toggle]");
  const panel = shared.querySelector(".multi-select-panel");
  const checkboxes = [...shared.querySelectorAll('input[type="checkbox"]')];
  let previous = checkboxes.filter(x=>x.checked).map(x=>x.value);
  const update = () => {
    const selected = checkboxes.filter(x=>x.checked).map(x=>x.value);
    const noneJustSelected = selected.includes("__NONE__") && !previous.includes("__NONE__");
    if(noneJustSelected){
      checkboxes.forEach(o=>{ o.checked = o.value === "__NONE__"; });
    }else if(!selected.includes("__NONE__") && selected.length){
      checkboxes.forEach(o=>{ if(o.value === "__NONE__") o.checked = false; });
    }else if(selected.includes("__NONE__") && selected.length > 1){
      checkboxes.forEach(o=>{ if(o.value === "__NONE__") o.checked = false; });
    }
    const chosen = checkboxes.filter(x=>x.checked).map(x=>x.value).filter(x=>x !== "__NONE__");
    toggle.textContent = sharedLimitSummary(chosen);
    if(chosen.length){
      const first = state.cards.find(card=>card.id===chosen[0]);
      if(first){
        limit.value = moneyInput(groupLimit(groupIdForCard(first)));
        limit.readOnly = true;
      }
    }else{
      limit.readOnly = false;
    }
    previous = checkboxes.filter(x=>x.checked).map(x=>x.value);
  };
  toggle.addEventListener("click", () => shared.classList.toggle("open"));
  checkboxes.forEach(box => box.addEventListener("change", update));
  document.addEventListener("click", event => {
    if(!shared.contains(event.target)) shared.classList.remove("open");
  });
  update();
}

function validateCard(values, existingId=""){
  if(!state.banks.length) return {error:"Chưa có mã ngân hàng. Vui lòng cấu hình Mã ngân hàng trước."};
  if(!values.bankId) return {error:"Vui lòng chọn ngân hàng."};
  if(!String(values.name || "").trim()) return {error:"Vui lòng nhập tên thẻ."};
  const statementDay = values.statementDay === "" ? "" : Number(values.statementDay);
  if(statementDay !== "" && (!Number.isInteger(statementDay) || statementDay < 1 || statementDay > 31)) return {error:"Ngày sao kê phải nằm trong khoảng 1 đến 31."};
  const bank = state.banks.find(x=>x.id===values.bankId);
  if(!bank) return {error:"Ngân hàng đã chọn không tồn tại."};
  const id = existingId || generateCardId(values.bankId, values.name);
  if(!existingId && !normalizeCardNameForId(values.name)) return {error:"Tên thẻ không hợp lệ để tạo Card ID."};
  if(!existingId && state.cards.some(x=>x.id===id)) return {error:`Card ID ${id} đã tồn tại. Vui lòng đổi tên thẻ hoặc ngân hàng.`};
  const card = {...values, statementDay, id, bank:bank.name, name:String(values.name).trim(), groupLimit:Number(values.groupLimit)||0};
  delete card.sharedLimitCards;
  const shared = applySharedLimit(card, values.sharedLimitCards, values.groupLimit);
  if(shared.error) return shared;
  return {card:shared.card, targetGroupId:shared.targetGroupId};
}

function renderCards(){
  const rows=filteredRows("cards", state.cards, c=>`${c.id} ${bankName(c.bankId,c.bank)} ${c.name} ${c.network} ${sharedLimitLabel(c)} ${cardFormLabel(c.cardForm)}`);
  document.querySelector("#view-cards").innerHTML=`<div class="card">${!state.banks.length?'<div class="note">Chưa có mã ngân hàng. Hãy vào tab Mã ngân hàng để thêm trước khi tạo thẻ.</div>':""}${toolbar("cards")}<div class="table-wrap"><table data-entity="cards"><thead><tr><th>Ngân hàng</th><th>Tên thẻ</th><th>Loại thẻ</th><th>Hình thức thẻ</th><th>Ngày sao kê</th><th>Dùng chung hạn mức</th><th>Card ID</th><th>Hạn mức</th><th>Dư nợ</th></tr></thead><tbody>
  ${rows.map(c=>`<tr data-id="${esc(c.id)}" class="${selectedRows.cards===c.id?"selected":""}"><td>${esc(bankName(c.bankId,c.bank))}</td><td>${esc(c.name)}</td><td>${esc(c.network||"Chưa nhập loại thẻ")}</td><td>${esc(cardFormLabel(c.cardForm))}</td><td>${esc(statementDayLabel(c.statementDay))}</td><td class="wrap-cell">${esc(sharedLimitLabel(c))}</td><td>${esc(c.id)}</td><td class="num">${money(c.groupLimit)}</td><td class="num">${money(allDebt(c.id))}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("cards", {
    add: async()=>{ if(!state.banks.length){ toast("Vui lòng cấu hình Mã ngân hàng trước."); setView("banks"); return; } const v=await openForm("Thêm thẻ tín dụng", cardFields({}, "add"), {}, wireSharedLimitForm); if(!v) return; const result=validateCard(v); if(result.error) return toast(result.error); state.cards.push(result.card); if(result.targetGroupId) syncGroupLimits(result.targetGroupId, result.card.groupLimit); selectedRows.cards=result.card.id; saveState("Đã thêm thẻ"); },
    edit: async id=>{ const i=state.cards.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa thẻ tín dụng", cardFields(state.cards[i], "edit"), {...state.cards[i], sharedLimitCards:selectedSharedCardsForForm(state.cards[i])}, wireSharedLimitForm); if(!v) return; const result=validateCard(v, id); if(result.error) return toast(result.error); state.cards[i]=result.card; if(result.targetGroupId) syncGroupLimits(result.targetGroupId, result.card.groupLimit); selectedRows.cards=id; saveState("Đã cập nhật thẻ"); },
    remove: id=>{ if(!confirm("Xóa thẻ đã chọn? Các giao dịch/thanh toán liên quan sẽ không bị xóa.")) return; state.cards=state.cards.filter(x=>x.id!==id); repairLimitGroups(); selectedRows.cards=""; saveState("Đã xóa thẻ"); }
  });
}

function renderBanks(){
  const rows=filteredRows("banks", state.banks, b=>`${b.code} ${b.name}`);
  document.querySelector("#view-banks").innerHTML=`<div class="card"><div class="section-title"><h2>Mã ngân hàng</h2><small>Dùng để tạo Card ID dễ đọc</small></div>${toolbar("banks")}<div class="table-wrap"><table data-entity="banks"><thead><tr><th>Mã ngân hàng</th><th>Tên ngân hàng</th><th>Số thẻ đang dùng</th></tr></thead><tbody>
  ${rows.map(b=>`<tr data-id="${esc(b.id)}" class="${selectedRows.banks===b.id?"selected":""}"><td>${esc(b.code)}</td><td>${esc(b.name)}</td><td class="num">${state.cards.filter(c=>c.bankId===b.id).length}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("banks", {
    add: async()=>{ const v=await openForm("Thêm mã ngân hàng", bankFields()); if(!v) return; const result=validateBank(v); if(result.error) return toast(result.error); state.banks.push(result.bank); selectedRows.banks=result.bank.id; saveState("Đã thêm mã ngân hàng"); },
    edit: async id=>{ const i=state.banks.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa mã ngân hàng", bankFields(state.banks[i]), state.banks[i]); if(!v) return; const result=validateBank(v, id); if(result.error) return toast(result.error); state.banks[i]={...result.bank, id}; state.cards.forEach(card=>{ if(card.bankId===id) card.bank=result.bank.name; }); saveState("Đã cập nhật mã ngân hàng"); },
    remove: id=>{ const bank=state.banks.find(x=>x.id===id); const count=state.cards.filter(c=>c.bankId===id).length; if(count) return toast(`Không thể xóa ${bank.name} vì đang được ${count} thẻ tín dụng sử dụng.`); if(!confirm("Xóa mã ngân hàng đã chọn?")) return; state.banks=state.banks.filter(x=>x.id!==id); selectedRows.banks=""; saveState("Đã xóa mã ngân hàng"); }
  });
}

function renderAbout(){
  document.querySelector("#view-about").innerHTML=`<div class="about-layout">
    <section class="card about-card">
      <div class="section-title"><h2>QUẢN LÝ THẺ TÍN DỤNG</h2></div>
      <p>Nền tảng hỗ trợ quản lý thẻ tín dụng, giao dịch, dư nợ, hạn mức, chương trình cashback và đồng bộ dữ liệu qua Google Drive.</p>
      <div class="about-features">
        <span>Quản lý nhiều thẻ tín dụng</span>
        <span>Theo dõi hạn mức và dư nợ</span>
        <span>Quản lý giao dịch</span>
        <span>Theo dõi cashback</span>
        <span>Quản lý Host và MCC</span>
        <span>Đồng bộ dữ liệu bằng Google Drive</span>
        <span>Hỗ trợ sử dụng trên nhiều thiết bị</span>
      </div>
    </section>
    <section class="card about-card">
      <div class="section-title"><h2>Tác giả</h2></div>
      <p><strong>Nguyễn Quang Minh</strong></p>
      <p>Email: <a class="safe-link" href="mailto:quangminh071093@gmail.com">quangminh071093@gmail.com</a></p>
    </section>
  </div>`;
}

function selectOptions(items, labelFn, valueFn=x=>x.id){ return items.map(x=>({value:valueFn(x), label:labelFn(x)})); }
function programFields(program={}){
  return [
    {name:"id", label:"Mã chương trình", value:program.id || "", type:"text"},
    {name:"cardId", label:"Thẻ", value:program.cardId || state.cards[0]?.id || "", type:"select", options:selectOptions(state.cards, c=>cardName(c.id))},
    {name:"name", label:"Tên chương trình", value:program.name || "", type:"text"},
    {name:"rate", label:"Tỷ lệ cashback (0.05 = 5%)", value:program.rate ?? 0, type:"number", step:"0.001", kind:"number"},
    {name:"max", label:"Max CB (VND)", value:program.max || 0, type:"number", step:"1", kind:"number"},
    {name:"eligibleTarget", label:"Chi nhóm để max", value:program.eligibleTarget || 0, type:"number", step:"1", kind:"number"},
    {name:"totalTarget", label:"Chỉ tiêu tổng", value:program.totalTarget || 0, type:"number", step:"1", kind:"number"},
    {name:"channel", label:"Kênh", value:program.channel || "", type:"select", options:[{value:"",label:"Tất cả"},{value:"Online",label:"Online"},{value:"Offline",label:"Offline"}]},
    {name:"categoriesText", label:"Nhóm MCC áp dụng (cách nhau bằng dấu phẩy)", value:(program.categories||[]).join(", "), type:"textarea"},
    {name:"shared", label:"Shared cap", value:program.shared || "", type:"text"}
  ];
}
function renderPrograms(){
  const pm=programMetrics(periodTx());
  const rows=filteredRows("programs", pm, p=>`${p.id} ${p.name} ${cardName(p.cardId)} ${p.shared||""}`);
  document.querySelector("#view-programs").innerHTML=`<div class="card"><div class="section-title"><h2>Chương trình Cashback</h2><small>Source of Truth demo: dữ liệu người dùng đã chốt</small></div>${toolbar("programs")}<div class="table-wrap"><table data-entity="programs"><thead><tr><th>Thẻ</th><th>Chương trình</th><th>% CB</th><th>Max CB</th><th>Chi nhóm để max</th><th>Chỉ tiêu tổng</th><th>Kênh</th><th>Nhóm MCC</th><th>Shared cap</th><th>CB tháng</th></tr></thead><tbody>
  ${rows.map(x=>`<tr data-id="${esc(x.id)}" class="${selectedRows.programs===x.id?"selected":""}"><td>${esc(cardName(x.cardId))}</td><td>${esc(x.name)}</td><td>${pct(x.rate)}</td><td class="num">${money(x.max)}</td><td class="num">${money(x.eligibleTarget)}</td><td class="num">${money(x.totalTarget)}</td><td>${esc(x.channel||"Tất cả")}</td><td>${esc((x.categories||[]).join(", "))}</td><td>${esc(x.shared||"")}</td><td class="num">${money(x.countedCashback)}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("programs", {
    add: async()=>{ const v=await openForm("Thêm chương trình Cashback", programFields()); if(!v) return; v.categories=(v.categoriesText||"").split(",").map(x=>x.trim()).filter(Boolean); delete v.categoriesText; state.cashbackPrograms.push(v); saveState("Đã thêm chương trình"); },
    edit: async id=>{ const i=state.cashbackPrograms.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa chương trình Cashback", programFields(state.cashbackPrograms[i]), {...state.cashbackPrograms[i], categoriesText:(state.cashbackPrograms[i].categories||[]).join(", ")}); if(!v) return; v.categories=(v.categoriesText||"").split(",").map(x=>x.trim()).filter(Boolean); delete v.categoriesText; state.cashbackPrograms[i]=v; selectedRows.programs=v.id; saveState("Đã cập nhật chương trình"); },
    remove: id=>{ if(!confirm("Xóa chương trình Cashback đã chọn?")) return; state.cashbackPrograms=state.cashbackPrograms.filter(x=>x.id!==id); selectedRows.programs=""; saveState("Đã xóa chương trình"); }
  });
}

function txFields(tx={}){
  return [
    {name:"date", label:"Ngày", value:tx.date || new Date().toISOString().slice(0,10), type:"date"},
    {name:"host", label:"Host", value:tx.host || state.hosts[0]?.name || "", type:"select", options:selectOptions(state.hosts, h=>h.name, h=>h.name)},
    {name:"category", label:"Loại đơn", value:tx.category || state.mccCategories[0]?.name || "", type:"select", options:selectOptions(state.mccCategories, c=>`${c.name} (${c.mcc})`, c=>c.name)},
    {name:"channel", label:"Kênh giao dịch", value:tx.channel || "Online", type:"select", options:[{value:"Online",label:"Online"},{value:"Offline",label:"Offline"}]},
    {name:"cardId", label:"Thẻ", value:tx.cardId || state.cards[0]?.id || "", type:"select", options:selectOptions(state.cards, c=>cardName(c.id))},
    {name:"amount", label:"Tiền đơn (VND)", value:tx.amount || 0, type:"number", step:"1", kind:"number"},
    {name:"status", label:"Trạng thái", value:tx.status || "Đã thanh toán", type:"select", options:["Đã thanh toán","Đã gửi Host","Đơn đã đi","Chờ Back","Đã Back","Có vấn đề","Hủy"].map(x=>({value:x,label:x}))},
    {name:"backDate", label:"Ngày Back", value:tx.backDate || "", type:"date"},
    {name:"backAmount", label:"Tiền Back (VND)", value:tx.backAmount || 0, type:"number", step:"1", kind:"number"},
    {name:"note", label:"Ghi chú", value:tx.note || "", type:"textarea"}
  ];
}
function normalizeTx(v, existingId){
  const cat=categoryByName(v.category);
  return {...v, id:existingId || uuid("TX"), mcc:cat?.mcc || 0, amount:Number(v.amount)||0, backAmount:Number(v.backAmount)||0};
}
function renderTransactions(){
  const rows=filteredRows("transactions", [...state.transactions].sort((a,b)=>(b.date||"").localeCompare(a.date||"")), t=>`${t.date} ${hostName(t.host)} ${t.category} ${cardName(t.cardId)} ${t.status} ${t.note||""}`);
  document.querySelector("#view-transactions").innerHTML=`<div class="card"><div class="section-title"><h2>Danh sách giao dịch</h2><small>${rows.length} dòng</small></div>${toolbar("transactions")}<div class="table-wrap"><table data-entity="transactions"><thead><tr><th>Ngày</th><th>Host</th><th>Loại đơn</th><th>MCC</th><th>Kênh</th><th>Thẻ</th><th>Tiền đơn</th><th>Trạng thái</th><th>Ngày Back</th><th>Tiền Back</th><th>Chênh lệch</th></tr></thead><tbody>
  ${rows.map(t=>`<tr data-id="${esc(t.id)}" class="${selectedRows.transactions===t.id?"selected":""}"><td>${esc(t.date)}</td><td>${esc(hostName(t.host))}</td><td>${esc(t.category)}</td><td>${esc(t.mcc)}</td><td>${esc(t.channel||"")}</td><td>${esc(cardName(t.cardId))}</td><td class="num">${money(t.amount)}</td><td>${esc(t.status||"")}</td><td>${esc(t.backDate||"")}</td><td class="num">${money(t.backAmount)}</td><td class="num ${((t.backAmount||0)-t.amount)<0?"negative":"positive"}">${money((t.backAmount||0)-t.amount)}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("transactions", {
    add: async()=>{ const v=await openForm("Thêm giao dịch", txFields()); if(!v) return; state.transactions.push(normalizeTx(v)); saveState("Đã lưu giao dịch"); },
    edit: async id=>{ const i=state.transactions.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa giao dịch", txFields(state.transactions[i]), state.transactions[i]); if(!v) return; state.transactions[i]=normalizeTx(v,id); saveState("Đã cập nhật giao dịch"); },
    remove: id=>{ if(!confirm("Xóa giao dịch đã chọn?")) return; state.transactions=state.transactions.filter(t=>t.id!==id); selectedRows.transactions=""; saveState("Đã xóa giao dịch"); }
  });
}

function paymentFields(p={}){
  return [
    {name:"date", label:"Ngày", value:p.date || new Date().toISOString().slice(0,10), type:"date"},
    {name:"cardId", label:"Thẻ", value:p.cardId || state.cards[0]?.id || "", type:"select", options:selectOptions(state.cards, c=>cardName(c.id))},
    {name:"amount", label:"Số tiền thanh toán", value:p.amount || 0, type:"number", step:"1", kind:"number"},
    {name:"note", label:"Ghi chú", value:p.note || "", type:"text"}
  ];
}
function renderPayments(){
  const rows=filteredRows("payments", [...state.payments].sort((a,b)=>(b.date||"").localeCompare(a.date||"")), p=>`${p.date} ${cardName(p.cardId)} ${p.amount} ${p.note||""}`);
  document.querySelector("#view-payments").innerHTML=`<div class="card"><div class="section-title"><h2>Thanh toán thẻ</h2><small>${rows.length} dòng</small></div>${toolbar("payments")}<div class="table-wrap"><table data-entity="payments"><thead><tr><th>Ngày</th><th>Thẻ</th><th>Số tiền</th><th>Ghi chú</th></tr></thead><tbody>
  ${rows.map(p=>`<tr data-id="${esc(p.id)}" class="${selectedRows.payments===p.id?"selected":""}"><td>${esc(p.date)}</td><td>${esc(cardName(p.cardId))}</td><td class="num">${money(p.amount)}</td><td>${esc(p.note||"")}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("payments", {
    add: async()=>{ const v=await openForm("Thêm thanh toán", paymentFields()); if(!v) return; state.payments.push({...v,id:uuid("PAY"),amount:Number(v.amount)||0}); saveState("Đã lưu thanh toán"); },
    edit: async id=>{ const i=state.payments.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa thanh toán", paymentFields(state.payments[i]), state.payments[i]); if(!v) return; state.payments[i]={...v,id,amount:Number(v.amount)||0}; saveState("Đã cập nhật thanh toán"); },
    remove: id=>{ if(!confirm("Xóa thanh toán đã chọn?")) return; state.payments=state.payments.filter(p=>p.id!==id); selectedRows.payments=""; saveState("Đã xóa thanh toán"); }
  });
}

function renderHosts(){
  const rows=filteredRows("hosts", state.hosts, h=>h.name);
  document.querySelector("#view-hosts").innerHTML=`<div class="card"><div class="section-title"><h2>Hosts</h2><small>Dùng trong giao dịch</small></div>${toolbar("hosts")}<div class="table-wrap"><table data-entity="hosts"><thead><tr><th>Tên Host</th><th>Số giao dịch</th></tr></thead><tbody>${rows.map(h=>`<tr data-id="${esc(h.id)}" class="${selectedRows.hosts===h.id?"selected":""}"><td>${esc(h.name)}</td><td class="num">${state.transactions.filter(t=>t.host===h.name || t.host===h.id).length}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("hosts", {
    add: async()=>{ const v=await openForm("Thêm Host", [{name:"name",label:"Tên Host",type:"text"}]); if(!v) return; state.hosts.push({id:uuid("HOST"),name:v.name}); saveState("Đã thêm Host"); },
    edit: async id=>{ const i=state.hosts.findIndex(x=>x.id===id); const old=state.hosts[i].name; const v=await openForm("Chỉnh sửa Host", [{name:"name",label:"Tên Host",type:"text",value:old}], state.hosts[i]); if(!v) return; state.hosts[i]={...state.hosts[i],name:v.name}; state.transactions.forEach(t=>{ if(t.host===old) t.host=v.name; }); saveState("Đã cập nhật Host"); },
    remove: id=>{ const h=state.hosts.find(x=>x.id===id); if(state.transactions.some(t=>t.host===h.name || t.host===h.id)) return toast("Không thể xóa Host đang có giao dịch."); if(!confirm("Xóa Host đã chọn?")) return; state.hosts=state.hosts.filter(x=>x.id!==id); selectedRows.hosts=""; saveState("Đã xóa Host"); }
  });
}

function renderMcc(){
  const rows=filteredRows("mcc", state.mccCategories, c=>`${c.name} ${c.mcc}`);
  document.querySelector("#view-mcc").innerHTML=`<div class="card"><div class="section-title"><h2>Nhóm MCC</h2><small>Dùng cho rule Cashback và giao dịch</small></div>${toolbar("mcc")}<div class="table-wrap"><table data-entity="mcc"><thead><tr><th>Loại chi tiêu</th><th>MCC</th><th>Số giao dịch</th></tr></thead><tbody>${rows.map(c=>`<tr data-id="${esc(c.id)}" class="${selectedRows.mcc===c.id?"selected":""}"><td>${esc(c.name)}</td><td>${esc(c.mcc)}</td><td class="num">${state.transactions.filter(t=>t.category===c.name).length}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("mcc", {
    add: async()=>{ const v=await openForm("Thêm nhóm MCC", [{name:"name",label:"Loại chi tiêu",type:"text"},{name:"mcc",label:"MCC",type:"number",kind:"number"}]); if(!v) return; state.mccCategories.push({id:uuid("MCC"),name:v.name,mcc:Number(v.mcc)||0}); saveState("Đã thêm nhóm MCC"); },
    edit: async id=>{ const i=state.mccCategories.findIndex(x=>x.id===id); const old=state.mccCategories[i].name; const v=await openForm("Chỉnh sửa nhóm MCC", [{name:"name",label:"Loại chi tiêu",type:"text"},{name:"mcc",label:"MCC",type:"number",kind:"number"}], state.mccCategories[i]); if(!v) return; state.mccCategories[i]={...state.mccCategories[i],name:v.name,mcc:Number(v.mcc)||0}; state.transactions.forEach(t=>{ if(t.category===old){ t.category=v.name; t.mcc=Number(v.mcc)||0; } }); state.cashbackPrograms.forEach(p=>{ p.categories=(p.categories||[]).map(x=>x===old?v.name:x); }); saveState("Đã cập nhật nhóm MCC"); },
    remove: id=>{ const c=state.mccCategories.find(x=>x.id===id); if(state.transactions.some(t=>t.category===c.name)) return toast("Không thể xóa nhóm MCC đang có giao dịch."); if(!confirm("Xóa nhóm MCC đã chọn?")) return; state.mccCategories=state.mccCategories.filter(x=>x.id!==id); selectedRows.mcc=""; saveState("Đã xóa nhóm MCC"); }
  });
}

function addSuggestedBank(code, name){
  const result = validateBank({code, name});
  if(result.error) return toast(result.error);
  state.banks.push(result.bank);
  saveState(`Đã thêm ${name}`);
}

function setupBankStep(){
  const suggestions = [
    {code:"TCB", name:"Techcombank"},
    {code:"SACOM", name:"Sacombank"},
    {code:"SCB", name:"SCB"},
    {code:"VCB", name:"Vietcombank"},
    {code:"CAKE", name:"Cake"}
  ];
  return `<div class="card"><div class="section-title"><h2>Mã ngân hàng</h2><small>Cần ít nhất 1 ngân hàng</small></div>
    <div class="suggestions">${suggestions.map(x=>`<button type="button" data-suggest-bank="${esc(x.code)}" data-suggest-name="${esc(x.name)}">${esc(x.name)} / ${esc(x.code)}</button>`).join("")}</div>
    <div class="mini-form"><input id="setupBankCode" placeholder="Mã ngân hàng"><input id="setupBankName" placeholder="Tên ngân hàng"><button class="primary" id="setupAddBank">+ Thêm</button></div>
    <div class="table-wrap"><table><thead><tr><th>Mã ngân hàng</th><th>Tên ngân hàng</th></tr></thead><tbody>${state.banks.map(b=>`<tr><td>${esc(b.code)}</td><td>${esc(b.name)}</td></tr>`).join("")}</tbody></table></div>
  </div>`;
}

function setupCardStep(){
  if(!state.banks.length) return `<div class="note">Vui lòng thêm ít nhất 1 mã ngân hàng trước.</div>`;
  return `<div class="card"><div class="section-title"><h2>Thẻ tín dụng</h2><small>Cần ít nhất 1 thẻ</small></div>
    <button class="primary" id="setupAddCard">+ Thêm thẻ tín dụng</button>
    <div class="table-wrap top-space"><table><thead><tr><th>Ngân hàng</th><th>Tên thẻ</th><th>Card ID</th><th>Hạn mức</th></tr></thead><tbody>${state.cards.map(c=>`<tr><td>${esc(bankName(c.bankId,c.bank))}</td><td>${esc(c.name)}</td><td>${esc(c.id)}</td><td class="num">${money(c.groupLimit)}</td></tr>`).join("")}</tbody></table></div>
  </div>`;
}

function setupHostStep(){
  return `<div class="card"><div class="section-title"><h2>Host</h2><small>Có thể bỏ qua bước này</small></div>
    <div class="mini-form"><input id="setupHostName" placeholder="Tên Host"><span></span><button class="primary" id="setupAddHost">+ Thêm Host</button></div>
    <div class="table-wrap"><table><thead><tr><th>Tên Host</th></tr></thead><tbody>${state.hosts.map(h=>`<tr><td>${esc(h.name)}</td></tr>`).join("")}</tbody></table></div>
  </div>`;
}

function renderSetupWizard(){
  const modal = document.querySelector("#setupWizard");
  if(!modal) return;
  const active = appUnlocked && state.settings?.setupCompleted !== true;
  modal.classList.toggle("show", active);
  if(!active) return;
  document.querySelectorAll("[data-step-dot]").forEach(dot => {
    const index = Number(dot.dataset.stepDot);
    dot.classList.toggle("active", index === setupStep);
    dot.classList.toggle("done", index < setupStep);
  });
  document.querySelector("#setupContent").innerHTML = setupStep === 0 ? setupBankStep() : setupStep === 1 ? setupCardStep() : setupHostStep();
  document.querySelector("#setupBack").style.display = setupStep === 0 ? "none" : "";
  document.querySelector("#setupSkipHost").style.display = setupStep === 2 ? "" : "none";
  document.querySelector("#setupNext").textContent = setupStep === 2 ? "Hoàn tất" : "Tiếp tục";
  wireSetupStep();
}

function wireSetupStep(){
  document.querySelectorAll("[data-suggest-bank]").forEach(btn => btn.addEventListener("click", () => addSuggestedBank(btn.dataset.suggestBank, btn.dataset.suggestName)));
  document.querySelector("#setupAddBank")?.addEventListener("click", () => {
    const result = validateBank({code:document.querySelector("#setupBankCode").value, name:document.querySelector("#setupBankName").value});
    if(result.error) return toast(result.error);
    state.banks.push(result.bank);
    saveState("Đã thêm mã ngân hàng");
  });
  document.querySelector("#setupAddCard")?.addEventListener("click", async () => {
    const v = await openForm("Thêm thẻ tín dụng", cardFields({}, "add"), {}, wireSharedLimitForm);
    if(!v) return;
    const result = validateCard(v);
    if(result.error) return toast(result.error);
    state.cards.push(result.card);
    if(result.targetGroupId) syncGroupLimits(result.targetGroupId, result.card.groupLimit);
    saveState("Đã thêm thẻ");
  });
  document.querySelector("#setupAddHost")?.addEventListener("click", () => {
    const name = String(document.querySelector("#setupHostName").value || "").trim();
    if(!name) return toast("Vui lòng nhập tên Host.");
    if(state.hosts.some(x=>x.name===name)) return toast("Host đã tồn tại.");
    state.hosts.push({id:uuid("HOST"), name});
    saveState("Đã thêm Host");
  });
}

function goSetupNext(skipHost=false){
  if(setupStep === 0 && !state.banks.length) return toast("Vui lòng thêm ít nhất 1 mã ngân hàng.");
  if(setupStep === 1 && !state.cards.length) return toast("Vui lòng thêm ít nhất 1 thẻ tín dụng.");
  if(setupStep < 2 && !skipHost){ setupStep += 1; renderSetupWizard(); return; }
  state.settings = {...state.settings, setupCompleted:true};
  saveState("Đã hoàn tất thiết lập ban đầu");
  setView("dashboard");
}

function renderAll(){
  renderDashboard(); renderTransactions(); renderCards(); renderPrograms(); renderPayments(); renderHosts(); renderMcc(); renderBanks(); renderAbout(); renderSyncStatus(); renderSetupWizard(); renderLoginGate();
}
function setView(name){
  currentView=name;
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
  const meta = VIEW_META[name] || {title:name, description:""};
  document.querySelector(".topbar h1").textContent = meta.title;
  document.querySelector("#subtitle").textContent = meta.description;
}

function renderSyncStatus(){
  const meta=localRepository.loadMeta();
  const labels={synced:"Đã đồng bộ",syncing:"Đang đồng bộ...",dirty:"Chưa đồng bộ",conflict:"Có xung đột",disconnected:"Chưa kết nối Google Drive"};
  document.querySelector("#driveStatusText").textContent=labels[meta.status] || (meta.dirty ? labels.dirty : labels.disconnected);
  document.querySelector("#driveStatusText").className=`drive-state ${meta.status||"disconnected"}`;
  document.querySelector("#lastSyncTime").textContent=meta.lastSyncAt ? `Lần cuối: ${new Date(meta.lastSyncAt).toLocaleString("vi-VN")}` : "Chưa có lần đồng bộ thành công";
  const connected = appUnlocked && auth.hasToken();
  document.querySelector("#connectDrive").disabled=!auth.isConfigured() || connected;
  document.querySelector("#connectDrive").textContent=connected ? "Đã kết nối" : "Kết nối Google Drive";
}

function renderLoginGate(){
  const gate = document.querySelector("#loginGate");
  const shell = document.querySelector(".app-shell");
  if(!gate || !shell) return;
  gate.classList.toggle("show", !appUnlocked);
  shell.classList.toggle("locked", !appUnlocked);
  const button = document.querySelector("#gateConnectDrive");
  const status = document.querySelector("#gateStatus");
  if(button) button.style.display = startupReconnectAttempting ? "none" : "";
  if(status && startupReconnectMessage){
    status.textContent = startupReconnectMessage;
    status.classList.toggle("ok", appUnlocked);
  }
}

function showConflict(driveData){
  const box=document.querySelector("#conflictBar");
  box.classList.add("show");
  box.querySelector("[data-download-drive]").onclick=async()=>{ await syncService.downloadDriveVersion(driveData); box.classList.remove("show"); toast("Đã tải bản mới từ Drive"); };
  box.querySelector("[data-keep-local]").onclick=async()=>{ await syncService.keepLocalVersion(); box.classList.remove("show"); toast("Đã giữ bản máy này"); };
  box.querySelector("[data-cancel-conflict]").onclick=()=>box.classList.remove("show");
}

function initPeriod(){
  const y=document.querySelector("#yearFilter"),m=document.querySelector("#monthFilter");
  for(let yr=2026;yr<=2030;yr++) y.insertAdjacentHTML("beforeend",`<option ${yr===selectedYear?"selected":""}>${yr}</option>`);
  for(let mo=1;mo<=12;mo++) m.insertAdjacentHTML("beforeend",`<option value="${mo}" ${mo===selectedMonth?"selected":""}>Tháng ${String(mo).padStart(2,"0")}</option>`);
  y.addEventListener("change",()=>{selectedYear=Number(y.value);renderAll();setView(currentView);});
  m.addEventListener("change",()=>{selectedMonth=Number(m.value);renderAll();setView(currentView);});
}

function excelDateToISO(v){
  if(!v) return "";
  if(typeof v==="string"){
    const m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
    if(/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10);
  }
  if(typeof v==="number" && typeof XLSX!=="undefined"){
    const d=XLSX.SSF.parse_date_code(v); if(d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  return "";
}

document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
async function connectGoogleDriveFromUi(statusEl){
  const attemptId = ++authAttemptId;
  if(statusEl){ statusEl.textContent = "Đang kết nối Google Drive..."; statusEl.classList.remove("ok"); }
  try{
    state = localRepository.load();
    await syncService.connect();
    if(attemptId !== authAttemptId) return;
    localRepository.saveMeta({...localRepository.loadMeta(), googleConnectionPreferred:true});
    appUnlocked = true;
    if(statusEl){ statusEl.textContent = "Đã kết nối Google Drive."; statusEl.classList.add("ok"); }
    renderAll();
    setView("dashboard");
    toast("Đã kết nối Google Drive");
  }catch(e){
    if(attemptId !== authAttemptId) return;
    const message = e.message==="missing-client-id" ? "Chưa cấu hình Google OAuth Client ID." : "Không kết nối được Google Drive. Vui lòng thử lại.";
    if(statusEl){ statusEl.textContent = message; statusEl.classList.remove("ok"); }
    appUnlocked = false;
    renderLoginGate();
    toast(message);
  }
}

async function attemptSilentGoogleReconnect(){
  if(!startupReconnectAttempting) return;
  const attemptId = ++authAttemptId;
  const timeoutMs = 4000;
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("silent-reconnect-timeout")), timeoutMs));
  try{
    state = localRepository.load();
    await Promise.race([auth.connect({prompt:""}), timeout]);
    if(attemptId !== authAttemptId) return;
    appUnlocked = true;
    localRepository.saveMeta({...localRepository.loadMeta(), googleConnectionPreferred:true, status:"syncing"});
    startupReconnectMessage = "Đã kết nối Google Drive.";
    renderAll();
    await syncService.syncNow({silent:true});
    if(attemptId !== authAttemptId) return;
    renderAll();
    setView("dashboard");
  }catch(e){
    if(attemptId !== authAttemptId) return;
    auth.cancelPendingRequest();
    startupReconnectAttempting = false;
    startupReconnectMessage = "Phiên Google cần được xác nhận lại.";
    appUnlocked = false;
    renderAll();
  }finally{
    startupReconnectAttempting = false;
    renderLoginGate();
  }
}
document.querySelector("#gateConnectDrive").addEventListener("click",()=>connectGoogleDriveFromUi(document.querySelector("#gateStatus")));
document.querySelector("#connectDrive").addEventListener("click",()=>connectGoogleDriveFromUi(null));
document.querySelector("#syncNow").addEventListener("click",async()=>{ try{ await syncService.syncNow(); toast("Đã đồng bộ"); }catch(e){ toast(e.message==="offline" ? "Đang offline, dữ liệu đã lưu máy này." : "Đồng bộ thất bại"); } });
document.querySelector("#disconnectDrive").addEventListener("click",()=>{ authAttemptId += 1; syncService.disconnect(); startupReconnectAttempting=false; startupReconnectMessage=""; appUnlocked=false; renderAll(); toast("Đã ngắt kết nối Google Drive"); });
document.querySelector("#setupBack").addEventListener("click",()=>{ setupStep=Math.max(0, setupStep-1); renderSetupWizard(); });
document.querySelector("#setupNext").addEventListener("click",()=>goSetupNext(false));
document.querySelector("#setupSkipHost").addEventListener("click",()=>goSetupNext(true));
syncService.addEventListener("status", e=>{ renderSyncStatus(); if(e.detail.status==="conflict") showConflict(e.detail.driveData); });

document.querySelector("#exportExcel").addEventListener("click",()=>{
  if(typeof XLSX==="undefined"){toast("Không tải được thư viện Excel. Kiểm tra Internet.");return;}
  const wb=XLSX.utils.book_new(), txs=state.transactions, pm=programMetrics(periodTx());
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["CARD FLOW - DASHBOARD"],["Năm",selectedYear,"Tháng",selectedMonth],["Tổng tiền đơn",sum(periodTx(),t=>t.amount)],["Host đã Back",sum(periodTx(),t=>t.backAmount)],["Cashback theo rule",sum(pm,x=>x.countedCashback)]]),"Dashboard");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.banks),"Banks");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.cards),"Cards");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.cashbackPrograms),"Programs");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(txs),"Transactions");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.payments),"Payments");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.hosts),"Hosts");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.mccCategories),"MCC");
  XLSX.writeFile(wb,`CardFlow_${selectedYear}-${String(selectedMonth).padStart(2,"0")}.xlsx`);
});

document.querySelector("#importExcel").addEventListener("change",async e=>{
  const file=e.target.files[0]; if(!file) return;
  if(typeof XLSX==="undefined"){toast("Không tải được thư viện Excel. Kiểm tra Internet.");return;}
  try{
    const buf=await file.arrayBuffer(), wb=XLSX.read(buf,{type:"array"});
    const imported=[];
    wb.SheetNames.filter(n=>/^T\d{2}_THANG_\d{2}$/.test(n)).forEach(name=>{
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{range:2,defval:""});
      rows.forEach(r=>{
        const amount=Number(r["TIỀN ĐƠN (VND)"]||0); if(!amount) return;
        const category=String(r["LOẠI ĐƠN"]||"");
        imported.push({id:uuid("TX"), date:excelDateToISO(r["NGÀY"]), host:String(r["HOST"]||""), category, mcc:Number(r["MCC"]||categoryByName(category)?.mcc||0), channel:"", cardId:String(r["THẺ"]||""), amount, status:String(r["TRẠNG THÁI ĐƠN"]||""), backDate:excelDateToISO(r["NGÀY BACK"]), backAmount:Number(r["TIỀN BACK (VND)"]||0), note:String(r["GHI CHÚ"]||"")});
      });
    });
    state.transactions.push(...imported);
    saveState(`Đã import ${imported.length} giao dịch`);
  }catch(err){console.error(err);toast("Import Excel thất bại");}
  e.target.value="";
});

initPeriod();
renderAll();
setView("dashboard");
attemptSilentGoogleReconnect();
