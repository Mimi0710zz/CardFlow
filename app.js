import { LocalRepository } from "./services/local-repository.js";
import { DriveAuth } from "./services/drive-auth.js";
import { DriveRepository } from "./services/drive-repository.js";
import { SyncService } from "./services/sync-service.js";
import { cloneSeed } from "./services/default-data.js";

const localRepository = new LocalRepository();
let state = localRepository.load();
let selectedYear = new Date().getFullYear();
let selectedMonth = new Date().getMonth() + 1;
let currentView = "dashboard";
const selectedRows = {};
const searchTerms = {};

const auth = new DriveAuth(window.CardFlowConfig || {});
const syncService = new SyncService({
  localRepository,
  auth,
  driveRepository: new DriveRepository(auth),
  getState: () => state,
  setState: next => { state = next; renderAll(); }
});

function money(v){ return new Intl.NumberFormat("vi-VN").format(Math.round(Number(v)||0)) + " ₫"; }
function pct(v){ return Math.round((Number(v)||0)*100) + "%"; }
function uuid(prefix = "ID"){ return crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
function sum(arr, pick=x=>x){ return arr.reduce((a,x)=>a+(Number(pick(x))||0),0); }
function toast(msg){ const el=document.querySelector("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2400); }
function isoMonth(date){ if(!date) return null; const d=new Date(date+"T00:00:00"); return {year:d.getFullYear(),month:d.getMonth()+1}; }
function inPeriod(t){ const p=isoMonth(t.date); return p && p.year===selectedYear && p.month===selectedMonth; }
function hostName(idOrName){ const h=state.hosts.find(x=>x.id===idOrName || x.name===idOrName); return h ? h.name : idOrName; }
function categoryByName(name){ return state.mccCategories.find(x=>x.name===name); }
function cardName(id){ const c=state.cards.find(x=>x.id===id); return c ? `${c.bank} ${c.name}` : id; }
function programs(){ return state.cashbackPrograms; }
function periodTx(){ return state.transactions.filter(inPeriod); }

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
    let remaining=c.groupLimit-debt;
    if(c.limitGroup==="SCB-SHARED"){
      const scbDebt=sum(state.cards.filter(x=>x.limitGroup==="SCB-SHARED"),x=>allDebt(x.id));
      remaining=c.groupLimit-scbDebt;
    }
    const cb=sum(pm.filter(x=>x.cardId===c.id),x=>x.countedCashback);
    const orderProfit=sum(txs.filter(t=>t.cardId===c.id),t=>(Number(t.backAmount)||0)-(Number(t.amount)||0));
    return {...c,monthSpend,debt,remaining:Math.max(0,remaining),cb,profit:orderProfit+cb};
  });
  const reminders=[];
  pm.forEach(x=>{
    if(x.remainTotal===0 && x.remainEligible===0) reminders.push(`<div class="reminder good">${esc(cardName(x.cardId))} - ${esc(x.name)}: đã đạt mục tiêu theo rule demo.</div>`);
    else reminders.push(`<div class="reminder">${esc(cardName(x.cardId))} - ${esc(x.name)}: còn ${money(Math.max(x.remainEligible,x.remainTotal))} theo chỉ tiêu đang theo dõi.</div>`);
  });
  const waitingCount=txs.filter(t=>!t.backAmount).length;
  if(waitingCount) reminders.unshift(`<div class="reminder">${waitingCount} giao dịch chưa ghi nhận tiền Back.</div>`);
  document.querySelector("#view-dashboard").innerHTML = `
    <div class="grid kpis">${kpi("Tổng tiền đơn",totalSpend)}${kpi("Host đã Back",hostBack)}${kpi("Đang chờ Back",waiting)}${kpi("Chênh lệch đơn",orderDelta,true)}${kpi("Cashback theo rule",cashback)}${kpi("Lợi nhuận tháng",profit,true)}</div>
    <div class="grid two-col">
      <div class="card"><div class="section-title"><h2>Tình trạng thẻ</h2><small>Dư nợ = giao dịch - thanh toán đã nhập</small></div>
        <div class="table-wrap"><table><thead><tr><th>Thẻ</th><th>Hạn mức nhóm</th><th>Chi tháng</th><th>Dư nợ</th><th>Còn hạn mức</th><th>Cashback</th><th>Lợi nhuận</th></tr></thead>
        <tbody>${cardRows.map(x=>`<tr><td>${esc(x.bank+" "+x.name)}</td><td class="num">${money(x.groupLimit)}</td><td class="num">${money(x.monthSpend)}</td><td class="num">${money(x.debt)}</td><td class="num">${money(x.remaining)}</td><td class="num">${money(x.cb)}</td><td class="num ${x.profit<0?"negative":"positive"}">${money(x.profit)}</td></tr>`).join("")}</tbody></table></div>
      </div>
      <div class="card"><div class="section-title"><h2>Nhắc nhở</h2></div><div class="reminders">${reminders.join("")||'<div class="reminder good">Chưa có nhắc nhở.</div>'}</div></div>
    </div>
    <div class="card top-space"><div class="section-title"><h2>Tiến độ Cashback / Chỉ tiêu</h2><small>Rule demo theo dữ liệu đã chốt</small></div>
      <div class="table-wrap"><table><thead><tr><th>Thẻ</th><th>Chương trình</th><th>Đúng nhóm</th><th>Tổng chi</th><th>Còn thiếu nhóm</th><th>Còn thiếu chỉ tiêu</th><th>Tiến độ</th><th>CB ghi nhận</th></tr></thead>
      <tbody>${pm.map(x=>`<tr><td>${esc(cardName(x.cardId))}</td><td>${esc(x.name)}</td><td class="num">${money(x.eligible)}</td><td class="num">${money(x.total)}</td><td class="num">${money(x.remainEligible)}</td><td class="num">${money(x.remainTotal)}</td><td><div class="limit-meter"><div class="progress"><i style="width:${Math.round(x.progress*100)}%"></i></div><span>${pct(x.progress)}</span></div></td><td class="num">${money(x.countedCashback)}</td></tr>`).join("")}</tbody></table></div>
    </div>`;
}
function kpi(label,value,signed=false){ return `<div class="card kpi"><span>${esc(label)}</span><strong class="${signed?(value<0?"negative":"positive"):""}">${money(value)}</strong></div>`; }

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

async function openForm(title, fields, initial = {}){
  const modal=document.querySelector("#formModal");
  const body=modal.querySelector(".modal-body");
  modal.querySelector("h2").textContent=title;
  body.innerHTML = fields.map(f => {
    const value = initial[f.name] ?? f.value ?? "";
    if(f.type === "select") return `<div class="field"><label>${esc(f.label)}</label><select name="${esc(f.name)}">${f.options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?"selected":""}>${esc(o.label)}</option>`).join("")}</select></div>`;
    if(f.type === "textarea") return `<div class="field full"><label>${esc(f.label)}</label><textarea name="${esc(f.name)}">${esc(value)}</textarea></div>`;
    return `<div class="field"><label>${esc(f.label)}</label><input name="${esc(f.name)}" type="${esc(f.type||"text")}" value="${esc(value)}" ${f.step?`step="${esc(f.step)}"`:""}></div>`;
  }).join("");
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
        const raw=fd.get(f.name);
        values[f.name] = f.kind === "number" ? Number(raw || 0) : raw;
      });
      close(values);
    };
  });
}

function cardFields(card={}){
  return [
    {name:"id", label:"Card ID", value:card.id || "", type:"text"},
    {name:"bank", label:"Ngân hàng", value:card.bank || "", type:"text"},
    {name:"name", label:"Tên thẻ", value:card.name || "", type:"text"},
    {name:"network", label:"Loại thẻ", value:card.network || "", type:"text"},
    {name:"limitGroup", label:"Nhóm hạn mức", value:card.limitGroup || card.id || "", type:"text"},
    {name:"groupLimit", label:"Hạn mức nhóm (VND)", value:card.groupLimit || 0, type:"number", step:"1", kind:"number"}
  ];
}
function renderCards(){
  const rows=filteredRows("cards", state.cards, c=>`${c.id} ${c.bank} ${c.name} ${c.network} ${c.limitGroup}`);
  document.querySelector("#view-cards").innerHTML=`<div class="card">${toolbar("cards")}<div class="table-wrap"><table data-entity="cards"><thead><tr><th>Ngân hàng</th><th>Tên thẻ</th><th>Loại thẻ</th><th>Card ID</th><th>Nhóm hạn mức</th><th>Hạn mức</th><th>Dư nợ</th></tr></thead><tbody>
  ${rows.map(c=>`<tr data-id="${esc(c.id)}" class="${selectedRows.cards===c.id?"selected":""}"><td>${esc(c.bank)}</td><td>${esc(c.name)}</td><td>${esc(c.network||"Chưa nhập loại thẻ")}</td><td>${esc(c.id)}</td><td>${esc(c.limitGroup)}</td><td class="num">${money(c.groupLimit)}</td><td class="num">${money(allDebt(c.id))}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("cards", {
    add: async()=>{ const v=await openForm("Thêm thẻ tín dụng", cardFields()); if(!v) return; state.cards.push(v); saveState("Đã thêm thẻ"); },
    edit: async id=>{ const i=state.cards.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa thẻ tín dụng", cardFields(state.cards[i]), state.cards[i]); if(!v) return; state.cards[i]=v; selectedRows.cards=v.id; saveState("Đã cập nhật thẻ"); },
    remove: id=>{ if(!confirm("Xóa thẻ đã chọn? Các giao dịch/thanh toán liên quan sẽ không bị xóa.")) return; state.cards=state.cards.filter(x=>x.id!==id); selectedRows.cards=""; saveState("Đã xóa thẻ"); }
  });
}

function selectOptions(items, labelFn, valueFn=x=>x.id){ return items.map(x=>({value:valueFn(x), label:labelFn(x)})); }
function programFields(program={}){
  return [
    {name:"id", label:"Mã chương trình", value:program.id || "", type:"text"},
    {name:"cardId", label:"Thẻ", value:program.cardId || state.cards[0]?.id || "", type:"select", options:selectOptions(state.cards, c=>`${c.bank} ${c.name}`)},
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
    {name:"cardId", label:"Thẻ", value:tx.cardId || state.cards[0]?.id || "", type:"select", options:selectOptions(state.cards, c=>`${c.bank} ${c.name}`)},
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
    {name:"cardId", label:"Thẻ", value:p.cardId || state.cards[0]?.id || "", type:"select", options:selectOptions(state.cards, c=>`${c.bank} ${c.name}`)},
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

function renderAll(){
  renderDashboard(); renderTransactions(); renderCards(); renderPrograms(); renderPayments(); renderHosts(); renderMcc(); renderSyncStatus();
}
function setView(name){
  currentView=name;
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
  const titles={dashboard:"Dashboard",transactions:"Giao dịch",cards:"Thẻ tín dụng",programs:"Chương trình Cashback",payments:"Thanh toán thẻ",hosts:"Hosts",mcc:"Nhóm MCC"};
  document.querySelector("#viewTitle").textContent=titles[name]||name;
}

function renderSyncStatus(){
  const meta=localRepository.loadMeta();
  const labels={synced:"Đã đồng bộ",syncing:"Đang đồng bộ...",dirty:"Chưa đồng bộ",conflict:"Có xung đột",disconnected:"Chưa kết nối Google Drive"};
  document.querySelector("#driveStatusText").textContent=labels[meta.status] || (meta.dirty ? labels.dirty : labels.disconnected);
  document.querySelector("#driveStatusText").className=`drive-state ${meta.status||"disconnected"}`;
  document.querySelector("#lastSyncTime").textContent=meta.lastSyncAt ? `Lần cuối: ${new Date(meta.lastSyncAt).toLocaleString("vi-VN")}` : "Chưa có lần đồng bộ thành công";
  document.querySelector("#connectDrive").disabled=!auth.isConfigured();
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
document.querySelector("#resetDemo").addEventListener("click",()=>{ if(confirm("Xóa toàn bộ dữ liệu demo đã nhập trên trình duyệt này?")){state=cloneSeed(); state.deviceId=localRepository.loadMeta().deviceId || state.deviceId; saveState("Đã reset demo");} });
document.querySelector("#connectDrive").addEventListener("click",async()=>{ try{ await syncService.connect(); toast("Đã kết nối Google Drive"); }catch(e){ toast(e.message==="missing-client-id" ? "Chưa cấu hình Google OAuth Client ID." : "Không kết nối được Google Drive"); } });
document.querySelector("#syncNow").addEventListener("click",async()=>{ try{ await syncService.syncNow(); toast("Đã đồng bộ"); }catch(e){ toast(e.message==="offline" ? "Đang offline, dữ liệu đã lưu máy này." : "Đồng bộ thất bại"); } });
document.querySelector("#disconnectDrive").addEventListener("click",()=>{ syncService.disconnect(); renderSyncStatus(); toast("Đã ngắt kết nối Google Drive"); });
syncService.addEventListener("status", e=>{ renderSyncStatus(); if(e.detail.status==="conflict") showConflict(e.detail.driveData); });

document.querySelector("#exportExcel").addEventListener("click",()=>{
  if(typeof XLSX==="undefined"){toast("Không tải được thư viện Excel. Kiểm tra Internet.");return;}
  const wb=XLSX.utils.book_new(), txs=state.transactions, pm=programMetrics(periodTx());
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["CARD FLOW - DASHBOARD"],["Năm",selectedYear,"Tháng",selectedMonth],["Tổng tiền đơn",sum(periodTx(),t=>t.amount)],["Host đã Back",sum(periodTx(),t=>t.backAmount)],["Cashback theo rule",sum(pm,x=>x.countedCashback)]]),"Dashboard");
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
if(auth.hasToken()) syncService.syncNow({silent:true});
