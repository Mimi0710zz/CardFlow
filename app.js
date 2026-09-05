import { LocalRepository } from "./services/local-repository.js";
import { DriveAuth } from "./services/drive-auth.js";
import { DriveRepository } from "./services/drive-repository.js";
import { SyncService } from "./services/sync-service.js";
import { cloneSeed } from "./services/default-data.js";
import { formatMoneyDisplay, formatMoneyInput, normalizeMoney, parseMoney } from "./services/money.js";
import { formatDateDisplay, formatDateTimeDisplay, isValidDate, toStorageDate } from "./services/date.js";
import { summarizeCardStatusRows } from "./services/card-status-summary.js";
import { ALL_MCC_VALUE, ALL_ORDER_TYPE_VALUE, applySharedCashbackDisplay, buildCashbackProgramId, calculateProgramCashback, calculateRuleProgress, calculateSpendToMax, formatCashbackRate, isCashbackCombinationSatisfied, isCashbackUnlimited, isLegacyVpDebitFakeUnlimited, isMccEligible, normalizeCashbackConditions, normalizeCombineOperator, normalizeProgramMcc, normalizeTransactionMethod } from "./services/cashback.js";
import { buildFeeTargetId, calculateFeeTargetMetrics, feeTargetReminder, formatFeeProgress, sortFeeReminderMetrics, sortFeeTargetMetrics } from "./services/fee-target.js";
import { TRANSACTION_STATUS, TRANSACTION_STATUS_OPTIONS, isHostFeeApplicable, normalizeTransactionStatus, transactionStatusLabel } from "./services/transaction-status.js";
import { matchesTransactionFilters } from "./services/transaction-filter.js";
import { buildCardPaymentObligations, calculatePaymentDueWarnings, calculateStatementDateAdvisories, effectivePaymentDueDateForCycle, isValidPaymentCycle, paymentCycleFromDate, paymentDueWarningText, statementDateAdvisoryText } from "./services/payment-due.js";
import { carryForwardCashbackPrograms, cashbackProgramsForPeriod } from "./services/cashback-period.js";

const localRepository = new LocalRepository();
let state = cloneSeed();
let selectedYear = new Date().getFullYear();
let selectedMonth = new Date().getMonth() + 1;
let currentView = "dashboard";
let setupStep = 0;
const AUTH_STATE = {
  DISCONNECTED: "DISCONNECTED",
  MANUAL_CONNECTING: "MANUAL_CONNECTING",
  CONNECTED: "CONNECTED",
  ERROR: "ERROR"
};
const TRANSACTION_METHOD_OPTIONS = sortOptionsByVietnameseLabel([
  {value:"Online", label:"Online"},
  {value:"Offline", label:"Offline"},
  {value:"pos", label:"Quẹt POS"}
]);
const TRANSACTION_METHOD_OPTIONS_WITH_ALL = [{value:"", label:"Tất cả"}, ...TRANSACTION_METHOD_OPTIONS];
let authState = AUTH_STATE.DISCONNECTED;
let authMessage = "";
let authAttemptId = 0;
const selectedRows = {};
const selectedRowSets = {};
const selectionAnchors = {};
let activeTableContext = null;
const expandedAccordionRows = new Set();
const searchTerms = {};
const cardFilters = {bankId:"",cardType:"",network:"",cardForm:""};
let cardFilterOpen = false;
const transactionFilters = {cardId:"",category:"",host:"",channel:"",status:"",mcc:"",dateFrom:"",dateTo:""};
let transactionFilterOpen = false;
let filterPanelOutsideHandler = null;
let feeStatusFilter = "all";
const PAYMENT_WARNING_INTERVAL_MS = 30 * 60 * 1000;
let paymentWarningTimer = null;
let nextPaymentWarningCheckAt = 0;

const VIEW_META = {
  dashboard: {title:"Tổng hợp", description:"Tổng quan dòng tiền, dư nợ và cashback."},
  transactions: {title:"Giao dịch", description:"Quản lý giao dịch và theo dõi trạng thái hoàn tiền."},
  cards: {title:"Thẻ", description:"Quản lý thẻ Credit/Debit, thông tin và hạn mức liên quan."},
  programs: {title:"Chương trình cashback", description:"Thiết lập và theo dõi các chương trình, tỷ lệ và điều kiện hoàn tiền."},
  "cashback-receipts": {title:"Cashback thực nhận", description:"Ghi nhận các đợt tiền cashback thực tế đã nhận từ ngân hàng."},
  "fee-targets": {title:"Tiến độ hoàn phí thường niên", description:"Theo dõi mức chi tiêu, thời gian còn lại và tiến độ đạt điều kiện hoàn phí."},
  payments: {title:"Thanh toán thẻ", description:"Quản lý các khoản thanh toán và dư nợ thẻ."},
  hosts: {title:"Hosts", description:"Quản lý danh sách Host sử dụng trong giao dịch."},
  mcc: {title:"Bảng MCC", description:"Quản lý danh mục MCC phục vụ phân loại giao dịch."},
  banks: {title:"Mã ngân hàng", description:"Quản lý ngân hàng và mã viết tắt hiển thị trong ứng dụng."},
  about: {title:"Thông tin & Hướng dẫn", description:"Trung tâm trợ giúp, đồng bộ dữ liệu và thông tin phiên bản."}
};

const SIDEBAR_STORAGE_KEY="cardflow-sidebar-expanded";
const MASTER_DATA_VIEWS=new Set(["cards","banks","mcc"]);
const HELP_TOPIC_BY_VIEW={dashboard:"dashboard",cards:"cards",programs:"cashback",transactions:"transactions","cashback-receipts":"cashback-receipts","fee-targets":"annual-fee",payments:"payments",hosts:"getting-started",mcc:"getting-started",banks:"getting-started"};
let activeHelpTab="intro", activeHelpTopic="getting-started", helpSearchTerm="";
const ICON_PATHS={menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',x:'<path d="m18 6-12 12M6 6l12 12"/>','layout-dashboard':'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>','credit-card':'<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>','badge-percent':'<circle cx="9" cy="9" r="2"/><circle cx="15" cy="15" r="2"/><path d="m16 8-8 8M12 2l3 2 3-.5.5 3 2 2-2 2 .5 3-3-.5-3 2-3-2-3 .5.5-3-2-2 2-2-.5-3 3 .5Z"/>','receipt-text':'<path d="M4 2v20l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2V2l-2 2-2-2-2 2-2-2-2 2-2-2-2 2Z"/><path d="M16 8h-6M16 12h-6M13 16h-3"/>','circle-dollar':'<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 18V6"/>',chart:'<path d="M3 3v18h18M7 16v-4M12 16V8M17 16V5"/>','wallet-cards':'<path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10H5a3 3 0 0 1-3-3V7"/><path d="M16 15h2"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>','table-properties':'<path d="M15 3v18M3 9h18M3 15h18"/><rect width="18" height="18" x="3" y="3" rx="2"/>',landmark:'<path d="m3 10 9-7 9 7M5 10v8M9 10v8M15 10v8M19 10v8M3 22h18"/>','circle-help':'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.83 1c0 2-3 2-3 4M12 18h.01"/>'};
Object.assign(ICON_PATHS,{plus:'<path d="M12 5v14M5 12h14"/>',pencil:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',filter:'<path d="M4 5h16l-6 7v5l-4 2v-7Z"/>','chevron-down':'<path d="m6 9 6 6 6-6"/>'});
function icon(name){return `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]||ICON_PATHS['circle-help']}</svg>`;}

const auth = new DriveAuth(window.CardFlowConfig || {});
console.info("[CardFlow Origin]", {
  origin: window.location.origin,
  href: window.location.href
});
const syncService = new SyncService({
  localRepository,
  auth,
  driveRepository: new DriveRepository(auth),
  getState: () => state,
  setState: next => { state = next; if(currentView==="programs" && ensureCashbackProgramsForSelectedPeriod()) return; renderAll(); }
});

function pct(v){ return Math.round((Number(v)||0)*100) + "%"; }
function formatPercentDisplay(value, emptyText="—"){
  if(value === "" || value == null) return emptyText;
  const number=Number(value);
  if(!Number.isFinite(number)) return emptyText;
  return `${number.toLocaleString("vi-VN",{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
}
function uuid(prefix = "ID"){ return crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function prefixedUuid(prefix){ return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`; }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
function sum(arr, pick=x=>x){ return arr.reduce((a,x)=>a+(Number(pick(x))||0),0); }
function compareVietnameseText(a,b){
  const left=String(a??"").trim(),right=String(b??"").trim();
  if(!left||!right) return left? -1:right? 1:0;
  return left.localeCompare(right,"vi",{sensitivity:"base",numeric:true});
}
function sortDisplayRows(rows,...valueGetters){
  return rows.map((row,index)=>({row,index})).sort((a,b)=>{
    for(const getValue of valueGetters){
      const comparison=compareVietnameseText(getValue(a.row),getValue(b.row));
      if(comparison) return comparison;
    }
    return a.index-b.index;
  }).map(item=>item.row);
}
function sortOptionsByVietnameseLabel(options=[]){
  return options.map((option,index)=>({option,index})).sort((a,b)=>{
    const comparison=compareVietnameseText(a.option.label,b.option.label);
    return comparison || a.index-b.index;
  }).map(item=>item.option);
}
function toast(msg){ const el=document.querySelector("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2400); }
function paymentObligations(){ return buildCardPaymentObligations(state.cards,state.transactions,state.payments); }
function paymentWarnings(){ return calculatePaymentDueWarnings(state.cards,state.transactions,state.payments); }
function statementDateAdvisories(){ return calculateStatementDateAdvisories(state.cards,state.transactions); }
function paymentWarningReady(){ return isConnected() && state.settings?.setupCompleted === true; }
function paymentWarningDialogOpen(){ return document.querySelector("#paymentWarningModal")?.classList.contains("show") === true; }
function schedulePaymentWarningCheck(delay=PAYMENT_WARNING_INTERVAL_MS){
  if(paymentWarningTimer) clearTimeout(paymentWarningTimer);
  nextPaymentWarningCheckAt=Date.now()+delay;
  paymentWarningTimer=setTimeout(()=>{
    paymentWarningTimer=null;
    nextPaymentWarningCheckAt=0;
    evaluatePaymentWarnings();
  },delay);
}
function hidePaymentWarning({schedule=true}={}){
  document.querySelector("#paymentWarningModal")?.classList.remove("show");
  if(schedule && paymentWarningReady()) schedulePaymentWarningCheck();
}
function renderPaymentWarningDialog(warnings){
  const modal=document.querySelector("#paymentWarningModal");
  if(!modal) return;
  modal.querySelector(".payment-warning-list").innerHTML=warnings.map(warning=>`<div class="reminder payment-due ${warning.status}"><strong>${esc(warning.card.id)}</strong><span>${esc(paymentDueWarningText(warning,cardName(warning.card.id)))}</span></div>`).join("");
  modal.classList.add("show");
}
function evaluatePaymentWarnings(){
  if(!paymentWarningReady()) return hidePaymentWarning({schedule:false});
  const warnings=paymentWarnings();
  if(warnings.length){
    if(paymentWarningTimer) clearTimeout(paymentWarningTimer);
    paymentWarningTimer=null;
    nextPaymentWarningCheckAt=0;
    renderPaymentWarningDialog(warnings);
    return;
  }
  hidePaymentWarning({schedule:false});
  schedulePaymentWarningCheck();
}
function startPaymentWarningReminder(){
  if(paymentWarningTimer) clearTimeout(paymentWarningTimer);
  paymentWarningTimer=null;
  nextPaymentWarningCheckAt=0;
  evaluatePaymentWarnings();
}
function stopPaymentWarningReminder(){
  if(paymentWarningTimer) clearTimeout(paymentWarningTimer);
  paymentWarningTimer=null;
  nextPaymentWarningCheckAt=0;
  hidePaymentWarning({schedule:false});
}
function refreshOpenPaymentWarningDialog(){
  if(!paymentWarningDialogOpen()) return;
  const warnings=paymentWarnings();
  if(warnings.length) renderPaymentWarningDialog(warnings);
  else hidePaymentWarning();
}
function isConnected(){ return authState === AUTH_STATE.CONNECTED; }
function isManualConnecting(){ return authState === AUTH_STATE.MANUAL_CONNECTING; }
function setAuthState(nextState, message = ""){
  authState = nextState;
  authMessage = message;
  renderLoginGate();
  renderSyncStatus();
  renderSetupWizard();
}
function logGoogleAuthDiagnostic(error, phase){
  console.error("[Google OAuth]", {
    phase,
    name: error?.name,
    message: error?.message,
    code: error?.code,
    source: error?.source,
    error: error?.details?.error,
    error_description: error?.details?.error_description,
    error_uri: error?.details?.error_uri,
    type: error?.details?.type
  });
}
function connectionMessageForError(error){
  const code = error?.code || error?.message || "";
  if(code === "gis-not-loaded") return "Không tải được dịch vụ đăng nhập Google. Vui lòng tải lại trang.";
  if(code === "idpiframe_initialization_failed") return "Không thể đăng nhập Google trong trình duyệt hiện tại. Vui lòng dùng Chrome/Safari hệ thống, cho phép cookie/lưu trữ trang cho Google, và tránh mở CardFlow trong trình duyệt nhúng từ ứng dụng khác.";
  if(code === "popup_closed" || code === "popup_failed_to_open" || code === "access_denied" || code === "origin_mismatch" || code === "invalid_client") return "Không thể đăng nhập Google.";
  if(/^drive-40[13]/.test(code)) return "Đã đăng nhập Google nhưng không thể truy cập Google Drive.";
  if(code === "offline" || error?.name === "TypeError") return "Không thể kết nối mạng tới Google Drive.";
  if(error?.name === "AbortError" || code === "drive-init-timeout") return "Đã đăng nhập Google nhưng không thể truy cập Google Drive.";
  return "Không thể đăng nhập Google.";
}
function isoMonth(date){ if(!date) return null; const d=new Date(date+"T00:00:00"); return {year:d.getFullYear(),month:d.getMonth()+1}; }
function inPeriod(t){ const p=isoMonth(t.date); return p && p.year===selectedYear && p.month===selectedMonth; }
function todayStorageDate(){ return toStorageDate(new Date()); }
function hostName(idOrName){ if(idOrName == null || idOrName === "") return ""; const h=state.hosts.find(x=>x.id===idOrName || x.name===idOrName); return h ? h.name : idOrName; }
function categoryByName(name){ return state.mccCategories.find(x=>x.name===name); }
function bankName(bankId, fallback=""){ const b=state.banks.find(x=>x.id===bankId); return b ? b.name : fallback; }
function bankCode(bankId){ return state.banks.find(x=>x.id===bankId)?.code || ""; }
function cardName(id){ const c=state.cards.find(x=>x.id===id); return c ? `${bankName(c.bankId,c.bank)} ${c.name}` : id; }
function programs(){ return cashbackProgramsForPeriod(state.cashbackPrograms,selectedYear,selectedMonth); }
function periodTx(){ return state.transactions.filter(inPeriod); }
function periodCashbackReceipts(){ return state.cashbackReceipts.filter(inPeriod); }
function normalizeBankCode(code){ return String(code || "").trim().toUpperCase(); }
function normalizeBankName(name){ return String(name || "").trim(); }
function bankIdFromCode(code){ return `BANK-${normalizeBankCode(code)}`; }
function cardFormLabel(value){
  return value === "physical" ? "Vật lý" : value === "virtual" ? "Phi vật lý" : "Chưa chọn";
}
function cardTypeLabel(value){ return String(value || "").toLowerCase() === "debit" ? "Ghi nợ (Debit)" : "Tín dụng (Credit)"; }
function cardDisplayName(card){
  return `${bankName(card.bankId,card.bank)} - ${card.name}`.trim();
}
function groupIdForCard(card){
  return card.limitGroupId || `LG-${String(card.limitGroup || card.id).trim().toUpperCase().replace(/[^A-Z0-9-]+/g,"-").replace(/-+/g,"-")}`;
}
function groupMembers(groupId){
  return state.cards.filter(card => card.cardType !== "debit" && groupIdForCard(card) === groupId);
}
function groupLimit(groupId){
  const members = groupMembers(groupId);
  return Number(members[0]?.groupLimit || 0);
}
function sharedLimitLabel(card){
  if(card.cardType === "debit") return "—";
  const members = groupMembers(groupIdForCard(card)).filter(x=>x.id!==card.id);
  return members.length ? members.map(x=>x.id).sort((a,b)=>a.localeCompare(b,"vi")).join(", ") : "Không";
}
function selectedSharedCardsForForm(card={}){
  if(card.cardType === "debit") return ["__NONE__"];
  if(!card.id) return ["__NONE__"];
  const members = groupMembers(groupIdForCard(card)).filter(x=>x.id!==card.id);
  return members.length ? members.map(x=>x.id) : ["__NONE__"];
}
function sharedLimitOptions(currentId="", bankId=""){
  return [
    {value:"__NONE__", label:"Không"},
    ...state.cards.filter(card=>card.id!==currentId && card.cardType!=="debit" && (!bankId || card.bankId===bankId))
      .map(card=>({value:card.id,label:card.id})).sort((a,b)=>a.label.localeCompare(b.label,"vi"))
  ];
}
function sharedLimitSummary(selectedIds=[]){
  const selected = normalizeSharedSelection(selectedIds);
  if(!selected.length) return "Không";
  const cards = selected.map(id=>state.cards.find(card=>card.id===id)).filter(Boolean);
  if(cards.length === 1) return cards[0].id;
  if(cards.length === 2) return `${cards[0].id} + 1 thẻ khác`;
  return `Đang dùng chung với ${cards.length} thẻ`;
}
function annualFeeLabel(value){
  return formatMoneyDisplay(value, {emptyText:"Chưa thiết lập"});
}
function paymentDueDayLabel(value){
  return Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 31 ? `Ngày ${Number(value)}` : "—";
}
function normalizeSharedSelection(selection=[]){
  const selected = Array.isArray(selection) ? selection : [selection];
  return selected.includes("__NONE__") ? [] : selected.filter(Boolean);
}
function syncGroupLimits(groupId, limit){
  state.cards.filter(card=>card.cardType!=="debit").forEach(card => {
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
  const selectedCards=selected.map(id => state.cards.find(item => item.id === id)).filter(Boolean);
  if(selectedCards.some(item=>item.bankId!==card.bankId)) return {error:"Chỉ có thể dùng chung hạn mức với thẻ cùng ngân hàng."};
  const groups = [...new Set(selectedCards.map(groupIdForCard))];
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
function txStatusBadge(status){
  const value = normalizeTransactionStatus(status);
  const label = transactionStatusLabel(value);
  let tone = "neutral";
  if(value === TRANSACTION_STATUS.HOST_BACK) tone = "success";
  else if(value === TRANSACTION_STATUS.ISSUE) tone = "warning";
  else if(value === TRANSACTION_STATUS.CANCELLED) tone = "danger";
  return `<span class="transaction-status transaction-status--${tone}">${esc(label)}</span>`;
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
    if(program.channel && normalizeTransactionMethod(t.channel)!==normalizeTransactionMethod(program.channel)) return false;
    if(!isMccEligible(program, t, state.mccCategories)) return false;
    return true;
  }),t=>t.amount);
}

function isProgramTransactionEligible(program, transaction){
  if(transaction.cardId!==program.cardId) return false;
  if(program.channel && normalizeTransactionMethod(transaction.channel)!==normalizeTransactionMethod(program.channel)) return false;
  if(!isMccEligible(program, transaction, state.mccCategories)) return false;
  return true;
}
function transactionChronologyCompare(a,b){
  return String(a.date || "").localeCompare(String(b.date || "")) || String(a.id || "").localeCompare(String(b.id || ""));
}
function programMetrics(txs){
  const metrics=programs().map(rawProgram=>{
    const program=normalizedProgramForDisplay(rawProgram);
    const combineOperator=normalizeCombineOperator(program.combineOperator);
    const cardTransactions=txs.filter(transaction=>transaction.cardId===program.cardId);
    const total=sum(cardTransactions,transaction=>transaction.amount);
    const conditionMetrics=normalizeCashbackConditions(program,state.mccCategories).map(condition=>{
      const eligible=eligibleSpend({...condition,cardId:program.cardId},cardTransactions);
      const progress=isCashbackUnlimited(condition)?(eligible>0?1:0):calculateRuleProgress(condition,eligible,total);
      return {...condition,eligible,rawCashback:calculateProgramCashback(condition,eligible),progress,remainEligible:condition.eligibleTarget==null?null:Math.max(0,condition.eligibleTarget-eligible)};
    });
    const totalCondition=program.totalSpendCondition || {enabled:program.totalTarget!=null,amount:program.totalTarget};
    const totalTarget=totalCondition.enabled ? Number(totalCondition.amount)||0 : null;
    const totalMetric=totalCondition.enabled ? {progress:totalTarget>0?Math.min(1,total/totalTarget):0} : null;
    const parts=totalMetric ? [...conditionMetrics,totalMetric] : conditionMetrics;
    const combinationSatisfied=isCashbackCombinationSatisfied(parts.map(part=>({...part,combineOperator})));
    const progress=parts.length ? (combineOperator==="AND" ? Math.min(...parts.map(part=>part.progress)) : Math.max(...parts.map(part=>part.progress))) : 0;
    const remainValues=conditionMetrics.map(item=>item.remainEligible).filter(value=>value!=null);
    return {...program,conditions:conditionMetrics,combineOperator,totalSpendCondition:{enabled:Boolean(totalCondition.enabled),amount:totalTarget},eligible:sum(conditionMetrics,item=>item.eligible),total,
      rawCashback:sum(conditionMetrics,item=>item.rawCashback),eligibleTarget:sum(conditionMetrics,item=>item.eligibleTarget)||null,totalTarget,
      remainEligible:remainValues.length?(combineOperator==="AND"?sum(remainValues):Math.min(...remainValues)):null,
      remainTotal:totalTarget==null?null:Math.max(0,totalTarget-total),progress,combinationSatisfied};
  });
  return applySharedCashbackDisplay(metrics);
}

function transactionDifference(transaction){
  return (Number(transaction.backAmount)||0)-(Number(transaction.amount)||0);
}
function transactionHostFee(transaction){
  return isHostFeeApplicable(transaction) ? transactionDifference(transaction) : null;
}
function transactionHostFeeValue(transaction){
  return transactionHostFee(transaction) ?? 0;
}

function optionalMoneyDisplay(value){
  return value == null ? "Không áp dụng" : formatMoneyDisplay(value);
}
function ruleProgressDisplay(program){
  const hasTarget=(Number(program?.eligibleTarget)||0)>0 || (Number(program?.totalTarget)||0)>0;
  if(!hasTarget) return "Không áp dụng";
  const progress=Number(program.progress)||0;
  return `<div class="limit-meter"><div class="progress ${progressClass(progress)}"><i style="width:${Math.round(progress*100)}%"></i></div><span>${pct(progress)}</span></div>`;
}
function cashbackReminderRemaining(program){
  if(program?.competitionLocked) return null;
  if((Number(program?.progress)||0) >= 1) return null;
  const remainingValues=[program?.remainEligible,program?.remainTotal].filter(value=>value != null);
  if(!remainingValues.length) return null;
  const remain=Math.max(...remainingValues);
  return remain > 0 ? remain : null;
}

function renderDashboard(){
  const txs=periodTx();
  const totalSpend=sum(txs,t=>t.amount);
  const hostFeeRows=txs.filter(isHostFeeApplicable);
  const hostBack=sum(hostFeeRows,t=>t.backAmount);
  const waiting=Math.max(0,sum(hostFeeRows,t=>t.amount)-hostBack);
  const orderDelta=sum(txs,transactionHostFeeValue);
  const pm=programMetrics(txs);
  const cashback=sum(pm,x=>x.countedCashback);
  const actualCashback=sum(periodCashbackReceipts(),x=>x.amount);
  const profit=orderDelta+cashback;
  const cardRows=sortDisplayRows(state.cards.map(c=>{
    const isDebit=c.cardType==="debit";
    const monthSpend=sum(txs.filter(t=>t.cardId===c.id),t=>t.amount);
    const debt=isDebit?0:allDebt(c.id);
    const groupId = groupIdForCard(c);
    const actualGroupLimit = isDebit?0:(groupLimit(groupId) || c.groupLimit);
    const remaining=isDebit?0:actualGroupLimit-groupDebt(groupId);
    const cb=sum(pm.filter(x=>x.cardId===c.id),x=>x.countedCashback);
    const orderProfit=sum(txs.filter(t=>t.cardId===c.id),transactionHostFeeValue);
    return {...c,limitGroupId:groupId,monthSpend,debt,groupLimit:actualGroupLimit,remaining:Math.max(0,remaining),cb,profit:orderProfit+cb};
  }),card=>card.id);
  const cardStatusSummary=summarizeCardStatusRows(cardRows);
  const reminders=[];
  pm.forEach(x=>{
    const remain=cashbackReminderRemaining(x);
    if(remain != null) reminders.push(`<div class="reminder ${x.progress>=0.75?"near":"warn"}">${esc(cardName(x.cardId))} - ${esc(x.name)}: còn ${formatMoneyDisplay(remain)} theo chỉ tiêu đang theo dõi.</div>`);
  });
  const waitingCount=hostFeeRows.filter(t=>!t.backAmount).length;
  if(waitingCount) reminders.unshift(`<div class="reminder warn">${waitingCount} giao dịch chưa ghi nhận tiền Back.</div>`);
  const paymentDueReminders=paymentWarnings();
  reminders.unshift(...paymentDueReminders.map(warning=>`<div class="reminder payment-due ${warning.status}"><strong>${esc(warning.card.id)}</strong><span>${esc(paymentDueWarningText(warning,cardName(warning.card.id)))}</span></div>`));
  reminders.unshift(...statementDateAdvisories().map(advisory=>`<div class="reminder warn"><strong>${esc(advisory.card.id)}</strong><span>${esc(statementDateAdvisoryText(advisory,cardName(advisory.card.id)))}</span></div>`));
  const feeReminders=sortFeeReminderMetrics(feeTargetMetrics().filter(item=>item.reminderEnabled!==false)).slice(0,5);
  const sortedProgramRows=sortDisplayRows(pm,program=>program.cardId,program=>program.name);
  document.querySelector("#view-dashboard").innerHTML = `
    <div class="grid kpis">${kpi("Tổng tiền đơn",totalSpend,false,"blue")}${kpi("Host đã Back",hostBack,false,"teal")}${kpi("Đang chờ Back",waiting,false,"amber")}${kpi("Chênh lệch đơn",orderDelta,true,orderDelta>0?"green":orderDelta<0?"red":"")}${kpi("Cashback theo rule",cashback,false,"indigo")}${kpi("Cashback thực nhận",actualCashback,false,"green")}${kpi("Lợi nhuận tháng",profit,true,profit>0?"green":profit<0?"red":"")}</div>
    <div class="grid two-col">
      <div class="card"><div class="section-title"><h2>Tình trạng thẻ</h2><small>Dư nợ = giao dịch - thanh toán đã nhập</small></div>
        <div class="table-wrap"><table data-accordion-entity="cardStatus"><thead><tr><th>Card ID</th><th>Hạn mức nhóm</th><th>Chi tháng</th><th>Dư nợ</th><th>Còn hạn mức</th><th>CB theo rule</th><th>Lợi nhuận ước tính</th></tr></thead>
        <tbody>${cardRows.map(x=>{ const debit=x.cardType==="debit"; return `<tr data-accordion-id="${esc(x.id)}" class="${debit?"debit-row":""}"><td>${esc(x.id)}</td><td class="num">${debit?"—":formatMoneyDisplay(x.groupLimit)}</td><td class="num">${formatMoneyDisplay(x.monthSpend)}</td><td class="num">${debit?"—":formatMoneyDisplay(x.debt)}</td><td class="num ${debit?"":limitHealthClass(x.remaining,x.groupLimit)}">${debit?"—":formatMoneyDisplay(x.remaining)}</td><td class="num">${formatMoneyDisplay(x.cb)}</td><td class="num ${x.profit<0?"negative":x.profit>0?"positive":"neutral"}">${formatMoneyDisplay(x.profit)}</td></tr>`; }).join("")}<tr class="summary-row"><td>Tổng</td><td class="num">${formatMoneyDisplay(cardStatusSummary.totalLimit)}</td><td class="num">${formatMoneyDisplay(cardStatusSummary.monthlySpend)}</td><td class="num">${formatMoneyDisplay(cardStatusSummary.outstanding)}</td><td class="num">${formatMoneyDisplay(cardStatusSummary.remainingLimit)}</td><td class="num">${formatMoneyDisplay(cardStatusSummary.cashback)}</td><td class="num ${cardStatusSummary.estimatedProfit<0?"negative":cardStatusSummary.estimatedProfit>0?"positive":"neutral"}">${formatMoneyDisplay(cardStatusSummary.estimatedProfit)}</td></tr></tbody></table></div>
        <p class="card-status-note">Lợi nhuận ước tính được tính dựa trên số tiền được hoàn theo chương trình của mỗi thẻ (có thể chưa hoàn về đầy đủ), số tiền đã đi đơn và số tiền Host đã Back về.</p>
      </div>
      <div class="card"><div class="section-title"><h2>Nhắc nhở</h2></div><div class="reminders">${reminders.join("")||'<div class="reminder good">Chưa có nhắc nhở.</div>'}</div></div>
    </div>
    <div class="card top-space"><div class="section-title"><h2>Tiến độ Cashback theo rule / Chỉ tiêu</h2><small>Rule demo theo dữ liệu đã chốt</small></div>
      <div class="table-wrap dashboard-cashback-wrap"><table class="mobile-card-table dashboard-cashback-table" data-accordion-entity="dashboardCashback"><thead><tr><th>Card ID</th><th>Chương trình</th><th>Đúng nhóm</th><th>Tổng chi</th><th>Còn thiếu nhóm</th><th>Còn thiếu chỉ tiêu</th><th>Tiến độ</th><th>CB theo rule</th></tr></thead>
      <tbody>${sortedProgramRows.map(x=>`<tr data-accordion-id="${esc(x.id)}" class="${x.competitionLocked?"cashback-rule-locked":""}"><td>${esc(x.cardId)}</td><td>${esc(x.name)}${x.competitionLocked?` <span class="badge locked-badge" title="Đã khóa vì chương trình ${esc(x.competitionWinnerId)} đã đạt 100% trước trong tháng này.">Đã khóa</span>`:""}</td><td class="num">${formatMoneyDisplay(x.eligible)}</td><td class="num">${formatMoneyDisplay(x.total)}</td><td class="num">${optionalMoneyDisplay(x.remainEligible)}</td><td class="num">${optionalMoneyDisplay(x.remainTotal)}</td><td>${ruleProgressDisplay(x)}</td><td class="num">${formatMoneyDisplay(x.displayCashback)}</td></tr>`).join("")}</tbody></table></div>
    </div>
    <div class="card top-space fee-reminder-card"><div class="section-title"><h2>Nhắc nhở hoàn phí thường niên</h2><button class="secondary-btn" data-open-fee-targets>Xem tất cả</button></div><div class="reminders">${feeReminders.map(item=>`<button class="reminder fee-reminder fee-${item.warning}" data-open-fee-targets><strong>${esc(item.cardId)}</strong><span>${esc(feeTargetReminder(item,formatMoneyDisplay))}</span></button>`).join("")||'<div class="reminder good">Chưa có mục tiêu hoàn phí cần theo dõi.</div>'}</div></div>`;
  document.querySelectorAll("[data-open-fee-targets]").forEach(element=>element.addEventListener("click",()=>setView("fee-targets")));
}
function kpi(label,value,signed=false,tone=""){ return `<div class="card kpi ${tone}"><span>${esc(label)}</span><strong class="${signed?(value<0?"negative":value>0?"positive":"neutral"):""}">${formatMoneyDisplay(value)}</strong></div>`; }

function toolbar(entity, addText = "+ Thêm"){
  return `<div class="crud-toolbar"><input data-search="${entity}" placeholder="Tìm kiếm"><button class="primary" data-add="${entity}">${addText}</button><button class="secondary-btn" data-edit="${entity}">Chỉnh sửa</button><button class="delete-btn" data-remove="${entity}">Xóa</button></div>`;
}
function cardFilterOptions(items,current,label,valueFn=x=>x,labelFn=x=>x){
  return `<option value="">${esc(label)}: Tất cả</option>${items.map(item=>`<option value="${esc(valueFn(item))}" ${String(valueFn(item))===String(current)?"selected":""}>${esc(labelFn(item))}</option>`).join("")}`;
}
function filterActionBar({apply,clear,cancel}){return `<div class="filter-action-bar"><button type="button" class="primary filter-action--apply" ${apply}>Áp dụng</button><button type="button" class="filter-action--clear" ${clear}>Xóa lọc</button><button type="button" class="secondary-btn filter-action--cancel" ${cancel}>Huỷ</button></div>`;}
function filterPanelConfig(type){
  return type==="cards"?{panel:"[data-card-filter-panel]",trigger:"[data-card-filter-trigger]",control:"[data-card-filter]",filters:cardFilters,setOpen:value=>{cardFilterOpen=value;}}:{panel:"[data-transaction-filter-panel]",trigger:"[data-transaction-filter-trigger]",control:"[data-transaction-filter]",filters:transactionFilters,setOpen:value=>{transactionFilterOpen=value;}};
}
function activeFilterCount(filterState){return Object.values(filterState).filter(Boolean).length;}
function removeFilterPanelOutsideListener(){if(filterPanelOutsideHandler){document.removeEventListener("pointerdown",filterPanelOutsideHandler,true);filterPanelOutsideHandler=null;}}
function syncFilterPanelFromApplied(type,panel=document.querySelector(filterPanelConfig(type).panel)){const config=filterPanelConfig(type);if(!panel)return;panel.querySelectorAll(config.control).forEach(control=>{control.value=config.filters[control.dataset.cardFilter||control.dataset.transactionFilter]||"";});}
function closeFilterPanelWithoutApply(type){const config=filterPanelConfig(type),panel=document.querySelector(config.panel),trigger=document.querySelector(config.trigger);syncFilterPanelFromApplied(type,panel);if(panel)panel.hidden=true;config.setOpen(false);trigger?.classList.toggle("active",activeFilterCount(config.filters)>0);removeFilterPanelOutsideListener();}
function closeAllFilterPanelsWithoutApply(){closeFilterPanelWithoutApply("cards");closeFilterPanelWithoutApply("transactions");}
function registerFilterPanelOutsideClose(type,panel,trigger){removeFilterPanelOutsideListener();filterPanelOutsideHandler=event=>{const path=event.composedPath?.()||[];if(path.includes(panel)||path.includes(trigger)||panel.contains(event.target)||trigger.contains(event.target))return;closeFilterPanelWithoutApply(type);};setTimeout(()=>document.addEventListener("pointerdown",filterPanelOutsideHandler,true),0);}
function cardToolbar(){
  const activeCount=Object.values(cardFilters).filter(Boolean).length;
  const networks=[...new Set(state.cards.map(card=>card.network).filter(Boolean))].sort(compareVietnameseText);
  return `<div class="crud-toolbar cards-toolbar"><input data-search="cards" placeholder="Tìm Card ID, ngân hàng, tên thẻ..."><button type="button" class="secondary-btn card-filter-trigger ${activeCount?"active":""}" data-card-filter-trigger>${icon("filter")}<span>Bộ lọc</span>${activeCount?`<b>${activeCount}</b>`:""}</button><button class="primary" data-add="cards">+ Thêm</button><button class="secondary-btn" data-edit="cards">Chỉnh sửa</button><button class="delete-btn" data-remove="cards">Xóa</button></div><div class="card-filter-panel" data-card-filter-panel ${cardFilterOpen?"":"hidden"}><select data-card-filter="bankId">${cardFilterOptions(state.banks,cardFilters.bankId,"Ngân hàng",bank=>bank.id,bank=>bank.name)}</select><select data-card-filter="cardType">${cardFilterOptions([{value:"credit",label:"Credit"},{value:"debit",label:"Debit"}],cardFilters.cardType,"Loại thẻ",item=>item.value,item=>item.label)}</select><select data-card-filter="network">${cardFilterOptions(networks,cardFilters.network,"Phôi")}</select><select data-card-filter="cardForm">${cardFilterOptions(cardFormOptions(false),cardFilters.cardForm,"Hình thức",item=>item.value,item=>item.label)}</select>${filterActionBar({apply:"data-card-filter-apply",clear:"data-card-filter-clear",cancel:"data-card-filter-cancel"})}</div>`;
}
function transactionToolbar(){
  const activeCount=Object.values(transactionFilters).filter(Boolean).length;
  const cardItems=sortDisplayRows(state.cards,card=>card.id);
  const hostItems=sortDisplayRows(state.hosts,host=>host.name);
  const categoryItems=sortDisplayRows(state.mccCategories,category=>category.name);
  const mccItems=sortDisplayRows(state.mccCategories.filter(category=>category.mcc!=null),category=>category.mcc);
  return `<div class="crud-toolbar transactions-toolbar"><input data-search="transactions" placeholder="Tìm giao dịch, Card ID, Host..."><button type="button" class="secondary-btn transaction-filter-trigger ${activeCount?"active":""}" data-transaction-filter-trigger>${icon("filter")}<span>Bộ lọc</span>${activeCount?`<b>${activeCount}</b>`:""}</button><button class="primary" data-add="transactions">+ Thêm</button><button class="secondary-btn" data-edit="transactions">Chỉnh sửa</button><button class="delete-btn" data-remove="transactions">Xóa</button></div><div class="transaction-filter-panel" data-transaction-filter-panel ${transactionFilterOpen?"":"hidden"}><select data-transaction-filter="cardId">${cardFilterOptions(cardItems,transactionFilters.cardId,"Card ID",card=>card.id,card=>card.id)}</select><select data-transaction-filter="category">${cardFilterOptions(categoryItems,transactionFilters.category,"Loại đơn",category=>category.name,category=>category.name)}</select><select data-transaction-filter="host">${cardFilterOptions(hostItems,transactionFilters.host,"Host",host=>host.name,host=>host.name)}</select><select data-transaction-filter="channel">${cardFilterOptions(TRANSACTION_METHOD_OPTIONS,transactionFilters.channel,"Hình thức giao dịch",item=>item.value,item=>item.label)}</select><select data-transaction-filter="status">${cardFilterOptions(TRANSACTION_STATUS_OPTIONS,transactionFilters.status,"Trạng thái",item=>item.value,item=>item.label)}</select><select data-transaction-filter="mcc">${cardFilterOptions(mccItems,transactionFilters.mcc,"MCC",category=>String(category.mcc),category=>`${category.mcc} — ${category.name}`)}</select><label class="compact-date-filter"><span>Từ ngày</span><input type="date" data-transaction-filter="dateFrom" value="${esc(transactionFilters.dateFrom)}"></label><label class="compact-date-filter"><span>Đến ngày</span><input type="date" data-transaction-filter="dateTo" value="${esc(transactionFilters.dateTo)}"></label>${filterActionBar({apply:"data-transaction-filter-apply",clear:"data-transaction-filter-clear",cancel:"data-transaction-filter-cancel"})}</div>`;
}
function rowSelection(entity){
  const selection=selectedRowSets[entity]||(selectedRowSets[entity]=new Set());
  if(!selection.size&&selectedRows[entity]) selection.add(selectedRows[entity]);
  return selection;
}
function selectedIds(entity){ return [...rowSelection(entity)]; }
function applyRowSelection(entity){
  const selected=rowSelection(entity);
  document.querySelectorAll(`[data-entity="${entity}"] tr[data-id]`).forEach(row=>row.classList.toggle("selected",selected.has(row.dataset.id)));
}
function clearRowSelection(entity){
  rowSelection(entity).clear();
  selectedRows[entity]="";
  selectionAnchors[entity]="";
  applyRowSelection(entity);
}
function clearAllRowSelections(){ Object.keys(selectedRowSets).forEach(clearRowSelection); }
function paymentCycleDisplay(cycle){
  const [year,month]=String(cycle||"").split("-");
  return year&&month?`${month}/${year}`:(cycle||"—");
}
function responsiveAccordionTitle(entity,id,row){
  if(entity==="cardStatus") return id;
  if(entity==="dashboardCashback") return `${row.cells[0]?.textContent.trim()||"—"}_${row.cells[1]?.textContent.trim()||"Chương trình"}`;
  if(entity==="cards") return id;
  if(entity==="programs"){
    const program=state.cashbackPrograms.find(item=>item.id===id);
    return `${program?.cardId||"—"}_${program?.name||"Chương trình Cashback"}`;
  }
  if(entity==="transactions"){
    const transaction=state.transactions.find(item=>item.id===id);
    return `${formatDateDisplay(transaction?.date,{emptyText:"—"})}_${transaction?.cardId||"—"}`;
  }
  if(entity==="cashbackReceipts"){
    const receipt=state.cashbackReceipts.find(item=>item.id===id);
    return `${formatDateDisplay(receipt?.date,{emptyText:"—"})}_${receipt?.cardId||"—"}`;
  }
  if(entity==="payments"){
    const payment=state.payments.find(item=>item.id===id);
    return `${paymentCycleDisplay(payment?.paymentCycle)}_${payment?.cardId||"—"}`;
  }
  if(entity==="feeTargets"){
    const target=(state.feeTargets||[]).find(item=>item.id===id);
    return `${target?.cardId||"—"}_${feeTypeLabel(target?.feeType)}`;
  }
  if(entity==="hosts") return state.hosts.find(item=>item.id===id)?.name||"Host";
  if(entity==="mcc"){
    const category=state.mccCategories.find(item=>item.id===id);
    return `${category?.mcc||"—"}_${category?.name||"Nhóm MCC"}`;
  }
  if(entity==="banks"){
    const bank=state.banks.find(item=>item.id===id);
    return `${bank?.code||"—"}_${bank?.name||"Ngân hàng"}`;
  }
  return row.cells[0]?.textContent.trim()||id;
}
function enhanceResponsiveRecordLists(){
  document.querySelectorAll("table[data-entity],table[data-accordion-entity]").forEach((table,tableIndex)=>{
    const entity=table.dataset.entity||table.dataset.accordionEntity;
    const rows=[...table.querySelectorAll("tbody tr[data-id],tbody tr[data-accordion-id]")];
    if(!rows.length) return;
    table.classList.add("responsive-accordion-table");
    table.closest(".table-wrap")?.classList.add("responsive-accordion-wrap");
    const visibleKeys=new Set();
    rows.forEach((row,rowIndex)=>{
      if(row.querySelector(".accordion-toggle-cell")) return;
      const id=row.dataset.id||row.dataset.accordionId;
      const key=`${entity}|${id}`;
      const panelId=`accordion-panel-${tableIndex}-${rowIndex}-${String(id).replace(/[^A-Za-z0-9_-]/g,"-")}`;
      const expanded=expandedAccordionRows.has(key);
      visibleKeys.add(key);
      row.id=panelId;
      row.dataset.accordionKey=key;
      row.classList.add("accordion-record");
      row.classList.toggle("accordion-expanded",expanded);
      row.insertAdjacentHTML("afterbegin",`<td class="accordion-toggle-cell"><button type="button" class="accordion-toggle" data-accordion-toggle aria-expanded="${expanded}" aria-controls="${esc(panelId)}"><span>${esc(responsiveAccordionTitle(entity,id,row))}</span>${icon("chevron-down")}</button></td>`);
    });
    [...expandedAccordionRows].filter(key=>key.startsWith(`${entity}|`)&&!visibleKeys.has(key)).forEach(key=>expandedAccordionRows.delete(key));
  });
}
function toggleResponsiveAccordion(button){
  const row=button.closest(".accordion-record");
  if(!row) return;
  const expanded=!row.classList.contains("accordion-expanded");
  row.classList.toggle("accordion-expanded",expanded);
  button.setAttribute("aria-expanded",String(expanded));
  if(expanded) expandedAccordionRows.add(row.dataset.accordionKey); else expandedAccordionRows.delete(row.dataset.accordionKey);
}
function selectRow(entity,id,{toggle=false,range=false}={}){
  const selected=rowSelection(entity);
  const rows=[...document.querySelectorAll(`[data-entity="${entity}"] tr[data-id]`)];
  if(range&&selectionAnchors[entity]){
    const anchorIndex=rows.findIndex(row=>row.dataset.id===selectionAnchors[entity]);
    const targetIndex=rows.findIndex(row=>row.dataset.id===id);
    if(anchorIndex>=0&&targetIndex>=0){
      selected.clear();
      rows.slice(Math.min(anchorIndex,targetIndex),Math.max(anchorIndex,targetIndex)+1).forEach(row=>selected.add(row.dataset.id));
    }
  }else if(toggle){
    if(selected.has(id)) selected.delete(id); else selected.add(id);
    selectionAnchors[entity]=id;
  }else{
    selected.clear();
    selected.add(id);
    selectionAnchors[entity]=id;
  }
  selectedRows[entity]=selected.has(id)?id:(selected.values().next().value||"");
  applyRowSelection(entity);
}
function closeTableContextMenu(){
  const menu=document.querySelector("#tableContextMenu");
  if(menu){menu.hidden=true;menu.innerHTML="";}
  activeTableContext=null;
}
function positionTableContextMenu(menu,x,y){
  menu.hidden=false;
  menu.style.left=`${x}px`;
  menu.style.top=`${y}px`;
  const rect=menu.getBoundingClientRect();
  menu.style.left=`${Math.max(8,Math.min(x,window.innerWidth-rect.width-8))}px`;
  menu.style.top=`${Math.max(8,Math.min(y,window.innerHeight-rect.height-8))}px`;
}
function openTableContextMenu(entity,handlers,x,y){
  const ids=selectedIds(entity);
  if(!ids.length) return;
  const menu=document.querySelector("#tableContextMenu");
  const multiple=ids.length>1;
  menu.innerHTML=`<button type="button" role="menuitem" data-context-add>${icon("plus")}<span>Thêm</span></button><button type="button" role="menuitem" data-context-edit ${multiple?'disabled title="Chỉ có thể chỉnh sửa từng dòng."':""}>${icon("pencil")}<span>Chỉnh sửa</span></button><button type="button" role="menuitem" class="context-delete" data-context-delete>${icon("trash")}<span>${multiple?`Xóa ${ids.length} dòng đã chọn`:"Xóa"}</span></button>`;
  activeTableContext={entity,handlers};
  menu.querySelector("[data-context-add]").onclick=()=>{closeTableContextMenu();handlers.add();};
  menu.querySelector("[data-context-edit]").onclick=()=>{closeTableContextMenu();handlers.edit(ids[0]);};
  menu.querySelector("[data-context-delete]").onclick=()=>{
    closeTableContextMenu();
    if(!multiple) return handlers.remove(ids[0]);
    if(!handlers.bulkRemove) return toast("Bảng này chưa hỗ trợ xóa nhiều dòng.");
    if(confirm(`Bạn có chắc muốn xóa ${ids.length} dòng đã chọn?`)) handlers.bulkRemove(ids);
  };
  positionTableContextMenu(menu,x,y);
  menu.querySelector("button:not(:disabled)")?.focus();
}
function filteredRows(entity, rows, textFn){
  const term=(searchTerms[entity]||"").toLowerCase();
  return term ? rows.filter(row=>textFn(row).toLowerCase().includes(term)) : rows;
}
function wireToolbar(entity, handlers){
  const search=document.querySelector(`[data-search="${entity}"]`);
  if(search){
    search.value=searchTerms[entity]||"";
    search.addEventListener("input",()=>{searchTerms[entity]=search.value;clearRowSelection(entity);renderAll();});
  }
  document.querySelector(`[data-add="${entity}"]`)?.addEventListener("click", handlers.add);
  document.querySelector(`[data-edit="${entity}"]`)?.addEventListener("click",()=>{ const ids=selectedIds(entity); if(ids.length!==1) return toast(ids.length?"Chỉ có thể chỉnh sửa từng dòng.":"Vui lòng chọn một dòng để chỉnh sửa."); handlers.edit(ids[0]); });
  document.querySelector(`[data-remove="${entity}"]`)?.addEventListener("click",()=>{ const ids=selectedIds(entity); if(!ids.length) return toast("Vui lòng chọn một dòng để xóa."); if(ids.length===1) return handlers.remove(ids[0]); if(!handlers.bulkRemove) return toast("Bảng này chưa hỗ trợ xóa nhiều dòng."); if(confirm(`Bạn có chắc muốn xóa ${ids.length} dòng đã chọn?`)) handlers.bulkRemove(ids); });
  if(entity==="cards"){
    document.querySelector("[data-card-filter-trigger]")?.addEventListener("click",event=>{const trigger=event.currentTarget,panel=document.querySelector("[data-card-filter-panel]"),willOpen=panel?.hidden;closeAllFilterPanelsWithoutApply();if(panel&&willOpen){cardFilterOpen=true;syncFilterPanelFromApplied("cards",panel);panel.hidden=false;trigger.classList.add("active");registerFilterPanelOutsideClose("cards",panel,trigger);}});
    document.querySelector("[data-card-filter-cancel]")?.addEventListener("click",()=>closeFilterPanelWithoutApply("cards"));
    document.querySelector("[data-card-filter-apply]")?.addEventListener("click",()=>{document.querySelectorAll("[data-card-filter]").forEach(select=>{cardFilters[select.dataset.cardFilter]=select.value;});cardFilterOpen=false;removeFilterPanelOutsideListener();clearRowSelection("cards");renderAll();});
    document.querySelector("[data-card-filter-clear]")?.addEventListener("click",()=>{Object.keys(cardFilters).forEach(key=>{cardFilters[key]="";});cardFilterOpen=false;removeFilterPanelOutsideListener();clearRowSelection("cards");renderAll();});
  }
  if(entity==="transactions"){
    document.querySelector("[data-transaction-filter-trigger]")?.addEventListener("click",event=>{const trigger=event.currentTarget,panel=document.querySelector("[data-transaction-filter-panel]"),willOpen=panel?.hidden;closeAllFilterPanelsWithoutApply();if(panel&&willOpen){transactionFilterOpen=true;syncFilterPanelFromApplied("transactions",panel);panel.hidden=false;trigger.classList.add("active");registerFilterPanelOutsideClose("transactions",panel,trigger);}});
    document.querySelector("[data-transaction-filter-cancel]")?.addEventListener("click",()=>closeFilterPanelWithoutApply("transactions"));
    document.querySelector("[data-transaction-filter-apply]")?.addEventListener("click",()=>{document.querySelectorAll("[data-transaction-filter]").forEach(control=>{transactionFilters[control.dataset.transactionFilter]=control.value;});transactionFilterOpen=false;removeFilterPanelOutsideListener();clearRowSelection("transactions");renderAll();});
    document.querySelector("[data-transaction-filter-clear]")?.addEventListener("click",()=>{Object.keys(transactionFilters).forEach(key=>{transactionFilters[key]="";});transactionFilterOpen=false;removeFilterPanelOutsideListener();clearRowSelection("transactions");renderAll();});
  }
  const table=document.querySelector(`[data-entity="${entity}"]`);
  const rows=[...table.querySelectorAll("tr[data-id]")];
  const visibleIds=new Set(rows.map(row=>row.dataset.id));
  [...rowSelection(entity)].forEach(id=>{if(!visibleIds.has(id))rowSelection(entity).delete(id);});
  if(!rowSelection(entity).size) selectedRows[entity]="";
  rows.forEach(tr=>{
    tr.tabIndex=0;
    tr.addEventListener("click",event=>{if(event.target.closest("button,a,input,select,textarea,label"))return;selectRow(entity,tr.dataset.id,{toggle:event.ctrlKey||event.metaKey,range:event.shiftKey});});
    tr.addEventListener("dblclick",event=>{if(event.target.closest("button,a,input,select,textarea,label"))return;handlers.edit(tr.dataset.id);});
    tr.addEventListener("contextmenu",event=>{event.preventDefault();if(!rowSelection(entity).has(tr.dataset.id))selectRow(entity,tr.dataset.id);openTableContextMenu(entity,handlers,event.clientX,event.clientY);});
    tr.addEventListener("keydown",event=>{if(event.shiftKey&&event.key==="F10"){event.preventDefault();if(!rowSelection(entity).has(tr.dataset.id))selectRow(entity,tr.dataset.id);const rect=tr.getBoundingClientRect();openTableContextMenu(entity,handlers,rect.left+24,rect.top+24);}});
  });
  table.closest(".table-wrap")?.addEventListener("click",event=>{if(!event.target.closest("tr[data-id],button,a,input,select,textarea,label"))clearRowSelection(entity);});
  applyRowSelection(entity);
}

async function openForm(title, fields, initial = {}, onRender = null){
  const modal=document.querySelector("#formModal");
  const form=modal.querySelector("form");
  const body=modal.querySelector(".modal-body");
  modal.querySelector("h2").textContent=title;
  const formLayout=fields.find(field=>field.formLayout)?.formLayout || "";
  body.className=`modal-body form-grid ${formLayout}`.trim();
  form.classList.toggle("card-modal",formLayout==="card-form-grid");
  body.innerHTML = fields.map(f => {
    const value = initial[f.name] ?? f.value ?? "";
    const disabledAttr = f.disabled ? "disabled" : "";
    const fieldClass = `field${f.disabled ? " disabled-field" : ""}${f.layoutClass ? ` ${f.layoutClass}` : ""}`;
    if(f.type === "select") return `<div class="${fieldClass}"><label>${esc(f.label)}</label><select name="${esc(f.name)}" ${disabledAttr}>${f.options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?"selected":""}>${esc(o.label)}</option>`).join("")}</select></div>`;
    if(f.type === "multiselect"){
      const values = Array.isArray(value) ? value.map(String) : [String(value || "")];
      const sharedLimitClass=f.name==="sharedLimitCards" ? " shared-limit-select" : "";
      const optionClass=f.name==="sharedLimitCards" ? "multi-option shared-limit-option" : "multi-option";
      const optionLabelClass=f.name==="sharedLimitCards" ? ' class="shared-limit-option-label"' : "";
      return `<div class="${fieldClass}${f.layoutClass ? "" : " full"}"><label>${esc(f.label)}</label><div class="multi-select${sharedLimitClass}" data-multiselect-name="${esc(f.name)}">
        <button type="button" class="multi-select-toggle" data-multiselect-toggle>Không</button>
        <div class="multi-select-panel">
          ${f.options.map(o=>`<label class="${optionClass}"><input type="checkbox" value="${esc(o.value)}" ${values.includes(String(o.value))?"checked":""}><span${optionLabelClass}>${esc(o.label)}</span></label>`).join("")}
        </div>
      </div><small>${esc(f.hint || "")}</small></div>`;
    }
    if(f.type === "textarea") return `<div class="${fieldClass}${f.layoutClass ? "" : " full"}"><label>${esc(f.label)}</label><textarea name="${esc(f.name)}" ${disabledAttr}>${esc(value)}</textarea></div>`;
    if(f.type === "checkbox") return `<div class="${fieldClass}"><label class="check-field"><input name="${esc(f.name)}" type="checkbox" ${value?"checked":""} ${disabledAttr}> <span>${esc(f.label)}</span></label></div>`;
    if(f.type === "note") return `<div class="note full">${esc(f.label)}</div>`;
    const inputType = f.kind === "money" ? "text" : (f.type || "text");
    const inputValue = f.kind === "money" ? formatMoneyInput(value, {allowEmpty:f.allowEmpty}) : value;
    const inputAttrs = `name="${esc(f.name)}" type="${esc(inputType)}" value="${esc(inputValue)}" ${f.kind==="money"?'inputmode="numeric" autocomplete="off"':""} ${f.min!=null?`min="${esc(f.min)}"`:""} ${f.max!=null?`max="${esc(f.max)}"`:""} ${f.step?`step="${esc(f.step)}"`:""} ${f.required?"required":""} ${f.readonly?"readonly":""} ${disabledAttr}`;
    return `<div class="${fieldClass}"><label>${esc(f.label)}</label>${f.kind==="money" ? `<div class="money-input"><input ${inputAttrs}><span>đ</span></div>` : `<input ${inputAttrs}>`}${f.hint?`<small>${esc(f.hint)}</small>`:""}</div>`;
  }).join("");
  body.querySelectorAll(".field input").forEach(input => {
    const field = fields.find(x => x.name === input.name);
    if(field?.kind === "money"){
      input.dataset.money = "true";
      const format = () => { input.value = formatMoneyInput(input.value, {allowEmpty:field.allowEmpty}); };
      input.addEventListener("input", format);
      input.addEventListener("change", format);
      input.addEventListener("blur", format);
    }
  });
  if(onRender) onRender(modal, fields);
  modal.classList.add("show");
  return new Promise(resolve => {
    const close = result => { modal.classList.remove("show"); form.onsubmit=null; modal.querySelector("[data-cancel-modal]").onclick=null; resolve(result); };
    modal.querySelector("[data-cancel-modal]").onclick=()=>close(null);
    form.onsubmit=e=>{
      e.preventDefault();
      const fd=new FormData(form);
      const values={};
      fields.forEach(f=>{
        if(f.type === "note") return;
        const raw=fd.get(f.name);
        values[f.name] = f.type === "multiselect" ? [...body.querySelectorAll(`[data-multiselect-name="${f.name}"] input:checked`)].map(x=>x.value) : f.type === "checkbox" ? body.querySelector(`[name="${f.name}"]`)?.checked === true : f.kind === "number" ? Number(raw || 0) : f.kind === "money" ? parseMoney(raw, {emptyValue:f.allowEmpty ? null : 0}) : raw;
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
  return sortOptionsByVietnameseLabel(values.map(x=>({value:x,label:x})));
}

function cardFormOptions(includeEmpty=true){
  const options = [
    {value:"physical", label:"Vật lý"},
    {value:"virtual", label:"Phi vật lý"}
  ];
  const sorted=sortOptionsByVietnameseLabel(options);
  return includeEmpty ? [{value:"", label:"Chưa chọn"}, ...sorted] : sorted;
}

function cardFields(card={}, mode="add"){
  if(!state.banks.length){
    return [{type:"note", label:"Chưa có mã ngân hàng. Vui lòng cấu hình tab Mã ngân hàng trước khi thêm thẻ."}];
  }
  const bankId=card.bankId || state.banks[0]?.id || "";
  return [
    {name:"id", label:"Card ID", value:card.id || "", type:"text", required:true, formLayout:"card-form-grid"},
    {name:"bankId", label:"Ngân hàng", value:bankId, type:"select", options:selectOptions(state.banks, b=>b.name)},
    {name:"name", label:"Tên thẻ", value:card.name || "", type:"text"},
    {name:"network", label:"Phôi", value:card.network || "Visa", type:"select", options:networkOptions(card.network)},
    {name:"cardType", label:"Loại thẻ", value:String(card.cardType || "credit").toLowerCase(), type:"select", options:[{value:"credit",label:"Tín dụng (Credit)"},{value:"debit",label:"Ghi nợ (Debit)"}]},
    {name:"cardForm", label:"Hình thức", value:card.cardForm || "", type:"select", options:cardFormOptions(true)},
    {name:"groupLimit", label:"Hạn mức (VND)", value:card.groupLimit || 0, type:"text", kind:"money"},
    {name:"statementDay", label:"Ngày sao kê", value:card.statementDay || "", type:"select", options:statementDayOptions(card.statementDay)},
    {name:"paymentDueDay", label:"Hạn thanh toán", value:card.paymentDueDay ?? "", type:"select", options:statementDayOptions(card.paymentDueDay)},
    {name:"cashbackCycle", label:"Hoàn tiền", value:card.cashbackCycle || "monthly", type:"select", options:[{value:"monthly",label:"Theo tháng"},{value:"statement",label:"Theo kỳ sao kê"}]},
    {name:"annualFee", label:"Phí thường niên (VNĐ)", value:card.annualFee ?? "", type:"text", kind:"money", allowEmpty:true},
    {name:"sharedLimitCards", label:"Dùng chung hạn mức", value:selectedSharedCardsForForm(card), type:"multiselect", options:sharedLimitOptions(card.id,bankId), layoutClass:"span-1", hint:"Chỉ hiển thị Card ID cùng ngân hàng."},
    {name:"notes", label:"Ghi chú", value:card.notes || "", type:"textarea", layoutClass:"span-full"}
  ];
}
function cashbackCycleLabel(value){
  return value === "statement" ? "Theo kỳ sao kê" : value === "monthly" ? "Theo tháng" : "Chưa thiết lập";
}

function wireCardForm(modal, fields=[]){
  wireSharedLimitForm(modal, fields);
  const typeSelect=modal.querySelector('[name="cardType"]');
  const creditFields=[
    modal.querySelector('[name="statementDay"]')?.closest(".field"),
    modal.querySelector('[data-multiselect-name="sharedLimitCards"]')?.closest(".field"),
    modal.querySelector('[name="groupLimit"]')?.closest(".field")
  ].filter(Boolean);
  const update=()=>{
    const isDebit=typeSelect?.value==="debit";
    creditFields.forEach(field=>{
      field.hidden=isDebit;
      field.querySelectorAll("input,select,button").forEach(control=>{ control.disabled=isDebit; });
    });
  };
  typeSelect?.addEventListener("change",update);
  update();
}

function wireSharedLimitForm(modal, fields=[]){
  const shared = modal.querySelector('[data-multiselect-name="sharedLimitCards"]');
  const limit = modal.querySelector('[name="groupLimit"]');
  const bank = modal.querySelector('[name="bankId"]');
  if(!shared || !limit) return;
  const toggle = shared.querySelector("[data-multiselect-toggle]");
  const panel = shared.querySelector(".multi-select-panel");
  const currentId=modal.querySelector('[name="id"]')?.value || "";
  const initialValues=fields.find(field=>field.name==="sharedLimitCards")?.value || ["__NONE__"];
  let selectedValues=new Set(Array.isArray(initialValues)?initialValues.map(String):[]);
  let previous=[];
  const update = () => {
    const checkboxes = [...shared.querySelectorAll('input[type="checkbox"]')];
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
        limit.value = formatMoneyInput(groupLimit(groupIdForCard(first)));
        limit.readOnly = true;
      }
    }else{
      limit.readOnly = false;
    }
    previous = checkboxes.filter(x=>x.checked).map(x=>x.value);
    selectedValues=new Set(previous);
  };
  const refreshOptions=()=>{
    const options=sharedLimitOptions(currentId,bank?.value || "");
    const allowed=new Set(options.map(option=>String(option.value)));
    selectedValues=new Set([...selectedValues].filter(value=>allowed.has(value)));
    if(![...selectedValues].some(value=>value!=="__NONE__")) selectedValues=new Set(["__NONE__"]);
    panel.innerHTML=options.map(option=>`<label class="multi-option shared-limit-option"><input type="checkbox" value="${esc(option.value)}" ${selectedValues.has(String(option.value))?"checked":""}><span class="shared-limit-option-label">${esc(option.label)}</span></label>`).join("");
    previous=[...selectedValues];
    panel.querySelectorAll('input[type="checkbox"]').forEach(box=>box.addEventListener("change",update));
    update();
  };
  toggle.addEventListener("click", () => shared.classList.toggle("open"));
  bank?.addEventListener("change",refreshOptions);
  document.addEventListener("click", event => {
    if(!shared.contains(event.target)) shared.classList.remove("open");
  });
  refreshOptions();
}

function validateCard(values, existingId=""){
  if(!state.banks.length) return {error:"Chưa có mã ngân hàng. Vui lòng cấu hình Mã ngân hàng trước."};
  const id=String(values.id||"").trim();
  if(!id) return {error:"Vui lòng nhập Card ID."};
  if(state.cards.some(card=>card.id!==existingId&&String(card.id).toLocaleLowerCase("vi-VN")===id.toLocaleLowerCase("vi-VN"))) return {error:`Card ID ${id} đã tồn tại.`};
  if(!values.bankId) return {error:"Vui lòng chọn ngân hàng."};
  if(!String(values.name || "").trim()) return {error:"Vui lòng nhập tên thẻ."};
  const cardType = values.cardType === "debit" ? "debit" : "credit";
  const statementDay = cardType === "debit" || values.statementDay === "" || values.statementDay == null ? "" : Number(values.statementDay);
  if(cardType === "credit" && statementDay !== "" && (!Number.isInteger(statementDay) || statementDay < 1 || statementDay > 31)) return {error:"Ngày sao kê phải nằm trong khoảng 1 đến 31."};
  const paymentDueDay = values.paymentDueDay === "" || values.paymentDueDay == null ? null : Number(values.paymentDueDay);
  if(paymentDueDay != null && (!Number.isInteger(paymentDueDay) || paymentDueDay < 1 || paymentDueDay > 31)) return {error:"Hạn thanh toán phải là số nguyên từ 1 đến 31."};
  const bank = state.banks.find(x=>x.id===values.bankId);
  if(!bank) return {error:"Ngân hàng đã chọn không tồn tại."};
  const annualFee = values.annualFee == null ? null : normalizeMoney(values.annualFee, {emptyValue:0});
  const existingCard=state.cards.find(item=>item.id===existingId);
  const paymentTrackingStartMonth=paymentDueDay == null ? "" : (existingCard?.paymentTrackingStartMonth || paymentCycleFromDate());
  const cashbackCycle=values.cashbackCycle === "statement" ? "statement" : "monthly";
  const card = {...values, cardType, cashbackCycle, statementDay, paymentDueDay, paymentTrackingStartMonth, id, bank:bank.name, name:String(values.name).trim(), groupLimit:cardType === "debit" ? 0 : normalizeMoney(values.groupLimit, {emptyValue:0}), annualFee, notes:String(values.notes || "")};
  delete card.sharedLimitCards;
  if(cardType === "debit"){
    card.limitGroupId="";
    card.limitGroup="";
    return {card};
  }
  const shared = applySharedLimit(card, values.sharedLimitCards, values.groupLimit);
  if(shared.error) return shared;
  return {card:shared.card, targetGroupId:shared.targetGroupId};
}

function renameCardReferences(previousId,nextId){
  if(previousId===nextId) return;
  [state.transactions,state.payments,state.cashbackReceipts,state.cashbackPrograms,state.feeTargets||[]].forEach(items=>items.forEach(item=>{if(item.cardId===previousId)item.cardId=nextId;}));
}

function renderCards(){
  const matching=state.cards.filter(card=>(!cardFilters.bankId||card.bankId===cardFilters.bankId)&&(!cardFilters.cardType||card.cardType===cardFilters.cardType)&&(!cardFilters.network||card.network===cardFilters.network)&&(!cardFilters.cardForm||card.cardForm===cardFilters.cardForm));
  const rows=sortDisplayRows(filteredRows("cards", matching, c=>`${c.id} ${bankName(c.bankId,c.bank)} ${c.name} ${c.network} ${cardTypeLabel(c.cardType)} ${cardFormLabel(c.cardForm)} ${sharedLimitLabel(c)} ${paymentDueDayLabel(c.paymentDueDay)} ${annualFeeLabel(c.annualFee)} ${c.notes || ""}`),card=>card.id);
  document.querySelector("#view-cards").innerHTML=`<div class="card cards-card">${!state.banks.length?'<div class="note">Chưa có mã ngân hàng. Hãy vào tab Mã ngân hàng để thêm trước khi tạo thẻ.</div>':""}${cardToolbar()}<div class="table-wrap"><table class="mobile-card-table" data-entity="cards"><thead><tr><th>Card ID</th><th>Ngân hàng</th><th>Tên thẻ</th><th>Phôi</th><th>Loại thẻ</th><th>Hình thức</th><th>Hạn mức</th><th>Dư nợ</th><th>Chung hạn mức</th><th>Ngày sao kê</th><th>Hạn thanh toán</th><th>Hoàn tiền</th><th>Phí thường niên</th><th>Ghi chú</th></tr></thead><tbody>
  ${rows.map(c=>{ const debit=c.cardType==="debit"; return `<tr data-id="${esc(c.id)}" class="${debit?"debit-row ":""}${selectedRows.cards===c.id?"selected":""}"><td><strong>${esc(c.id)}</strong></td><td>${esc(bankName(c.bankId,c.bank))}</td><td>${esc(c.name)}</td><td>${esc(c.network||"—")}</td><td>${esc(cardTypeLabel(c.cardType))}</td><td>${esc(cardFormLabel(c.cardForm))}</td><td class="num">${debit?"—":formatMoneyDisplay(c.groupLimit)}</td><td class="num">${debit?"—":formatMoneyDisplay(allDebt(c.id))}</td><td class="wrap-cell">${esc(sharedLimitLabel(c))}</td><td>${debit?"—":esc(statementDayLabel(c.statementDay))}</td><td>${esc(paymentDueDayLabel(c.paymentDueDay))}</td><td>${esc(cashbackCycleLabel(c.cashbackCycle))}</td><td class="num">${esc(annualFeeLabel(c.annualFee))}</td><td class="wrap-cell">${esc(c.notes || "—")}</td></tr>`; }).join("")}</tbody></table></div></div>`;
  wireToolbar("cards", {
    add: async()=>{ if(!state.banks.length){ toast("Vui lòng cấu hình Mã ngân hàng trước."); setView("banks"); return; } const v=await openForm("Thêm thẻ", cardFields({}, "add"), {}, wireCardForm); if(!v) return; const result=validateCard(v); if(result.error) return toast(result.error); state.cards.push(result.card); if(result.targetGroupId) syncGroupLimits(result.targetGroupId, result.card.groupLimit); selectedRows.cards=result.card.id; saveState("Đã thêm thẻ"); },
    edit: async id=>{ const i=state.cards.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa thẻ", cardFields(state.cards[i], "edit"), {...state.cards[i], sharedLimitCards:selectedSharedCardsForForm(state.cards[i])}, wireCardForm); if(!v) return; const result=validateCard(v, id); if(result.error) return toast(result.error); state.cards[i]=result.card; renameCardReferences(id,result.card.id); repairLimitGroups(); if(result.targetGroupId) syncGroupLimits(result.targetGroupId, result.card.groupLimit); clearRowSelection("cards"); selectedRows.cards=result.card.id; rowSelection("cards").add(result.card.id); saveState("Đã cập nhật thẻ"); },
    remove: id=>{ if((state.feeTargets||[]).some(target=>target.cardId===id)) return toast("Không thể xóa thẻ đang có mục tiêu hoàn phí thường niên."); if(!confirm("Xóa thẻ đã chọn? Các giao dịch/thanh toán liên quan sẽ không bị xóa.")) return; state.cards=state.cards.filter(x=>x.id!==id); repairLimitGroups(); clearRowSelection("cards"); saveState("Đã xóa thẻ"); },
    bulkRemove:ids=>{const blocked=ids.filter(id=>(state.feeTargets||[]).some(target=>target.cardId===id));if(blocked.length)return toast(`Không thể xóa ${blocked.length} thẻ đang có mục tiêu hoàn phí thường niên.`);const selected=new Set(ids);state.cards=state.cards.filter(card=>!selected.has(card.id));repairLimitGroups();clearRowSelection("cards");saveState(`Đã xóa ${ids.length} thẻ`);}
  });
}

function renderBanks(){
  const rows=filteredRows("banks", state.banks, b=>`${b.code} ${b.name}`);
  document.querySelector("#view-banks").innerHTML=`<div class="card"><div class="section-title"><h2>Mã ngân hàng</h2><small>Dùng để nhận diện ngân hàng trong ứng dụng</small></div>${toolbar("banks")}<div class="table-wrap"><table data-entity="banks"><thead><tr><th>Mã ngân hàng</th><th>Tên ngân hàng</th><th>Số thẻ đang dùng</th></tr></thead><tbody>
  ${rows.map(b=>`<tr data-id="${esc(b.id)}" class="${selectedRows.banks===b.id?"selected":""}"><td>${esc(b.code)}</td><td>${esc(b.name)}</td><td class="num">${state.cards.filter(c=>c.bankId===b.id).length}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("banks", {
    add: async()=>{ const v=await openForm("Thêm mã ngân hàng", bankFields()); if(!v) return; const result=validateBank(v); if(result.error) return toast(result.error); state.banks.push(result.bank); selectedRows.banks=result.bank.id; saveState("Đã thêm mã ngân hàng"); },
    edit: async id=>{ const i=state.banks.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa mã ngân hàng", bankFields(state.banks[i]), state.banks[i]); if(!v) return; const result=validateBank(v, id); if(result.error) return toast(result.error); state.banks[i]={...result.bank, id}; state.cards.forEach(card=>{ if(card.bankId===id) card.bank=result.bank.name; }); saveState("Đã cập nhật mã ngân hàng"); },
    remove: id=>{ const bank=state.banks.find(x=>x.id===id); const count=state.cards.filter(c=>c.bankId===id).length; if(count) return toast(`Không thể xóa ${bank.name} vì đang được ${count} thẻ tín dụng sử dụng.`); if(!confirm("Xóa mã ngân hàng đã chọn?")) return; state.banks=state.banks.filter(x=>x.id!==id); clearRowSelection("banks"); saveState("Đã xóa mã ngân hàng"); },
    bulkRemove:ids=>{const blocked=ids.filter(id=>state.cards.some(card=>card.bankId===id));if(blocked.length)return toast(`Không thể xóa ${blocked.length} mã ngân hàng đang được thẻ sử dụng.`);const selected=new Set(ids);state.banks=state.banks.filter(bank=>!selected.has(bank.id));clearRowSelection("banks");saveState(`Đã xóa ${ids.length} mã ngân hàng`);}
  });
}

function renderAbout(){
  const tabs=[['intro','Giới thiệu'],['guide','Hướng dẫn sử dụng'],['data','Quản lý dữ liệu & Google Drive'],['version','Thông tin phiên bản']];
  const topics=helpTopics().filter(topic=>!helpSearchTerm||`${topic.title} ${topic.html.replace(/<[^>]+>/g,' ')}`.toLowerCase().includes(helpSearchTerm.toLowerCase()));
  document.querySelector("#view-about").innerHTML=`<div class="help-center"><div class="help-tabs" role="tablist">${tabs.map(([id,label])=>`<button role="tab" aria-selected="${activeHelpTab===id}" class="${activeHelpTab===id?'active':''}" data-help-tab="${id}">${label}</button>`).join('')}</div>
  ${activeHelpTab==='intro'?`<div class="about-layout"><section class="card about-card"><h2>QUẢN LÝ THẺ</h2><p>Nền tảng hỗ trợ quản lý thẻ tín dụng, giao dịch, dư nợ, hạn mức, chương trình cashback và đồng bộ dữ liệu qua Google Drive.</p><div class="about-features"><span>Quản lý nhiều thẻ tín dụng</span><span>Theo dõi hạn mức và dư nợ</span><span>Quản lý giao dịch</span><span>Theo dõi cashback</span><span>Quản lý Host và MCC</span><span>Đồng bộ dữ liệu bằng Google Drive</span><span>Hỗ trợ sử dụng trên nhiều thiết bị</span></div></section><section class="card about-card"><h2>Tác giả</h2><p><strong>Nguyễn Quang Minh</strong></p><p>Email: <a class="safe-link" href="mailto:quangminh071093@gmail.com">quangminh071093@gmail.com</a></p></section></div>`:''}
  ${activeHelpTab==='guide'?`<div class="help-search"><label for="helpSearch">Tìm trong hướng dẫn</label><input id="helpSearch" type="search" value="${esc(helpSearchTerm)}" placeholder="Tìm trong hướng dẫn..."></div><div class="help-layout"><aside class="help-toc" aria-label="Mục lục hướng dẫn">${topics.map(topic=>`<button class="${activeHelpTopic===topic.id?'active':''}" data-help-topic="${topic.id}">${esc(topic.title)}</button>`).join('')||'<p>Không tìm thấy nội dung phù hợp.</p>'}</aside><div class="help-content">${topics.map(topic=>`<article id="help-${topic.id}" class="help-topic ${activeHelpTopic===topic.id?'active':''}"><h2>${esc(topic.title)}</h2>${topic.html}</article>`).join('')}</div></div>`:''}
  ${activeHelpTab==='data'?`<section class="card help-prose"><h2>Quản lý dữ liệu & Google Drive</h2><p>Ứng dụng lưu dữ liệu local-first trong bộ nhớ trình duyệt. Khi kết nối Google Drive, dữ liệu được đồng bộ vào tệp riêng của tài khoản đang đăng nhập.</p><div class="help-callout tip"><strong>Mẹo</strong><p>Nhấn “Đồng bộ ngay” trước khi chuyển thiết bị. Nếu có thay đổi đồng thời, ứng dụng yêu cầu chọn tải bản Drive hoặc giữ bản máy này.</p></div><h3>Sao lưu</h3><p>Khi tải lên có thay đổi từ 25% trở lên và trong ngày chưa có bản sao lưu, ứng dụng tạo backup của dữ liệu Drive hiện tại.</p><h3>Khi chưa kết nối</h3><p>Dữ liệu vẫn nằm trong localStorage của trình duyệt hiện tại và được đánh dấu chưa đồng bộ.</p></section>`:''}
  ${activeHelpTab==='version'?`<section class="card help-prose"><h2>Thông tin phiên bản</h2><p>CardFlow Web — ứng dụng quản lý thẻ theo mô hình local-first, hỗ trợ đồng bộ Google Drive.</p><p>Dữ liệu hiện dùng schemaVersion 5 và giữ cơ chế chuẩn hóa tương thích với dữ liệu cũ.</p></section>`:''}</div>`;
  wireHelpCenter();
}

function helpTopics(){
  return [
  {id:'getting-started',title:'Bắt đầu sử dụng',html:`<h3>Thiết lập ban đầu</h3><p>Tạo <strong>Mã ngân hàng</strong> trước, sau đó thêm <strong>Thẻ</strong>; Host có thể bỏ qua và bổ sung sau. Card ID do người dùng nhập và phải là duy nhất.</p><p><strong>Thẻ</strong>, <strong>Mã ngân hàng</strong> và <strong>Bảng MCC</strong> là ba danh mục dùng chung toàn ứng dụng: chỉ cấu hình một lần, không phụ thuộc tháng/năm và được các giao dịch, chương trình Cashback cùng các trang liên quan tham chiếu lại. Các dropdown danh mục chữ được sắp xếp theo nhãn tiếng Việt; lựa chọn đặc biệt, ngày, tháng, năm và trạng thái nghiệp vụ vẫn giữ thứ tự phù hợp.</p><p>Kết nối Google Drive để đồng bộ trên nhiều thiết bị.</p><div class="help-callout note"><strong>Lưu ý</strong><p>Nếu chưa có mã ngân hàng, ứng dụng không cho thêm thẻ. Khi đổi Card ID, ứng dụng cập nhật các dữ liệu đang tham chiếu tới thẻ đó.</p></div>`},
  {id:'row-selection',title:'Chọn dòng & Menu chuột phải',html:`<p>Tính năng có trên các bảng CRUD: <strong>Thẻ, Chương trình Cashback, Giao dịch, Cashback thực nhận, Thanh toán thẻ, Tiến độ hoàn phí thường niên, Host, Bảng MCC và Mã ngân hàng</strong>. Các bảng thống kê chỉ đọc không có menu này.</p><h3>Danh sách thu gọn trên tablet và điện thoại</h3><p>Trên tablet và smartphone, mỗi bản ghi được hiển thị thành một dòng tiêu đề nhỏ gọn. Chạm vào tiêu đề để mở hoặc thu gọn chi tiết; biểu tượng mũi tên cho biết trạng thái hiện tại. Ví dụ: giao dịch dùng tiêu đề <strong>Ngày_Card ID</strong>, thẻ và Tình trạng thẻ dùng <strong>Card ID</strong>. Cách trình bày này giúp xem danh sách dài nhanh hơn. Trên desktop, bảng đầy đủ vẫn được giữ nguyên.</p><h3>Chọn một hoặc nhiều dòng</h3><p>Click một dòng để chọn riêng dòng đó; dòng được chọn có nền highlight. Để chọn nhiều dòng rời nhau, dùng <strong>Ctrl + Click</strong> trên Windows/Linux hoặc <strong>Cmd + Click</strong> trên macOS. Để chọn một dải liên tiếp, click dòng đầu, giữ <strong>Shift</strong> rồi click dòng cuối.</p><h3>Menu chuột phải / context menu</h3><p>Bấm chuột phải trên dòng đã chọn để mở menu gần con trỏ. Với một dòng, menu có <strong>Thêm, Chỉnh sửa, Xóa</strong>. Với nhiều dòng, menu có <strong>Thêm</strong> và <strong>Xóa các dòng đã chọn</strong>; Chỉnh sửa bị khóa vì ứng dụng chưa hỗ trợ bulk edit.</p><p>Chuột phải trên một dòng đã thuộc multi-selection sẽ giữ toàn bộ lựa chọn. Chuột phải trên dòng chưa được chọn sẽ bỏ lựa chọn cũ và chỉ chọn dòng mới trước khi mở menu.</p><h3>Xóa nhiều dòng an toàn</h3><p>Chọn nhiều dòng → bấm chuột phải → chọn “Xóa các dòng đã chọn” → xác nhận. Ứng dụng dùng một hộp xác nhận cho cả nhóm và vẫn kiểm tra các ràng buộc dữ liệu trước khi xóa.</p><p>Các nút <strong>Thêm, Chỉnh sửa, Xóa</strong> phía trên bảng vẫn hoạt động bình thường; menu chuột phải chỉ là thao tác nhanh bổ sung trên desktop. Trên tablet/mobile, tiếp tục dùng các nút CRUD. Tablet có chuột hoặc trackpad có thể dùng context menu nếu thiết bị hỗ trợ.</p><div class="help-callout tip"><strong>Mẹo</strong><p>Khi cần xóa nhiều giao dịch, hãy dùng Ctrl + Click hoặc Shift + Click để chọn nhiều dòng rồi bấm chuột phải.</p></div><p class="help-search-keywords">Từ khóa: danh sách thu gọn, accordion, mở chi tiết, chuột phải, menu chuột phải, context menu, chọn nhiều dòng, Ctrl, Cmd, Shift, xóa nhiều dòng, bulk delete.</p>`},
  {id:'cards',title:'Quản lý thẻ',html:`<p>Thẻ là danh sách dùng chung cho mọi tháng. Dùng Thêm, Chỉnh sửa, Xóa để quản lý Card ID, thẻ Credit hoặc Debit, phôi, hình thức, ngày sao kê, hạn mức, phí thường niên và ghi chú; các trang liên quan tham chiếu Card ID từ danh sách này.</p><p><strong>Ngày sao kê</strong> quyết định kỳ của từng giao dịch; <strong>Hạn thanh toán</strong> nằm trong tháng kế tiếp sau kỳ sao kê. Ví dụ Ngày sao kê 20, Hạn thanh toán 5: giao dịch 19-08 thuộc kỳ 08/2026 và đến hạn 05-09-2026; giao dịch 21-08 thuộc kỳ 09/2026 và đến hạn 05-10-2026. Ngày 29–31 được điều chỉnh về ngày hợp lệ cuối tháng khi cần.</p><p>Giao dịch đúng ngày sao kê có thể phụ thuộc thời điểm chốt của ngân hàng. App tạm xếp vào kỳ sớm hơn và cảnh báo để người dùng kiểm tra sao kê thực tế.</p><p>Thẻ Debit không dùng ngày sao kê, hạn mức nhóm hay dư nợ. Với thẻ Credit, chọn các thẻ ở “Dùng chung hạn mức”; các thẻ trong nhóm dùng cùng hạn mức và dư nợ nhóm.</p><div class="help-callout example"><strong>Ví dụ</strong><p>Hai thẻ cùng nhóm hạn mức hiển thị cùng hạn mức khả dụng sau khi trừ tổng dư nợ của cả nhóm.</p></div>`},
  {id:'cashback',title:'Chương trình Cashback',html:`<p>Chương trình Cashback được quản lý riêng theo từng tháng. Khi mở một tháng chưa có rule, ứng dụng tự sao chép toàn bộ rule từ tháng liền trước; nếu tháng trước cũng trống thì tháng mới vẫn để trống.</p><p>Bản sao là snapshot độc lập. Hãy chỉnh rule của tháng mới khi ngân hàng thay đổi chính sách; thêm, sửa hoặc xóa trong tháng mới không làm thay đổi dữ liệu tháng trước.</p><p>Mỗi rule gồm % Cashback, Max CB, chỉ tiêu tổng và MCC áp dụng. Max CB “Không giới hạn” không tạo mức chi nhóm để max; khi có giới hạn, ứng dụng suy ra mức chi cần thiết từ tỷ lệ và Max CB.</p><p>Một thẻ có thể có nhiều tiêu chí. Với các rule cạnh tranh trong cùng thẻ/tháng, rule đạt đủ điều kiện trước được tính; các rule còn lại bị khóa để tránh cộng trùng. Giao dịch phải đúng Card ID, MCC/loại đơn và trạng thái hợp lệ.</p>`},
  {id:'transactions',title:'Giao dịch',html:`<p>Mỗi giao dịch có Ngày, Card ID, Loại đơn, Host, Số tiền đơn, Tiền Back, % Phí Host, Phí Host, hình thức Online/Offline/Quẹt POS, trạng thái và ghi chú.</p><p>Khi chọn “Tiêu dùng cá nhân”, Host, Ngày Back và Tiền Back bị khóa/xóa; giao dịch đó không áp dụng phí Host. <strong>Ghi chú luôn được giữ và vẫn có thể chỉnh sửa.</strong></p><h3>Thao tác nhanh nhiều giao dịch</h3><p>Dùng <strong>Ctrl/Cmd + Click</strong> để chọn từng giao dịch rời nhau hoặc <strong>Shift + Click</strong> để chọn một dải. Bấm chuột phải và chọn “Xóa các dòng đã chọn”; sau khi xác nhận, bảng và các tổng hợp phụ thuộc được tính lại theo dữ liệu còn lại.</p><div class="help-callout tip"><strong>Mẹo</strong><p>Khi cần xóa nhiều giao dịch, hãy dùng Ctrl + Click hoặc Shift + Click để chọn nhiều dòng rồi bấm chuột phải.</p></div>`},
  {id:'cashback-receipts',title:'Cashback thực nhận',html:`<p>Ghi nhận Ngày, Ngân hàng, Card ID, Tiền Cashback và Ghi chú cho khoản ngân hàng thực trả. Dữ liệu này dùng để đối chiếu với Cashback theo rule; hai số có thể khác vì một bên là dự kiến, một bên là khoản đã nhận.</p>`},
  {id:'annual-fee',title:'Tiến độ hoàn phí thường niên',html:`<p>Tạo mục tiêu theo thẻ, mức phí, chỉ tiêu chi, chu kỳ, MCC và hình thức giao dịch. Ứng dụng cộng chi tiêu hợp lệ trong chu kỳ, tính số còn thiếu, phần trăm tiến độ và số ngày còn lại.</p><p>Có thể tạo nhiều rule trên cùng thẻ. Rule đạt 100% chuyển sang “Đã đạt”; nhắc nhở của mục tiêu đã đạt, hết hạn hoặc bị tắt sẽ không còn hiển thị như mục tiêu cần theo dõi.</p>`},
  {id:'dashboard',title:'Tổng hợp',html:`<p>“Tình trạng thẻ” tổng hợp hạn mức nhóm duy nhất, chi tháng, dư nợ và hạn mức còn lại. Dư nợ bằng tổng giao dịch trừ thanh toán đã nhập; hạn mức còn lại bằng hạn mức nhóm trừ dư nợ toàn nhóm.</p><p>Khu vực “Nhắc nhở” trong Tổng hợp ưu tiên nghĩa vụ thanh toán thực tế quá hạn, đến hạn hôm nay và sắp đến hạn trong 7 ngày. Popup cảnh báo có thể xuất hiện lại sau khoảng 30 phút khi vẫn còn kỳ đủ điều kiện chưa thanh toán. Nhấn “Đã hiểu” chỉ đóng popup hiện tại; cảnh báo của từng kỳ chỉ dừng sau khi đúng thẻ và kỳ đó được đánh dấu “Đã thanh toán” trong Thanh toán thẻ. Thẻ chưa thiết lập hạn thanh toán hoặc kỳ không còn dư nợ không phát sinh cảnh báo.</p><p>Cashback theo rule là tổng cashback được tính trong tháng. Lợi nhuận ước tính bằng chênh lệch đơn từ Host cộng Cashback theo rule. Các KPI dùng năm/tháng đang chọn.</p><div class="help-callout note"><strong>Lưu ý</strong><p>Cashback thực nhận không thay thế Cashback theo rule trong công thức lợi nhuận ước tính.</p></div>`},
  {id:'payments',title:'Thanh toán thẻ',html:`<p>Nhập khoản thanh toán theo ngày, Card ID và đúng kỳ sao kê. Khoản này được trừ khỏi nghĩa vụ của kỳ tương ứng và khỏi dư nợ thẻ.</p><p>Ngày sao kê 20, Hạn thanh toán 5: giao dịch 19-08 thuộc kỳ 08/2026, hạn 05-09-2026; giao dịch 21-08 thuộc kỳ 09/2026, hạn 05-10-2026. Giao dịch đúng ngày sao kê được tạm xếp vào kỳ sớm hơn và có cảnh báo kiểm tra sao kê ngân hàng.</p><p>Đánh dấu <strong>Đã thanh toán</strong> chỉ tắt cảnh báo của đúng Card ID + kỳ đã chọn. Các kỳ khác vẫn độc lập và tiếp tục cảnh báo khi còn dư nợ.</p>`},
  {id:'sync',title:'Đồng bộ & sao lưu',html:`<p>Kết nối Google Drive thủ công rồi dùng “Đồng bộ ngay”. Mọi chỉnh sửa trước hết lưu vào local cache và được đánh dấu chưa đồng bộ.</p><p>Nếu Drive đã đổi trong lúc máy này cũng có thay đổi, ứng dụng yêu cầu chọn tải bản Drive hoặc giữ bản máy này. Trên thiết bị khác, đăng nhập cùng tài khoản và chờ đồng bộ hoàn tất trước khi sửa.</p>`},
  {id:'faq',title:'Câu hỏi thường gặp',html:`<h3>Vì sao giao dịch chưa được tính Cashback?</h3><p>Kiểm tra Card ID, MCC/loại đơn, trạng thái, tháng đang chọn và điều kiện rule.</p><h3>Vì sao Cashback thực nhận khác Cashback dự kiến?</h3><p>Một số là khoản nhập từ ngân hàng, số kia được tính theo rule.</p><h3>Vì sao hai thẻ có cùng hạn mức?</h3><p>Hai thẻ thuộc cùng nhóm hạn mức.</p><h3>Dùng thiết bị khác có mất dữ liệu không?</h3><p>Không nếu đã đồng bộ xong bằng cùng tài khoản Google Drive.</p><h3>Nếu Google Drive chưa kết nối thì dữ liệu nằm ở đâu?</h3><p>Trong localStorage của trình duyệt hiện tại.</p><h3>Vì sao một tiêu chí Cashback bị khóa?</h3><p>Một rule cạnh tranh khác trên cùng thẻ đã đạt điều kiện trước trong tháng.</p>`}
];}
function wireHelpCenter(){document.querySelectorAll('[data-help-tab]').forEach(button=>button.addEventListener('click',()=>{activeHelpTab=button.dataset.helpTab;renderAbout();}));document.querySelectorAll('[data-help-topic]').forEach(button=>button.addEventListener('click',()=>selectHelpTopic(button.dataset.helpTopic)));document.querySelector('#helpSearch')?.addEventListener('input',event=>{helpSearchTerm=event.target.value;activeHelpTopic=helpTopics().find(topic=>`${topic.title} ${topic.html}`.toLowerCase().includes(helpSearchTerm.toLowerCase()))?.id||'';renderAbout();document.querySelector('#helpSearch')?.focus();});}
function selectHelpTopic(topic){activeHelpTopic=topic;document.querySelectorAll('[data-help-topic]').forEach(button=>button.classList.toggle('active',button.dataset.helpTopic===topic));document.querySelectorAll('.help-topic').forEach(section=>section.classList.toggle('active',section.id===`help-${topic}`));document.querySelector(`#help-${topic}`)?.scrollIntoView({behavior:'smooth',block:'start'});}
function openContextHelp(topic){activeHelpTab='guide';activeHelpTopic=topic||HELP_TOPIC_BY_VIEW[currentView]||'getting-started';helpSearchTerm='';setView('about');renderAbout();requestAnimationFrame(()=>selectHelpTopic(activeHelpTopic));}

function selectOptions(items, labelFn, valueFn=x=>x.id){
  return sortOptionsByVietnameseLabel(items.map(x=>({value:valueFn(x), label:labelFn(x)})));
}
function normalizedProgramForDisplay(program={}){
  if(!isCashbackUnlimited(program)) return program;
  const fakeTotalTarget = isLegacyVpDebitFakeUnlimited(program) && Number(program.totalTarget) === 999999999999;
  return {
    ...program,
    maxCashbackUnlimited:true,
    max:null,
    eligibleTarget:null,
    totalTarget:fakeTotalTarget ? null : (Number(program.totalTarget) > 0 ? Number(program.totalTarget) : null),
    totalTargetManuallyEdited:fakeTotalTarget ? false : program.totalTargetManuallyEdited
  };
}
function programSpendToMax(program){
  if(isCashbackUnlimited(program)) return null;
  return calculateSpendToMax(program?.rate, program?.max);
}
function transactionMethodLabel(channel){
  return TRANSACTION_METHOD_OPTIONS.find(option=>option.value===channel)?.label || channel || "";
}
function uniqueCashbackProgramId(baseId){
  let id=baseId;
  let index=2;
  while(state.cashbackPrograms.some(program=>program.id===id)){
    id=`${baseId}-${index}`;
    index+=1;
  }
  return id;
}
function programFields(program={}){
  program=normalizedProgramForDisplay(program);
  const normalizedMcc = normalizeProgramMcc(program, state.mccCategories);
  const selectedMcc = normalizedMcc.allMcc ? [ALL_MCC_VALUE] : normalizedMcc.mccCategoryIds;
  const unlimited=isCashbackUnlimited(program);
  const spendToMax=programSpendToMax(program);
  return [
    {name:"name", label:"Tên chương trình cashback", value:program.name || "", type:"text", required:true, formLayout:"cashback-form-grid", layoutClass:"span-2"},
    {name:"cardId", label:"Card ID", value:program.cardId || state.cards[0]?.id || "", type:"select", options:selectOptions(state.cards, c=>c.id)},
    {name:"rate", label:"Tỷ lệ cashback (0.05 = 5%)", value:program.rate ?? 0, type:"number", step:"0.001", kind:"number"},
    {name:"max", label:"Max Cashback (VND)", value:unlimited?"":program.max || 0, type:"text", kind:"money", allowEmpty:true},
    {name:"combineOperator", label:"Điều kiện kết hợp", value:normalizeCombineOperator(program.combineOperator), type:"select", options:[{value:"AND",label:"AND"},{value:"OR",label:"OR"}]},
    {name:"eligibleTarget", label:"Chi nhóm để max", value:spendToMax == null ? "Không áp dụng" : formatMoneyDisplay(spendToMax), type:"text", readonly:true},
    {name:"totalTarget", label:"Chỉ tiêu tổng", value:program.totalTarget ?? spendToMax, type:"text", kind:"money", allowEmpty:true},
    {name:"maxCashbackMode", label:"Loại giới hạn", value:unlimited?"unlimited":"capped", type:"select", options:[{value:"capped",label:"Có giới hạn"},{value:"unlimited",label:"Không giới hạn"}]},
    {name:"channel", label:"Hình thức giao dịch", value:program.channel || "", type:"select", options:TRANSACTION_METHOD_OPTIONS_WITH_ALL},
    {name:"mccSelection", label:"Nhóm MCC áp dụng", value:selectedMcc, type:"multiselect", options:[{value:ALL_MCC_VALUE,label:"Tất cả"}, ...selectOptions(state.mccCategories, c=>`${c.name} (${c.mcc})`)], layoutClass:"span-full", hint:"Chọn Tất cả hoặc một/nhiều nhóm MCC."}
  ];
}
function mccProgramSummary(program, compact=false){
  if(Array.isArray(program.conditions) && program.conditions.length>1){
    const normalizedConditions=program.conditions.map(condition=>normalizeProgramMcc(condition,state.mccCategories));
    if(normalizedConditions.some(condition=>condition.allMcc)) return "Tất cả";
    const names=[...new Set(normalizedConditions.flatMap(condition=>condition.mccCategoryIds).map(id=>state.mccCategories.find(x=>x.id===id)?.name).filter(Boolean))];
    return names.length>3?`${names.length} nhóm MCC đã chọn`:names.join(", ")||"Chưa chọn";
  }
  const normalized = normalizeProgramMcc(program, state.mccCategories);
  if(normalized.allMcc) return "Tất cả";
  const names=normalized.mccCategoryIds.map(id=>state.mccCategories.find(x=>x.id===id)?.name).filter(Boolean);
  if(!compact || names.length <= 1) return names.join(", ") || "Chưa chọn";
  return `${names[0]} + ${names.length-1} nhóm khác`;
}
function mccProgramCodes(program){
  if(Array.isArray(program.conditions) && program.conditions.length>1){
    const normalizedConditions=program.conditions.map(condition=>normalizeProgramMcc(condition,state.mccCategories));
    if(normalizedConditions.some(condition=>condition.allMcc)) return "Tất cả";
    return [...new Set(normalizedConditions.flatMap(condition=>condition.mccCategoryIds).map(id=>state.mccCategories.find(x=>x.id===id)?.mcc).filter(value=>value!==undefined&&value!==null&&value!==""))].join(", ")||"Chưa chọn";
  }
  const normalized=normalizeProgramMcc(program,state.mccCategories);
  if(normalized.allMcc) return "Tất cả";
  return normalized.mccCategoryIds.map(id=>state.mccCategories.find(x=>x.id===id)?.mcc).filter(value=>value!==undefined && value!==null && value!=="").join(", ") || "Chưa chọn";
}
function wireProgramMccForm(modal){
  const field=modal.querySelector('[data-multiselect-name="mccSelection"]');
  if(!field) return;
  const toggle=field.querySelector("[data-multiselect-toggle]");
  const boxes=[...field.querySelectorAll('input[type="checkbox"]')];
  let previous=boxes.filter(x=>x.checked).map(x=>x.value);
  const update=()=>{
    const selected=boxes.filter(x=>x.checked).map(x=>x.value);
    const allJustSelected=selected.includes(ALL_MCC_VALUE) && !previous.includes(ALL_MCC_VALUE);
    if(allJustSelected) boxes.forEach(box=>{ box.checked=box.value===ALL_MCC_VALUE; });
    else if(selected.some(value=>value!==ALL_MCC_VALUE)) boxes.forEach(box=>{ if(box.value===ALL_MCC_VALUE) box.checked=false; });
    const chosen=boxes.filter(x=>x.checked).map(x=>x.value);
    if(chosen.includes(ALL_MCC_VALUE)) toggle.textContent="Tất cả";
    else {
      const names=chosen.map(id=>state.mccCategories.find(x=>x.id===id)?.name).filter(Boolean);
      toggle.textContent=names.length===0?"Chưa chọn":names.length===1?names[0]:names.length<=3?`${names[0]} + ${names.length-1} nhóm khác`:`${names.length} nhóm MCC đã chọn`;
    }
    previous=chosen;
  };
  toggle.addEventListener("click",()=>field.classList.toggle("open"));
  boxes.forEach(box=>box.addEventListener("change",update));
  document.addEventListener("click",event=>{ if(!field.contains(event.target)) field.classList.remove("open"); });
  update();
}
function wireProgramAutoTargetForm(modal, fields, existing={}){
  wireProgramMccForm(modal);
  existing=normalizedProgramForDisplay(existing);
  const mode=modal.querySelector('[name="maxCashbackMode"]');
  const rate=modal.querySelector('[name="rate"]');
  const max=modal.querySelector('[name="max"]');
  const eligible=modal.querySelector('[name="eligibleTarget"]');
  const total=modal.querySelector('[name="totalTarget"]');
  if(!mode || !rate || !max || !eligible || !total) return;
  const maxField=max.closest(".field");
  const totalField=total.closest(".field");
  const autoButton=document.createElement("button");
  autoButton.type="button";
  autoButton.className="secondary-btn auto-target-btn";
  autoButton.textContent="Tự động";
  totalField?.appendChild(autoButton);
  let totalManuallyEdited=existing.totalTargetManuallyEdited === true;
  const calculatedSpend=()=>{
    if(mode.value==="unlimited") return null;
    return calculateSpendToMax(Number(rate.value)||0, parseMoney(max.value, {emptyValue:0}));
  };
  const applyAuto=(force=false)=>{
    const spend=calculatedSpend();
    if(mode.value==="unlimited"){
      eligible.value="Không áp dụng";
      if(force || !totalManuallyEdited) total.value="";
      max.value="";
      maxField.style.display="none";
      return;
    }
    maxField.style.display="";
    if(spend == null){
      eligible.value="Không áp dụng";
      if(force || !totalManuallyEdited) total.value="";
      return;
    }
    eligible.value=formatMoneyDisplay(spend);
    if(force || !totalManuallyEdited) total.value=formatMoneyInput(spend, {allowEmpty:true});
  };
  [rate,max,mode].forEach(input=>input.addEventListener("input",()=>applyAuto(false)));
  mode.addEventListener("change",()=>applyAuto(false));
  total.addEventListener("input",()=>{ totalManuallyEdited=true; total.dataset.manuallyEdited="true"; });
  autoButton.addEventListener("click",()=>{
    totalManuallyEdited=false;
    total.dataset.manuallyEdited="false";
    applyAuto(true);
  });
  total.dataset.manuallyEdited=String(totalManuallyEdited);
  applyAuto(false);
}
function normalizeProgramValues(values, existing={}){
  existing=normalizedProgramForDisplay(existing);
  const selection=Array.isArray(values.mccSelection)?values.mccSelection:[];
  const allMcc=selection.includes(ALL_MCC_VALUE);
  const mccCategoryIds=allMcc?[]:selection.filter(id=>state.mccCategories.some(x=>x.id===id));
  const name=String(values.name || "");
  const baseId=buildCashbackProgramId(values.cardId, name);
  const id=existing.id || uniqueCashbackProgramId(baseId);
  if(!values.cardId) return {error:"Vui lòng chọn thẻ."};
  if(!name.trim()) return {error:"Vui lòng nhập tên chương trình cashback."};
  if(!id) return {error:"Không thể tạo mã chương trình."};
  if(!allMcc && !mccCategoryIds.length) return {error:"Vui lòng chọn Tất cả hoặc ít nhất một nhóm MCC."};
  const categories=mccCategoryIds.map(categoryId=>state.mccCategories.find(x=>x.id===categoryId)?.name).filter(Boolean);
  const maxCashbackUnlimited=values.maxCashbackMode==="unlimited";
  const max=maxCashbackUnlimited ? null : normalizeMoney(values.max, {emptyValue:0});
  const eligibleTarget=maxCashbackUnlimited ? null : calculateSpendToMax(Number(values.rate)||0, max);
  const totalTarget=normalizeMoney(values.totalTarget, {emptyValue:null});
  const autoTotal=eligibleTarget;
  const totalTargetManuallyEdited=totalTarget != null && (autoTotal == null || totalTarget !== autoTotal);
  const program={...existing,...values,id,year:selectedYear,month:selectedMonth,name,combineOperator:normalizeCombineOperator(values.combineOperator),rate:Number(values.rate)||0,max,maxCashbackUnlimited,eligibleTarget,totalTarget,totalTargetManuallyEdited,allMcc,mccCategoryIds,categories};
  delete program.mccSelection;
  delete program.maxCashbackMode;
  return {program};
}
function syncCashbackCombineOperator(program){
  const operator=normalizeCombineOperator(program.combineOperator);
  state.cashbackPrograms.forEach(item=>{
    if(item.cardId===program.cardId && Number(item.year)===Number(program.year) && Number(item.month)===Number(program.month)) item.combineOperator=operator;
  });
}
function cashbackRateInput(value){
  return `${((Number(value)||0)*100).toFixed(2)}%`;
}
function parseCashbackRateInput(value){
  const normalized=String(value||"").replace("%","").trim().replace(",",".");
  return Math.max(0,(Number(normalized)||0)/100);
}
function cashbackConditionDraft(condition={},index=0,program={}){
  const normalized=normalizeCashbackConditions({...program,conditions:[condition]},state.mccCategories)[0];
  return {...normalized,id:condition.id||`${program.id||"PROGRAM"}-COND-${index+1}`};
}
function cashbackMccOptions(selected=[]){
  return [{value:ALL_MCC_VALUE,label:"Tất cả"},...selectOptions(state.mccCategories,item=>`${item.name} (${item.mcc})`)].map(option=>`<label class="multi-option"><input type="checkbox" value="${esc(option.value)}" ${selected.includes(option.value)?"checked":""}><span>${esc(option.label)}</span></label>`).join("");
}
function cashbackMccSummary(row){
  const checked=[...row.querySelectorAll('.cashback-mcc-select input:checked')].map(input=>input.value);
  if(checked.includes(ALL_MCC_VALUE)) return "Tất cả";
  if(!checked.length) return "Chưa chọn";
  if(checked.length===1) return state.mccCategories.find(item=>item.id===checked[0])?.name||"1 nhóm MCC đã chọn";
  return `${checked.length} nhóm MCC đã chọn`;
}
function cashbackConditionRow(condition,index,program){
  const normalized=cashbackConditionDraft(condition,index,program);
  const selected=normalized.allMcc?[ALL_MCC_VALUE]:normalized.mccCategoryIds;
  const unlimited=isCashbackUnlimited(normalized);
  const minSpend=unlimited?"Không giới hạn":formatMoneyInput(normalized.eligibleTarget,{allowEmpty:true});
  return `<div class="cashback-condition-row" data-condition-row data-condition-id="${esc(normalized.id)}">
    <div class="cashback-condition-index" data-label="Điều kiện"><span class="cashback-condition-badge">Điều kiện ${index+1}</span></div>
    <div class="cashback-condition-cell" data-label="MCC"><div class="multi-select cashback-mcc-select"><button type="button" class="multi-select-toggle" data-cashback-mcc-toggle>${esc(selected.includes(ALL_MCC_VALUE)?"Tất cả":selected.length?`${selected.length} nhóm MCC đã chọn`:"Chưa chọn")}</button><div class="multi-select-panel">${cashbackMccOptions(selected)}</div></div></div>
    <div class="cashback-condition-cell" data-label="Hình thức giao dịch"><select data-condition-channel><option value="">Tất cả</option><option value="Online" ${normalized.channel==="Online"?"selected":""}>Online</option><option value="Offline" ${normalized.channel==="Offline"?"selected":""}>Quẹt POS</option></select></div>
    <div class="cashback-condition-cell" data-label="Tỷ lệ hoàn (%)"><div class="cashback-rate-input"><input data-condition-rate inputmode="decimal" value="${esc(cashbackRateInput(normalized.rate))}" aria-label="Tỷ lệ hoàn"><span>%</span></div></div>
    <div class="cashback-condition-cell cashback-max-cell" data-label="Hoàn tối đa"><select data-condition-max-type><option value="LIMITED" ${unlimited?"":"selected"}>Có giới hạn</option><option value="UNLIMITED" ${unlimited?"selected":""}>Không giới hạn</option></select><div class="money-input"><input data-condition-max inputmode="numeric" value="${unlimited?"":esc(formatMoneyInput(normalized.max,{allowEmpty:true}))}" placeholder="${unlimited?"Không áp dụng":"0"}" ${unlimited?"disabled":""}><span>đ</span></div></div>
    <div class="cashback-condition-cell" data-label="Chi tối thiểu"><div class="money-input"><input data-condition-min readonly value="${esc(minSpend)}"><span class="${unlimited?"hidden":""}">đ</span></div></div>
    <div class="cashback-condition-action" data-label="Thao tác">${index?`<button type="button" class="icon-btn cashback-delete-condition" title="Xóa điều kiện" aria-label="Xóa điều kiện">${icon("trash")}</button>`:""}</div>
  </div>`;
}
function collectCashbackCondition(row){
  const selection=[...row.querySelectorAll('.cashback-mcc-select input:checked')].map(input=>input.value);
  const allMcc=selection.includes(ALL_MCC_VALUE);
  const mccCategoryIds=allMcc?[]:selection.filter(id=>state.mccCategories.some(item=>item.id===id));
  const maxCashbackUnlimited=row.querySelector("[data-condition-max-type]").value==="UNLIMITED";
  const rate=parseCashbackRateInput(row.querySelector("[data-condition-rate]").value);
  const max=maxCashbackUnlimited?null:parseMoney(row.querySelector("[data-condition-max]").value,{emptyValue:0});
  return {id:row.dataset.conditionId,allMcc,mccCategoryIds,categories:mccCategoryIds.map(id=>state.mccCategories.find(item=>item.id===id)?.name).filter(Boolean),channel:normalizeTransactionMethod(row.querySelector("[data-condition-channel]").value),rate,max,maxCashbackUnlimited,maxType:maxCashbackUnlimited?"UNLIMITED":"LIMITED",eligibleTarget:maxCashbackUnlimited?null:calculateSpendToMax(rate,max)};
}
function cashbackConnectorRow(operator){
  return `<div class="cashback-condition-connector" data-condition-connector><span>Điều kiện kết hợp</span><div class="cashback-operator" role="group"><button type="button" data-operator="AND" class="${operator==="AND"?"active":""}">AND</button><button type="button" data-operator="OR" class="${operator==="OR"?"active":""}">OR</button></div></div>`;
}
async function openCashbackProgramForm(title,existing={}){
  const modal=document.querySelector("#formModal"),form=modal.querySelector("form"),body=modal.querySelector(".modal-body");
  const initialConditions=normalizeCashbackConditions(existing,state.mccCategories);
  const totalCondition=existing.totalSpendCondition||{enabled:existing.totalTarget!=null,amount:existing.totalTarget};
  modal.querySelector("h2").textContent=title;
  form.classList.remove("card-modal"); form.classList.add("cashback-program-modal");
  body.className="modal-body cashback-program-form";
  body.innerHTML=`<div class="cashback-program-top"><div class="field"><label>Tên chương trình cashback</label><input name="name" required value="${esc(existing.name||"")}"></div><div class="field"><label>Card ID</label><select name="cardId">${selectOptions(state.cards,card=>card.id).map(option=>`<option value="${esc(option.value)}" ${option.value===(existing.cardId||state.cards[0]?.id)?"selected":""}>${esc(option.label)}</option>`).join("")}</select></div></div>
    <section class="cashback-conditions"><div class="cashback-condition-header"><span>Điều kiện</span><span>MCC</span><span>Hình thức giao dịch</span><span>Tỷ lệ hoàn (%)</span><span>Hoàn tối đa</span><span>Chi tối thiểu</span><span>Thao tác</span></div><div data-condition-list>${initialConditions.map((condition,index)=>`${cashbackConditionRow(condition,index,existing)}${index<initialConditions.length-1?cashbackConnectorRow(normalizeCombineOperator(existing.combineOperator)):""}`).join("")}</div></section>
    <button type="button" class="secondary-btn cashback-add-condition" data-add-condition>+ Thêm điều kiện</button>
    <div class="cashback-total-row"><label class="check-field"><input type="checkbox" data-total-enabled ${totalCondition.enabled?"checked":""}><span>Chi tổng</span></label><div class="money-input"><input data-total-amount inputmode="numeric" value="${esc(formatMoneyInput(totalCondition.amount,{allowEmpty:true}))}" ${totalCondition.enabled?"":"disabled"}><span>đ</span></div></div>`;
  let operator=normalizeCombineOperator(existing.combineOperator);
  const list=body.querySelector("[data-condition-list]");
  const refreshRows=()=>{list.querySelectorAll("[data-condition-connector]").forEach(connector=>connector.remove());const rows=[...list.querySelectorAll("[data-condition-row]")];rows.forEach((row,index)=>{row.querySelector(".cashback-condition-badge").textContent=`Điều kiện ${index+1}`;row.querySelector(".cashback-condition-action").innerHTML=index?`<button type="button" class="icon-btn cashback-delete-condition" title="Xóa điều kiện" aria-label="Xóa điều kiện">${icon("trash")}</button>`:"";if(index<rows.length-1)row.insertAdjacentHTML("afterend",cashbackConnectorRow(operator));});};
  const recalculate=row=>{const unlimited=row.querySelector("[data-condition-max-type]").value==="UNLIMITED",maxInput=row.querySelector("[data-condition-max]"),minInput=row.querySelector("[data-condition-min]"),unit=minInput.nextElementSibling;maxInput.disabled=unlimited;maxInput.placeholder=unlimited?"Không áp dụng":"0";if(unlimited){maxInput.value="";minInput.value="Không giới hạn";unit.classList.add("hidden");}else{maxInput.value=formatMoneyInput(maxInput.value,{allowEmpty:true});const spend=calculateSpendToMax(parseCashbackRateInput(row.querySelector("[data-condition-rate]").value),parseMoney(maxInput.value,{emptyValue:0}));minInput.value=spend==null?"":formatMoneyInput(spend,{allowEmpty:true});unit.classList.toggle("hidden",spend==null);}};
  const wireRow=row=>{const mcc=row.querySelector(".cashback-mcc-select"),toggle=mcc.querySelector("[data-cashback-mcc-toggle]"),boxes=[...mcc.querySelectorAll('input[type="checkbox"]')];toggle.onclick=()=>mcc.classList.toggle("open");boxes.forEach(box=>box.onchange=()=>{if(box.value===ALL_MCC_VALUE&&box.checked)boxes.forEach(other=>{other.checked=other===box;});else if(box.checked)boxes.find(other=>other.value===ALL_MCC_VALUE).checked=false;toggle.textContent=cashbackMccSummary(row);});const rate=row.querySelector("[data-condition-rate]"),max=row.querySelector("[data-condition-max]");rate.oninput=()=>recalculate(row);rate.onblur=()=>{rate.value=cashbackRateInput(parseCashbackRateInput(rate.value));recalculate(row);};max.oninput=()=>recalculate(row);max.onblur=()=>recalculate(row);row.querySelector("[data-condition-max-type]").onchange=()=>recalculate(row);recalculate(row);};
  [...list.querySelectorAll("[data-condition-row]")].forEach(wireRow);
  body.onclick=event=>{const operatorButton=event.target.closest("[data-operator]");if(operatorButton){operator=operatorButton.dataset.operator;body.querySelectorAll("[data-operator]").forEach(button=>button.classList.toggle("active",button.dataset.operator===operator));return;}if(event.target.closest("[data-add-condition]")){const index=list.querySelectorAll("[data-condition-row]").length;list.insertAdjacentHTML("beforeend",cashbackConditionRow({},index,{id:existing.id||"PROGRAM"}));wireRow(list.lastElementChild);refreshRows();return;}const remove=event.target.closest(".cashback-delete-condition");if(remove&&list.querySelectorAll("[data-condition-row]").length>1){remove.closest("[data-condition-row]").remove();refreshRows();}};
  const totalEnabled=body.querySelector("[data-total-enabled]"),totalAmount=body.querySelector("[data-total-amount]");totalEnabled.onchange=()=>{totalAmount.disabled=!totalEnabled.checked;if(totalEnabled.checked)totalAmount.focus();};totalAmount.oninput=()=>{totalAmount.value=formatMoneyInput(totalAmount.value,{allowEmpty:true});};
  modal.classList.add("show");
  return new Promise(resolve=>{const close=result=>{modal.classList.remove("show");form.onsubmit=null;body.onclick=null;form.classList.remove("cashback-program-modal");resolve(result);};modal.querySelector("[data-cancel-modal]").onclick=()=>close(null);form.onsubmit=event=>{event.preventDefault();const name=body.querySelector('[name="name"]').value;if(!name.trim())return toast("Vui lòng nhập tên chương trình cashback.");const cardId=body.querySelector('[name="cardId"]').value;if(!cardId)return toast("Vui lòng chọn thẻ.");const conditions=[...list.querySelectorAll("[data-condition-row]")].map(collectCashbackCondition);if(conditions.some(condition=>!condition.allMcc&&!condition.mccCategoryIds.length))return toast("Mỗi điều kiện phải chọn Tất cả hoặc ít nhất một nhóm MCC.");if(conditions.some(condition=>condition.rate<=0))return toast("Tỷ lệ hoàn phải lớn hơn 0%.");if(conditions.some(condition=>!condition.maxCashbackUnlimited&&condition.max<=0))return toast("Hoàn tối đa phải lớn hơn 0 hoặc chọn Không giới hạn.");const totalSpendCondition={enabled:totalEnabled.checked,amount:totalEnabled.checked?parseMoney(totalAmount.value,{emptyValue:null}):null};if(totalSpendCondition.enabled&&!totalSpendCondition.amount)return toast("Vui lòng nhập Chi tổng.");close({name,cardId,combineOperator:operator,conditions,totalSpendCondition});};});
}
function normalizeCashbackProgramFormValues(values,existing={}){
  const name=String(values.name||"");
  const id=existing.id||uniqueCashbackProgramId(buildCashbackProgramId(values.cardId,name));
  const first=values.conditions[0];
  const totalTarget=values.totalSpendCondition.enabled?values.totalSpendCondition.amount:null;
  return {...existing,id,year:selectedYear,month:selectedMonth,name,cardId:values.cardId,combineOperator:normalizeCombineOperator(values.combineOperator),conditions:values.conditions,totalSpendCondition:values.totalSpendCondition,totalTarget,totalTargetManuallyEdited:values.totalSpendCondition.enabled,...first};
}
function renderPrograms(){
  const pm=programMetrics(periodTx());
  const rows=sortDisplayRows(filteredRows("programs", pm, p=>`${p.cardId} ${p.id} ${p.name} ${isCashbackUnlimited(p)?"Không giới hạn":""} ${mccProgramSummary(p)} ${mccProgramCodes(p)} ${normalizeCombineOperator(p.combineOperator)}`),program=>program.cardId,program=>program.name);
  document.querySelector("#view-programs").innerHTML=`<div class="card"><div class="section-title"><h2>Chương trình cashback</h2><small>Thiết lập và theo dõi các chương trình, tỷ lệ và điều kiện hoàn tiền.</small></div>${toolbar("programs")}<div class="table-wrap"><table data-entity="programs"><thead><tr><th>Card ID</th><th>Chương trình</th><th>% CB</th><th>Max CB</th><th>Chi nhóm để max</th><th>Chỉ tiêu tổng</th><th>Hình thức giao dịch</th><th>Nhóm MCC</th><th>Mã MCC</th><th>Điều kiện kết hợp</th><th>CB tháng</th></tr></thead><tbody>
  ${rows.map(x=>`<tr data-id="${esc(x.id)}" class="${selectedRows.programs===x.id?"selected":""}${x.competitionLocked?" cashback-rule-locked":""}"><td>${esc(x.cardId)}</td><td>${esc(x.name)}${x.conditions?.length>1?` <span class="badge">${x.conditions.length} điều kiện</span>`:""}</td><td>${x.conditions?.length>1?`${x.conditions.map(condition=>formatCashbackRate(condition.rate)).join(" / ")}`:formatCashbackRate(x.rate)}</td><td class="num">${x.conditions?.length>1?x.conditions.map(condition=>isCashbackUnlimited(condition)?"Không giới hạn":formatMoneyDisplay(condition.max)).join(" / "):isCashbackUnlimited(x)?"Không giới hạn":formatMoneyDisplay(x.max)}</td><td class="num">${optionalMoneyDisplay(x.eligibleTarget)}</td><td class="num">${optionalMoneyDisplay(x.totalTarget)}</td><td>${esc(x.conditions?.length>1?x.conditions.map(condition=>transactionMethodLabel(condition.channel)||"Tất cả").join(" / "):transactionMethodLabel(x.channel)||"Tất cả")}</td><td class="wrap-cell">${esc(mccProgramSummary(x))}</td><td class="wrap-cell">${esc(mccProgramCodes(x))}</td><td>${esc(normalizeCombineOperator(x.combineOperator))}</td><td class="num">${formatMoneyDisplay(x.displayCashback)}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("programs", {
    add: async()=>{ const values=await openCashbackProgramForm("Thêm chương trình cashback");if(!values)return;const program=normalizeCashbackProgramFormValues(values);state.cashbackPrograms.push(program);selectedRows.programs=program.id;saveState("Đã thêm chương trình"); },
    edit: async id=>{ const i=state.cashbackPrograms.findIndex(x=>x.id===id);const existing=normalizedProgramForDisplay(state.cashbackPrograms[i]);const values=await openCashbackProgramForm("Chỉnh sửa chương trình cashback",existing);if(!values)return;state.cashbackPrograms[i]=normalizeCashbackProgramFormValues(values,existing);selectedRows.programs=id;saveState("Đã cập nhật chương trình"); },
    remove: id=>{ if(!confirm("Xóa chương trình cashback đã chọn?")) return; state.cashbackPrograms=state.cashbackPrograms.filter(x=>x.id!==id); clearRowSelection("programs"); saveState("Đã xóa chương trình"); },
    bulkRemove:ids=>{const selected=new Set(ids);state.cashbackPrograms=state.cashbackPrograms.filter(program=>!selected.has(program.id));clearRowSelection("programs");saveState(`Đã xóa ${ids.length} chương trình cashback`);}
  });
}

function ensureCashbackProgramsForSelectedPeriod(){
  const result=carryForwardCashbackPrograms(state.cashbackPrograms,selectedYear,selectedMonth);
  if(!result.copiedCount) return false;
  state.cashbackPrograms=result.programs;
  saveState(`Đã sao chép chương trình Cashback từ ${String(result.source.month).padStart(2,"0")}/${result.source.year}.`);
  return true;
}

function receiptFields(receipt={}){
  if(!state.banks.length || !state.cards.length){
    return [{type:"note", label:"Vui lòng cấu hình Mã ngân hàng và Thẻ trước khi ghi nhận cashback thực nhận."}];
  }
  const bankId = receipt.bankId || state.cards.find(card=>card.id===receipt.cardId)?.bankId || state.banks[0]?.id || "";
  const cardOptions = state.cards.filter(card=>card.bankId===bankId);
  return [
    {name:"date", label:"Ngày", value:receipt.date || todayStorageDate(), type:"date"},
    {name:"bankId", label:"Ngân hàng", value:bankId, type:"select", options:selectOptions(state.banks, b=>b.name)},
    {name:"cardId", label:"Thẻ", value:receipt.cardId || cardOptions[0]?.id || "", type:"select", options:selectOptions(cardOptions, cardDisplayName)},
    {name:"amount", label:"Tiền Cashback", value:receipt.amount ?? 0, type:"text", kind:"money"},
    {name:"notes", label:"Ghi chú", value:receipt.notes || "", type:"textarea"}
  ];
}

function wireCashbackReceiptForm(modal){
  const bankSelect = modal.querySelector('[name="bankId"]');
  const cardSelect = modal.querySelector('[name="cardId"]');
  if(!bankSelect || !cardSelect) return;
  const refreshCards = () => {
    const cards = state.cards.filter(card => card.bankId === bankSelect.value);
    const current = cards.some(card => card.id === cardSelect.value) ? cardSelect.value : cards[0]?.id || "";
    cardSelect.innerHTML = selectOptions(cards,cardDisplayName).map(option => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join("");
    cardSelect.value = current;
  };
  bankSelect.addEventListener("change", refreshCards);
  refreshCards();
}

function normalizeReceipt(values, existingId=""){
  const date = toStorageDate(values.date);
  if(!isValidDate(date)) return {error:"Ngày cashback thực nhận không hợp lệ."};
  const bank = state.banks.find(x=>x.id===values.bankId);
  if(!bank) return {error:"Vui lòng chọn ngân hàng."};
  const card = state.cards.find(x=>x.id===values.cardId && x.bankId===values.bankId);
  if(!card) return {error:"Vui lòng chọn thẻ thuộc ngân hàng đã chọn."};
  const amount = normalizeMoney(values.amount, {emptyValue:0});
  if(amount < 0) return {error:"Tiền Cashback phải lớn hơn hoặc bằng 0."};
  return {receipt:{
    id: existingId || prefixedUuid("CBR"),
    date,
    bankId: values.bankId,
    cardId: values.cardId,
    amount,
    notes: String(values.notes || "")
  }};
}

function renderCashbackReceipts(){
  const sorted = [...state.cashbackReceipts].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const rows=filteredRows("cashbackReceipts", sorted, r=>`${formatDateDisplay(r.date)} ${bankName(r.bankId)} ${cardName(r.cardId)} ${r.amount} ${r.notes||""}`);
  document.querySelector("#view-cashback-receipts").innerHTML=`<div class="card"><div class="section-title"><h2>Cashback thực nhận</h2><small>${rows.length} dòng</small></div>${!state.banks.length || !state.cards.length ? '<div class="note">Vui lòng cấu hình Mã ngân hàng và Thẻ trước khi ghi nhận cashback thực nhận.</div>' : ""}${toolbar("cashbackReceipts")}<div class="table-wrap"><table data-entity="cashbackReceipts"><thead><tr><th>Ngày</th><th>Ngân hàng</th><th>Thẻ</th><th>Tiền Cashback</th><th>Ghi chú</th></tr></thead><tbody>
  ${rows.map(r=>`<tr data-id="${esc(r.id)}" class="${selectedRows.cashbackReceipts===r.id?"selected":""}"><td>${esc(formatDateDisplay(r.date))}</td><td>${esc(bankName(r.bankId))}</td><td>${esc(cardName(r.cardId))}</td><td class="num">${formatMoneyDisplay(r.amount)}</td><td class="wrap-cell">${esc(r.notes || "—")}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("cashbackReceipts", {
    add: async()=>{ if(!state.banks.length || !state.cards.length){ toast("Vui lòng cấu hình Mã ngân hàng và Thẻ trước."); return; } const v=await openForm("Thêm cashback thực nhận", receiptFields(), {}, wireCashbackReceiptForm); if(!v) return; const result=normalizeReceipt(v); if(result.error) return toast(result.error); state.cashbackReceipts.push(result.receipt); selectedRows.cashbackReceipts=result.receipt.id; saveState("Đã thêm cashback thực nhận"); },
    edit: async id=>{ const i=state.cashbackReceipts.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa cashback thực nhận", receiptFields(state.cashbackReceipts[i]), state.cashbackReceipts[i], wireCashbackReceiptForm); if(!v) return; const result=normalizeReceipt(v, id); if(result.error) return toast(result.error); state.cashbackReceipts[i]=result.receipt; selectedRows.cashbackReceipts=id; saveState("Đã cập nhật cashback thực nhận"); },
    remove: id=>{ if(!confirm("Xóa cashback thực nhận đã chọn?")) return; state.cashbackReceipts=state.cashbackReceipts.filter(x=>x.id!==id); clearRowSelection("cashbackReceipts"); saveState("Đã xóa cashback thực nhận"); },
    bulkRemove:ids=>{const selected=new Set(ids);state.cashbackReceipts=state.cashbackReceipts.filter(receipt=>!selected.has(receipt.id));clearRowSelection("cashbackReceipts");saveState(`Đã xóa ${ids.length} khoản cashback thực nhận`);}
  });
}

function txFields(tx={}){
  const personalUse = normalizeTransactionStatus(tx.status) === TRANSACTION_STATUS.PERSONAL_USE;
  const hostOptions = [{value:"", label:""}, ...selectOptions(state.hosts, h=>h.name, h=>h.name)];
  const categoryOptions = [{value:ALL_ORDER_TYPE_VALUE, label:ALL_ORDER_TYPE_VALUE}, ...selectOptions(state.mccCategories, c=>`${c.name} (${c.mcc})`, c=>c.name)];
  return [
    {name:"date", label:"Ngày", value:tx.date || todayStorageDate(), type:"date"},
    {name:"host", label:"Host", value:personalUse ? "" : tx.host || state.hosts[0]?.name || "", type:"select", options:hostOptions, disabled:personalUse},
    {name:"category", label:"Loại đơn", value:tx.category || state.mccCategories[0]?.name || ALL_ORDER_TYPE_VALUE, type:"select", options:categoryOptions},
    {name:"channel", label:"Hình thức giao dịch", value:tx.channel || "Online", type:"select", options:TRANSACTION_METHOD_OPTIONS},
    {name:"cardId", label:"Thẻ", value:tx.cardId || state.cards[0]?.id || "", type:"select", options:selectOptions(state.cards, c=>cardName(c.id))},
    {name:"amount", label:"Tiền đơn (VND)", value:tx.amount ?? 0, type:"text", kind:"money"},
    {name:"status", label:"Trạng thái", value:normalizeTransactionStatus(tx.status), type:"select", options:TRANSACTION_STATUS_OPTIONS},
    {name:"backDate", label:"Ngày Back", value:personalUse ? "" : tx.backDate || "", type:"date", disabled:personalUse},
    {name:"backAmount", label:"Tiền Back (VND)", value:personalUse ? "" : tx.backAmount ?? 0, type:"text", kind:"money", allowEmpty:true, disabled:personalUse},
    {name:"note", label:"Ghi chú", value:tx.note || "", type:"textarea"}
  ];
}
function wireTxForm(modal){
  const status=modal.querySelector('[name="status"]');
  const host=modal.querySelector('[name="host"]');
  const backDate=modal.querySelector('[name="backDate"]');
  const backAmount=modal.querySelector('[name="backAmount"]');
  const note=modal.querySelector('[name="note"]');
  if(!status || !host || !backDate || !backAmount || !note) return;
  const setFieldDisabled=(input,disabled)=>{
    input.disabled=disabled;
    input.closest(".field")?.classList.toggle("disabled-field",disabled);
  };
  const apply=()=>{
    const personalUse=status.value===TRANSACTION_STATUS.PERSONAL_USE;
    if(personalUse){
      host.value="";
      backDate.value="";
      backAmount.value="";
    }
    setFieldDisabled(host,personalUse);
    setFieldDisabled(backDate,personalUse);
    setFieldDisabled(backAmount,personalUse);
    setFieldDisabled(note,false);
  };
  status.addEventListener("change",apply);
  apply();
}
function normalizeTx(v, existingId){
  const cat=categoryByName(v.category);
  const status=normalizeTransactionStatus(v.status);
  const personalUse=status===TRANSACTION_STATUS.PERSONAL_USE;
  return {...v, id:existingId || uuid("TX"), date:toStorageDate(v.date), host:personalUse ? null : (v.host || ""), category:v.category || ALL_ORDER_TYPE_VALUE, backDate:personalUse ? "" : toStorageDate(v.backDate), mcc:cat?.mcc || 0, status, amount:normalizeMoney(v.amount, {emptyValue:0}), backAmount:personalUse ? 0 : normalizeMoney(v.backAmount, {emptyValue:0})};
}
function transactionDifferencePercent(transaction){
  if(!isHostFeeApplicable(transaction)) return null;
  const amount=Number(transaction.amount)||0;
  if(amount===0) return null;
  return transactionDifference(transaction)/amount*100;
}
function transactionMonthlyTotals(transactions){
  const amount=sum(transactions,transaction=>transaction.amount);
  const backAmount=sum(transactions,transaction=>transaction.backAmount);
  const hostFeeRows=transactions.filter(isHostFeeApplicable);
  const hostFee=sum(hostFeeRows,transaction=>transactionDifference(transaction));
  const hostFeeBase=sum(hostFeeRows,transaction=>transaction.amount);
  return {amount,backAmount,hostFee,hostFeePercent:hostFeeBase===0?null:hostFee/hostFeeBase*100};
}
function renderTransactions(){
  const monthlyRows=[...periodTx()].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const totals=transactionMonthlyTotals(monthlyRows);
  const matchingRows=monthlyRows.filter(transaction=>matchesTransactionFilters(transaction,transactionFilters,hostName));
  const rows=filteredRows("transactions", matchingRows, t=>`${formatDateDisplay(t.date)} ${formatDateDisplay(t.backDate)} ${hostName(t.host)} ${t.category} ${t.mcc} ${t.cardId} ${cardName(t.cardId)} ${transactionMethodLabel(t.channel)} ${transactionStatusLabel(normalizeTransactionStatus(t.status))} ${t.status} ${t.note||""}`);
  const totalTone=totals.hostFee<0?"negative":totals.hostFee>0?"positive":"neutral";
  document.querySelector("#view-transactions").innerHTML=`<div class="card transactions-card"><div class="section-title"><h2>Danh sách giao dịch</h2><small>${rows.length}/${monthlyRows.length} dòng trong tháng</small></div>${transactionToolbar()}<div class="table-wrap"><table class="mobile-card-table" data-entity="transactions"><thead><tr><th>Ngày</th><th>Host</th><th>Loại đơn</th><th>MCC</th><th>Hình thức giao dịch</th><th>Card ID</th><th>Tiền đơn</th><th>Trạng thái</th><th>Ngày Back</th><th>Tiền Back</th><th>Ghi chú</th><th>% Phí Host</th><th>Phí Host</th></tr></thead><tbody>
  <tr class="summary-row transaction-total-row"><td>TỔNG</td><td></td><td></td><td></td><td></td><td></td><td class="num">${formatMoneyDisplay(totals.amount)}</td><td></td><td></td><td class="num">${formatMoneyDisplay(totals.backAmount)}</td><td></td><td class="num ${totalTone}">${formatPercentDisplay(totals.hostFeePercent)}</td><td class="num ${totalTone}">${formatMoneyDisplay(totals.hostFee)}</td></tr>
  ${rows.map(t=>{ const note = String(t.note || t.notes || "").trim(); const hostFee=transactionHostFee(t); const tone=hostFee == null ? "neutral" : hostFee<0?"negative":hostFee>0?"positive":"neutral"; return `<tr data-id="${esc(t.id)}" class="${selectedRows.transactions===t.id?"selected":""}"><td>${esc(formatDateDisplay(t.date))}</td><td>${esc(hostName(t.host))}</td><td>${esc(t.category)}</td><td>${esc(t.mcc)}</td><td>${esc(transactionMethodLabel(t.channel))}</td><td>${esc(t.cardId)}</td><td class="num">${formatMoneyDisplay(t.amount)}</td><td>${txStatusBadge(t.status)}</td><td>${esc(formatDateDisplay(t.backDate))}</td><td class="num">${formatMoneyDisplay(t.backAmount)}</td><td class="note-cell" title="${esc(note)}">${esc(note || "—")}</td><td class="num ${tone}">${formatPercentDisplay(transactionDifferencePercent(t))}</td><td class="num ${tone}">${hostFee == null ? "—" : formatMoneyDisplay(hostFee)}</td></tr>`; }).join("")}</tbody></table></div></div>`;
  wireToolbar("transactions", {
    add: async()=>{ const v=await openForm("Thêm giao dịch", txFields(), {}, wireTxForm); if(!v) return; if(!isValidDate(v.date)) return toast("Ngày giao dịch không hợp lệ."); if(v.backDate && !isValidDate(v.backDate)) return toast("Ngày Back không hợp lệ."); state.transactions.push(normalizeTx(v)); saveState("Đã lưu giao dịch"); },
    edit: async id=>{ const i=state.transactions.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa giao dịch", txFields(state.transactions[i]), state.transactions[i], wireTxForm); if(!v) return; if(!isValidDate(v.date)) return toast("Ngày giao dịch không hợp lệ."); if(v.backDate && !isValidDate(v.backDate)) return toast("Ngày Back không hợp lệ."); state.transactions[i]=normalizeTx(v,id); saveState("Đã cập nhật giao dịch"); },
    remove: id=>{ if(!confirm("Xóa giao dịch đã chọn?")) return; state.transactions=state.transactions.filter(t=>t.id!==id); clearRowSelection("transactions"); saveState("Đã xóa giao dịch"); },
    bulkRemove:ids=>{const selected=new Set(ids);state.transactions=state.transactions.filter(transaction=>!selected.has(transaction.id));clearRowSelection("transactions");saveState(`Đã xóa ${ids.length} giao dịch`);}
  });
}

function paymentFields(p={}){
  return [
    {name:"date", label:"Ngày", value:p.date || todayStorageDate(), type:"date"},
    {name:"cardId", label:"Thẻ", value:p.cardId || state.cards[0]?.id || "", type:"select", options:selectOptions(state.cards, c=>cardName(c.id))},
    {name:"paymentCycle", label:"Kỳ thanh toán", value:p.paymentCycle || paymentCycleFromDate(), type:"month", required:true, hint:"Kỳ tháng/năm của hạn thanh toán cần xác nhận."},
    {name:"paymentStatus", label:"Trạng thái kỳ", value:p.paymentStatus || "", type:"select", options:[{value:"",label:"Chưa thanh toán"},{value:"paid",label:"Đã thanh toán"}]},
    {name:"amount", label:"Số tiền thanh toán", value:p.amount || 0, type:"text", kind:"money"},
    {name:"note", label:"Ghi chú", value:p.note || "", type:"text"}
  ];
}
function paymentEffectiveDueDate(payment){
  const card=state.cards.find(item=>item.id===payment.cardId);
  return card ? effectivePaymentDueDateForCycle(card.paymentDueDay,payment.paymentCycle) : null;
}
function paymentEffectiveDueDateLabel(payment){
  return formatDateDisplay(paymentEffectiveDueDate(payment),{emptyText:"—"});
}
function renderPayments(){
  const obligationsByKey=new Map(paymentObligations().map(obligation=>[obligation.key,obligation]));
  const rows=filteredRows("payments", [...state.payments].sort((a,b)=>(b.date||"").localeCompare(a.date||"")), p=>`${formatDateDisplay(p.date)} ${cardName(p.cardId)} ${p.paymentCycle||""} ${paymentEffectiveDueDateLabel(p)} ${p.paymentStatus||""} ${p.amount} ${obligationsByKey.get(`${p.cardId}|${p.paymentCycle}`)?.outstandingAmount||0} ${p.note||""}`);
  document.querySelector("#view-payments").innerHTML=`<div class="card"><div class="section-title"><h2>Thanh toán thẻ</h2><small>${rows.length} dòng</small></div>${toolbar("payments")}<div class="table-wrap"><table class="mobile-card-table" data-entity="payments"><thead><tr><th>Ngày</th><th>Thẻ</th><th>Kỳ thanh toán</th><th>Hạn thanh toán</th><th>Trạng thái kỳ</th><th>Số tiền</th><th>Dư nợ kỳ</th><th>Ghi chú</th></tr></thead><tbody>
  ${rows.map(p=>{const obligation=obligationsByKey.get(`${p.cardId}|${p.paymentCycle}`);return `<tr data-id="${esc(p.id)}" class="${selectedRows.payments===p.id?"selected":""}"><td>${esc(formatDateDisplay(p.date))}</td><td>${esc(cardName(p.cardId))}</td><td>${esc(p.paymentCycle||"—")}</td><td>${esc(paymentEffectiveDueDateLabel(p))}</td><td><span class="badge ${p.paymentStatus==="paid"?"good":"warn"}">${p.paymentStatus==="paid"?"Đã thanh toán":"Chưa thanh toán"}</span></td><td class="num">${formatMoneyDisplay(p.amount)}</td><td class="num">${formatMoneyDisplay(obligation?.outstandingAmount||0)}</td><td>${esc(p.note||"")}</td></tr>`;}).join("")}</tbody></table></div></div>`;
  wireToolbar("payments", {
    add: async()=>{ const v=await openForm("Thêm thanh toán", paymentFields()); if(!v) return; if(!isValidDate(v.date)) return toast("Ngày thanh toán không hợp lệ."); if(!isValidPaymentCycle(v.paymentCycle)) return toast("Kỳ thanh toán không hợp lệ."); state.payments.push({...v,id:uuid("PAY"),date:toStorageDate(v.date),amount:normalizeMoney(v.amount, {emptyValue:0})}); saveState("Đã lưu thanh toán"); },
    edit: async id=>{ const i=state.payments.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa thanh toán", paymentFields(state.payments[i]), state.payments[i]); if(!v) return; if(!isValidDate(v.date)) return toast("Ngày thanh toán không hợp lệ."); if(!isValidPaymentCycle(v.paymentCycle)) return toast("Kỳ thanh toán không hợp lệ."); state.payments[i]={...v,id,date:toStorageDate(v.date),amount:normalizeMoney(v.amount, {emptyValue:0})}; saveState("Đã cập nhật thanh toán"); },
    remove: id=>{ if(!confirm("Xóa thanh toán đã chọn?")) return; state.payments=state.payments.filter(p=>p.id!==id); clearRowSelection("payments"); saveState("Đã xóa thanh toán"); },
    bulkRemove:ids=>{const selected=new Set(ids);state.payments=state.payments.filter(payment=>!selected.has(payment.id));clearRowSelection("payments");saveState(`Đã xóa ${ids.length} khoản thanh toán`);}
  });
}

function renderHosts(){
  const rows=filteredRows("hosts", state.hosts, h=>h.name);
  document.querySelector("#view-hosts").innerHTML=`<div class="card"><div class="section-title"><h2>Hosts</h2><small>Dùng trong giao dịch</small></div>${toolbar("hosts")}<div class="table-wrap"><table data-entity="hosts"><thead><tr><th>Tên Host</th><th>Số giao dịch</th></tr></thead><tbody>${rows.map(h=>`<tr data-id="${esc(h.id)}" class="${selectedRows.hosts===h.id?"selected":""}"><td>${esc(h.name)}</td><td class="num">${state.transactions.filter(t=>t.host===h.name || t.host===h.id).length}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("hosts", {
    add: async()=>{ const v=await openForm("Thêm Host", [{name:"name",label:"Tên Host",type:"text"}]); if(!v) return; state.hosts.push({id:uuid("HOST"),name:v.name}); saveState("Đã thêm Host"); },
    edit: async id=>{ const i=state.hosts.findIndex(x=>x.id===id); const old=state.hosts[i].name; const v=await openForm("Chỉnh sửa Host", [{name:"name",label:"Tên Host",type:"text",value:old}], state.hosts[i]); if(!v) return; state.hosts[i]={...state.hosts[i],name:v.name}; state.transactions.forEach(t=>{ if(t.host===old) t.host=v.name; }); saveState("Đã cập nhật Host"); },
    remove: id=>{ const h=state.hosts.find(x=>x.id===id); if(state.transactions.some(t=>t.host===h.name || t.host===h.id)) return toast("Không thể xóa Host đang có giao dịch."); if(!confirm("Xóa Host đã chọn?")) return; state.hosts=state.hosts.filter(x=>x.id!==id); clearRowSelection("hosts"); saveState("Đã xóa Host"); },
    bulkRemove:ids=>{const blocked=ids.filter(id=>{const host=state.hosts.find(item=>item.id===id);return host&&state.transactions.some(transaction=>transaction.host===host.name||transaction.host===host.id);});if(blocked.length)return toast(`Không thể xóa ${blocked.length} Host đang có giao dịch.`);const selected=new Set(ids);state.hosts=state.hosts.filter(host=>!selected.has(host.id));clearRowSelection("hosts");saveState(`Đã xóa ${ids.length} Host`);}
  });
}

function renderMcc(){
  const rows=filteredRows("mcc", state.mccCategories, c=>`${c.name} ${c.mcc}`);
  document.querySelector("#view-mcc").innerHTML=`<div class="card"><div class="section-title"><h2>Nhóm MCC</h2><small>Dùng cho rule Cashback và giao dịch</small></div>${toolbar("mcc")}<div class="table-wrap"><table data-entity="mcc"><thead><tr><th>Loại chi tiêu</th><th>MCC</th><th>Số giao dịch</th></tr></thead><tbody>${rows.map(c=>`<tr data-id="${esc(c.id)}" class="${selectedRows.mcc===c.id?"selected":""}"><td>${esc(c.name)}</td><td>${esc(c.mcc)}</td><td class="num">${state.transactions.filter(t=>t.category===c.name).length}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("mcc", {
    add: async()=>{ const v=await openForm("Thêm nhóm MCC", [{name:"name",label:"Loại chi tiêu",type:"text"},{name:"mcc",label:"MCC",type:"number",kind:"number"}]); if(!v) return; state.mccCategories.push({id:uuid("MCC"),name:v.name,mcc:Number(v.mcc)||0}); saveState("Đã thêm nhóm MCC"); },
    edit: async id=>{ const i=state.mccCategories.findIndex(x=>x.id===id); const old=state.mccCategories[i].name; const v=await openForm("Chỉnh sửa nhóm MCC", [{name:"name",label:"Loại chi tiêu",type:"text"},{name:"mcc",label:"MCC",type:"number",kind:"number"}], state.mccCategories[i]); if(!v) return; state.mccCategories[i]={...state.mccCategories[i],name:v.name,mcc:Number(v.mcc)||0}; state.transactions.forEach(t=>{ if(t.category===old){ t.category=v.name; t.mcc=Number(v.mcc)||0; } }); state.cashbackPrograms.forEach(p=>{ const conditions=normalizeCashbackConditions(p,state.mccCategories);conditions.forEach(condition=>{if((condition.mccCategoryIds||[]).includes(id))condition.categories=(condition.mccCategoryIds||[]).map(categoryId=>state.mccCategories.find(x=>x.id===categoryId)?.name).filter(Boolean);});p.conditions=conditions;const first=conditions[0];if((first.mccCategoryIds||[]).includes(id))p.categories=first.categories; }); saveState("Đã cập nhật nhóm MCC"); },
    remove: id=>{ const c=state.mccCategories.find(x=>x.id===id); if(state.transactions.some(t=>t.category===c.name)) return toast("Không thể xóa nhóm MCC đang có giao dịch."); if(state.cashbackPrograms.some(p=>normalizeCashbackConditions(p,state.mccCategories).some(condition=>!condition.allMcc&&(condition.mccCategoryIds||[]).includes(id)))) return toast("Không thể xóa nhóm MCC đang được chương trình cashback sử dụng."); if(!confirm("Xóa nhóm MCC đã chọn?")) return; state.mccCategories=state.mccCategories.filter(x=>x.id!==id); clearRowSelection("mcc"); saveState("Đã xóa nhóm MCC"); },
    bulkRemove:ids=>{const blocked=ids.filter(id=>{const category=state.mccCategories.find(item=>item.id===id);return category&&(state.transactions.some(transaction=>transaction.category===category.name)||state.cashbackPrograms.some(program=>normalizeCashbackConditions(program,state.mccCategories).some(condition=>!condition.allMcc&&(condition.mccCategoryIds||[]).includes(id))));});if(blocked.length)return toast(`Không thể xóa ${blocked.length} nhóm MCC đang được sử dụng.`);const selected=new Set(ids);state.mccCategories=state.mccCategories.filter(category=>!selected.has(category.id));clearRowSelection("mcc");saveState(`Đã xóa ${ids.length} nhóm MCC`);}
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
  return `<div class="card"><div class="section-title"><h2>Thẻ</h2><small>Cần ít nhất 1 thẻ</small></div>
    <button class="primary" id="setupAddCard">+ Thêm thẻ</button>
    <div class="table-wrap top-space"><table><thead><tr><th>Thẻ</th><th>Ngân hàng</th><th>Tên thẻ</th><th>Card ID</th><th>Hạn mức</th></tr></thead><tbody>${state.cards.map(c=>`<tr class="${c.cardType==="debit"?"debit-row":""}"><td>${esc(cardTypeLabel(c.cardType))}</td><td>${esc(bankName(c.bankId,c.bank))}</td><td>${esc(c.name)}</td><td>${esc(c.id)}</td><td class="num">${c.cardType==="debit"?"—":formatMoneyDisplay(c.groupLimit)}</td></tr>`).join("")}</tbody></table></div>
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
  const active = isConnected() && state.settings?.setupCompleted !== true;
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
    const v = await openForm("Thêm thẻ", cardFields({}, "add"), {}, wireCardForm);
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
  if(setupStep === 1 && !state.cards.length) return toast("Vui lòng thêm ít nhất 1 thẻ.");
  if(setupStep < 2 && !skipHost){ setupStep += 1; renderSetupWizard(); return; }
  state.settings = {...state.settings, setupCompleted:true};
  saveState("Đã hoàn tất thiết lập ban đầu");
  setView("dashboard");
  startPaymentWarningReminder();
}

function renderAll(){
  removeFilterPanelOutsideListener();
  closeTableContextMenu();
  renderDashboard(); renderTransactions(); renderCards(); renderPrograms(); renderCashbackReceipts(); renderFeeTargets(); renderPayments(); renderHosts(); renderMcc(); renderBanks(); renderAbout(); renderSyncStatus(); renderSetupWizard(); renderLoginGate();
  labelResponsiveTables();
  enhanceResponsiveRecordLists();
  refreshOpenPaymentWarningDialog();
}

function feeTypeLabel(value){ return ({annual_fee:"Phí thường niên",management_fee:"Phí quản lý",maintenance_fee:"Phí duy trì",other:"Khác"})[value] || "Khác"; }
function feeStatusLabel(value){ return ({achieved:"Đã đạt",expired:"Hết hạn",near:"Sắp đạt",tracking:"Đang theo dõi"})[value] || "Đang theo dõi"; }
function feeDaysLabel(metric){ return metric.rawDaysLeft<0?"Đã hết hạn":metric.rawDaysLeft===0?"Hôm nay":`${metric.daysLeft} ngày`; }
function feeTargetMetrics(){ return sortFeeTargetMetrics((state.feeTargets||[]).map(target=>calculateFeeTargetMetrics(target,state.transactions,state.mccCategories))); }
function feeTargetFields(target={}){
  const normalized=normalizeProgramMcc(target,state.mccCategories);
  return [
    {name:"cardId",label:"Thẻ",value:target.cardId||state.cards[0]?.id||"",type:"select",options:selectOptions(state.cards,c=>`${c.id} — ${cardName(c.id)}`)},
    {name:"feeType",label:"Loại phí",value:target.feeType||"annual_fee",type:"select",options:sortOptionsByVietnameseLabel([{value:"annual_fee",label:"Phí thường niên"},{value:"management_fee",label:"Phí quản lý"},{value:"maintenance_fee",label:"Phí duy trì"},{value:"other",label:"Khác"}])},
    {name:"feeAmount",label:"Mức phí",value:target.feeAmount??0,type:"text",kind:"money"},
    {name:"conditionType",label:"Kiểu điều kiện",value:"spend_target",type:"select",options:[{value:"spend_target",label:"Chi tiêu đạt chỉ tiêu"}]},
    {name:"targetAmount",label:"Chỉ tiêu cần đạt",value:target.targetAmount??0,type:"text",kind:"money"},
    {name:"periodStart",label:"Ngày bắt đầu chu kỳ",value:target.periodStart||todayStorageDate(),type:"date"},
    {name:"periodEnd",label:"Ngày kết thúc chu kỳ",value:target.periodEnd||todayStorageDate(),type:"date"},
    {name:"mccSelection",label:"Nhóm MCC áp dụng",value:normalized.allMcc?[ALL_MCC_VALUE]:normalized.mccCategoryIds,type:"multiselect",options:[{value:ALL_MCC_VALUE,label:"Tất cả"},...selectOptions(state.mccCategories,c=>`${c.name} (${c.mcc})`)],hint:"Chọn Tất cả hoặc một/nhiều nhóm MCC."},
    {name:"channel",label:"Hình thức giao dịch",value:target.channel||"all",type:"select",options:[{value:"all",label:"Tất cả"},...TRANSACTION_METHOD_OPTIONS]},
    {name:"reminderEnabled",label:"Bật nhắc nhở",value:target.reminderEnabled!==false,type:"checkbox"},
    {name:"notes",label:"Ghi chú",value:target.notes||"",type:"textarea"}
  ];
}
function normalizeFeeTargetValues(values,existing={}){
  if(!values.cardId || !state.cards.some(card=>card.id===values.cardId)) return {error:"Vui lòng chọn thẻ."};
  if(!values.feeType) return {error:"Vui lòng chọn loại phí."};
  const feeAmount=normalizeMoney(values.feeAmount,{emptyValue:0});
  const targetAmount=normalizeMoney(values.targetAmount,{emptyValue:0});
  if(feeAmount<0) return {error:"Mức phí phải lớn hơn hoặc bằng 0."};
  if(targetAmount<=0) return {error:"Chỉ tiêu cần đạt phải lớn hơn 0."};
  const periodStart=toStorageDate(values.periodStart),periodEnd=toStorageDate(values.periodEnd);
  if(!isValidDate(periodStart)) return {error:"Ngày bắt đầu chu kỳ không hợp lệ."};
  if(!isValidDate(periodEnd)) return {error:"Ngày kết thúc chu kỳ không hợp lệ."};
  if(periodEnd<periodStart) return {error:"Ngày kết thúc chu kỳ phải từ ngày bắt đầu trở đi."};
  if(!values.channel) return {error:"Vui lòng chọn hình thức giao dịch."};
  const selection=Array.isArray(values.mccSelection)?values.mccSelection:[];
  const allMcc=selection.includes(ALL_MCC_VALUE);
  const mccCategoryIds=allMcc?[]:selection.filter(id=>state.mccCategories.some(item=>item.id===id));
  if(!allMcc && !mccCategoryIds.length) return {error:"Vui lòng chọn Tất cả hoặc ít nhất một nhóm MCC."};
  const id=existing.id||buildFeeTargetId(values.cardId,values.feeType,periodStart,(state.feeTargets||[]).map(item=>item.id));
  const target={...existing,...values,id,feeAmount,targetAmount,periodStart,periodEnd,allMcc,mccCategoryIds,conditionType:"spend_target",reminderEnabled:values.reminderEnabled===true,notes:String(values.notes||"")};
  delete target.mccSelection;
  return {target};
}
function renderFeeTargets(){
  const metrics=feeTargetMetrics();
  const filteredByStatus=feeStatusFilter==="all"?metrics:metrics.filter(item=>item.status===feeStatusFilter);
  const rows=filteredRows("feeTargets",filteredByStatus,item=>`${item.cardId} ${feeTypeLabel(item.feeType)} ${feeStatusLabel(item.status)} ${item.notes||""}`);
  document.querySelector("#view-fee-targets").innerHTML=`<div class="card"><div class="section-title"><h2>Tiến độ hoàn phí thường niên</h2><small>${rows.length} mục tiêu</small></div><div class="fee-filter"><select id="feeStatusFilter"><option value="all">Tất cả</option><option value="tracking">Đang theo dõi</option><option value="near">Sắp đạt</option><option value="achieved">Đã đạt</option><option value="expired">Hết hạn</option></select></div>${toolbar("feeTargets")}<div class="table-wrap"><table class="mobile-card-table fee-target-table" data-entity="feeTargets"><thead><tr><th>Card ID</th><th>Loại phí</th><th>Mức phí</th><th>Chỉ tiêu</th><th>Đã chi hợp lệ</th><th>Còn thiếu</th><th>Chu kỳ</th><th>Còn lại</th><th>Tiến độ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows.map(item=>`<tr data-id="${esc(item.id)}" class="${state.cards.find(card=>card.id===item.cardId)?.cardType==="debit"?"debit-row ":""}${selectedRows.feeTargets===item.id?"selected":""}"><td>${esc(item.cardId)}</td><td>${esc(feeTypeLabel(item.feeType))}</td><td class="num">${formatMoneyDisplay(item.feeAmount)}</td><td class="num">${formatMoneyDisplay(item.targetAmount)}</td><td class="num">${formatMoneyDisplay(item.eligibleSpend)}</td><td class="num">${formatMoneyDisplay(item.remainingAmount)}</td><td>${esc(`${formatDateDisplay(item.periodStart)} → ${formatDateDisplay(item.periodEnd)}`)}</td><td>${esc(feeDaysLabel(item))}</td><td><div class="fee-progress"><div class="progress ${item.status==="achieved"?"progress-done":item.warning==="red"||item.warning==="orange"?"progress-warn":""}"><i style="width:${item.progressPercent}%"></i></div><span>${formatFeeProgress(item.progressPercent)}</span></div></td><td><span class="badge fee-${item.warning}">${esc(feeStatusLabel(item.status))}</span></td><td><button class="secondary-btn" data-fee-edit="${esc(item.id)}">Sửa</button> <button class="delete-btn" data-fee-delete="${esc(item.id)}">Xóa</button></td></tr>`).join("")}</tbody></table></div></div>`;
  const handlers={
    add:async()=>{ if(!state.cards.length) return toast("Vui lòng thêm Thẻ trước."); const values=await openForm("Thêm mục tiêu hoàn phí thường niên",feeTargetFields(),{},wireProgramMccForm); if(!values) return; const result=normalizeFeeTargetValues(values); if(result.error) return toast(result.error); state.feeTargets.push(result.target); selectedRows.feeTargets=result.target.id; saveState("Đã thêm mục tiêu hoàn phí"); },
    edit:async id=>{ const index=state.feeTargets.findIndex(item=>item.id===id); const existing=state.feeTargets[index]; if(!existing) return; const normalized=normalizeProgramMcc(existing,state.mccCategories); const values=await openForm("Chỉnh sửa mục tiêu hoàn phí thường niên",feeTargetFields(existing),{...existing,mccSelection:normalized.allMcc?[ALL_MCC_VALUE]:normalized.mccCategoryIds},wireProgramMccForm); if(!values) return; const result=normalizeFeeTargetValues(values,existing); if(result.error) return toast(result.error); state.feeTargets[index]=result.target; selectedRows.feeTargets=id; saveState("Đã cập nhật mục tiêu hoàn phí"); },
    remove:id=>{ if(!confirm("Xóa mục tiêu hoàn phí đã chọn?")) return; state.feeTargets=state.feeTargets.filter(item=>item.id!==id); clearRowSelection("feeTargets"); saveState("Đã xóa mục tiêu hoàn phí"); },
    bulkRemove:ids=>{const selected=new Set(ids);state.feeTargets=state.feeTargets.filter(target=>!selected.has(target.id));clearRowSelection("feeTargets");saveState(`Đã xóa ${ids.length} mục tiêu hoàn phí`);}
  };
  wireToolbar("feeTargets",handlers);
  const filter=document.querySelector("#feeStatusFilter"); if(filter){ filter.value=feeStatusFilter; filter.addEventListener("change",()=>{feeStatusFilter=filter.value;renderFeeTargets();labelResponsiveTables();enhanceResponsiveRecordLists();}); }
  document.querySelectorAll("[data-fee-edit]").forEach(button=>button.addEventListener("click",event=>{event.stopPropagation();handlers.edit(button.dataset.feeEdit);}));
  document.querySelectorAll("[data-fee-delete]").forEach(button=>button.addEventListener("click",event=>{event.stopPropagation();handlers.remove(button.dataset.feeDelete);}));
}
function labelResponsiveTables(){
  document.querySelectorAll("table.mobile-card-table,table[data-entity],table[data-accordion-entity]").forEach(table=>{
    const labels=[...table.querySelectorAll("thead th")].map(th=>th.textContent.trim());
    table.querySelectorAll("tbody tr").forEach(row=>{
      [...row.children].forEach((cell,index)=>cell.dataset.label=labels[index] || "");
    });
  });
}
function setSidebarOpen(open){
  const shell=document.querySelector(".app-shell");
  const toggle=document.querySelector(".menu-toggle");
  shell?.classList.toggle("sidebar-open",open);
  toggle?.setAttribute("aria-expanded",String(open));
}
function setSidebarExpanded(expanded){
  document.querySelector('.app-shell')?.classList.toggle('sidebar-expanded',expanded);
  const toggle=document.querySelector('.sidebar-toggle');
  toggle?.setAttribute('aria-expanded',String(expanded));
  toggle?.setAttribute('aria-label',expanded?'Thu gọn thanh điều hướng':'Mở rộng thanh điều hướng');
  localStorage.setItem(SIDEBAR_STORAGE_KEY,String(expanded));
}
function setView(name){
  closeTableContextMenu();
  currentView=name;
  if(name==="programs") ensureCashbackProgramsForSelectedPeriod();
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
  const meta = VIEW_META[name] || {title:name, description:""};
  document.querySelector(".topbar h1").textContent = meta.title;
  document.querySelector("#subtitle").textContent = meta.description;
  const helpButton=document.querySelector('.context-help');
  if(helpButton) helpButton.hidden=name==='about';
  document.querySelector('.period-filter')?.classList.toggle('page-context-hidden',name==='about'||MASTER_DATA_VIEWS.has(name));
  document.querySelector('.drive-panel')?.classList.toggle('page-context-hidden',name==='about');
  setSidebarOpen(false);
}

function renderSyncStatus(){
  const meta=localRepository.loadMeta();
  const labels={synced:"Đã đồng bộ",syncing:"Đang đồng bộ...",dirty:"Chưa đồng bộ",conflict:"Có xung đột",disconnected:"Chưa kết nối Google Drive"};
  document.querySelector("#driveStatusText").textContent=labels[meta.status] || (meta.dirty ? labels.dirty : labels.disconnected);
  document.querySelector("#driveStatusText").className=`drive-state ${meta.status||"disconnected"}`;
  document.querySelector("#lastSyncTime").textContent=meta.lastSyncAt ? `Lần cuối: ${formatDateTimeDisplay(meta.lastSyncAt)}` : "Chưa có lần đồng bộ thành công";
  const connected = isConnected() && auth.hasToken();
  document.querySelector("#connectDrive").disabled=!auth.isReady() || connected;
  document.querySelector("#connectDrive").textContent=connected ? "Đã kết nối" : "Kết nối Google Drive";
}

function renderLoginGate(){
  const gate = document.querySelector("#loginGate");
  const shell = document.querySelector(".app-shell");
  if(!gate || !shell) return;
  const connected = isConnected();
  gate.classList.toggle("show", !connected);
  shell.classList.toggle("locked", !connected);
  const button = document.querySelector("#gateConnectDrive");
  const status = document.querySelector("#gateStatus");
  if(button){
    button.style.display = "";
    button.disabled = isManualConnecting() || !auth.isReady();
    button.textContent = isManualConnecting() ? "Đang kết nối..." : "Kết nối Google Drive";
  }
  if(status){
    status.textContent = authMessage || "";
    status.classList.toggle("ok", connected);
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
  y.addEventListener("change",()=>{selectedYear=Number(y.value);clearAllRowSelections();expandedAccordionRows.clear();renderAll();setView(currentView);});
  m.addEventListener("change",()=>{selectedMonth=Number(m.value);clearAllRowSelections();expandedAccordionRows.clear();renderAll();setView(currentView);});
}

function excelDateValue(value){
  const storage = toStorageDate(value);
  if(!storage) return "";
  const [year, month, day] = storage.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function worksheetFromRows(rows, dateHeaders=[]){
  const sheet = XLSX.utils.json_to_sheet(rows, {cellDates:true});
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const headers = [];
  for(let col = range.s.c; col <= range.e.c; col += 1){
    headers[col] = sheet[XLSX.utils.encode_cell({r:0,c:col})]?.v;
  }
  for(let row = 1; row <= range.e.r; row += 1){
    for(let col = range.s.c; col <= range.e.c; col += 1){
      if(!dateHeaders.includes(headers[col])) continue;
      const cell = sheet[XLSX.utils.encode_cell({r:row,c:col})];
      if(cell?.t === "d") cell.z = "dd-mm-yyyy";
    }
  }
  return sheet;
}

function exportTransactionsRows(rows){
  return rows.map(t=>({
    "ID": t.id,
    "Ngày": excelDateValue(t.date),
    "Host": hostName(t.host),
    "Loại đơn": t.category,
    "MCC": t.mcc,
    "Hình thức giao dịch": transactionMethodLabel(t.channel),
    "Thẻ": cardName(t.cardId),
    "Tiền đơn": t.amount,
    "Trạng thái": transactionStatusLabel(normalizeTransactionStatus(t.status)),
    "Ngày Back": excelDateValue(t.backDate),
    "Tiền Back": t.backAmount,
    "Ghi chú": t.note || ""
  }));
}

function exportPaymentsRows(rows){
  return rows.map(p=>({
    "ID": p.id,
    "Ngày": excelDateValue(p.date),
    "Thẻ": cardName(p.cardId),
    "Kỳ thanh toán": p.paymentCycle || "",
    "Trạng thái kỳ": p.paymentStatus === "paid" ? "Đã thanh toán" : "Chưa thanh toán",
    "Số tiền": p.amount,
    "Ghi chú": p.note || ""
  }));
}

function exportCashbackReceiptRows(rows){
  return rows.map(r=>({
    "ID": r.id,
    "Ngày": excelDateValue(r.date),
    "Ngân hàng": bankName(r.bankId),
    "Thẻ": cardName(r.cardId),
    "Tiền Cashback": r.amount,
    "Ghi chú": r.notes || ""
  }));
}

document.querySelectorAll(".nav-btn").forEach(b=>{b.insertAdjacentHTML('afterbegin',icon(b.dataset.icon));b.title=b.querySelector('.nav-label')?.textContent||'';b.addEventListener("click",()=>setView(b.dataset.view));});
document.querySelector('.menu-toggle')?.insertAdjacentHTML('afterbegin',icon('menu'));
document.querySelector('.sidebar-toggle')?.insertAdjacentHTML('afterbegin',icon('menu'));
document.querySelector('.sidebar-close')?.insertAdjacentHTML('afterbegin',icon('x'));
document.querySelector('.context-help')?.insertAdjacentHTML('afterbegin',icon('circle-help'));
document.querySelector(".menu-toggle")?.addEventListener("click",()=>setSidebarOpen(!document.querySelector(".app-shell")?.classList.contains("sidebar-open")));
document.querySelector('.sidebar-toggle')?.addEventListener('click',()=>setSidebarExpanded(!document.querySelector('.app-shell')?.classList.contains('sidebar-expanded')));
document.querySelector('.context-help')?.addEventListener('click',()=>openContextHelp());
document.querySelector('[data-close-payment-warning]')?.addEventListener('click',()=>hidePaymentWarning());
document.querySelector(".sidebar-close")?.addEventListener("click",()=>setSidebarOpen(false));
document.querySelector(".sidebar-backdrop")?.addEventListener("click",()=>setSidebarOpen(false));
document.addEventListener("click",event=>{const toggle=event.target.closest("[data-accordion-toggle]");if(toggle)toggleResponsiveAccordion(toggle);});
document.addEventListener("pointerdown",event=>{if(activeTableContext&&!event.target.closest("#tableContextMenu"))closeTableContextMenu();});
document.addEventListener("scroll",()=>closeTableContextMenu(),true);
document.addEventListener("keydown",event=>{ if(event.key==="Escape"){setSidebarOpen(false);closeTableContextMenu();} });
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="visible" || !paymentWarningReady() || paymentWarningDialogOpen()) return;
  if(!nextPaymentWarningCheckAt || Date.now()>=nextPaymentWarningCheckAt) evaluatePaymentWarnings();
});
window.addEventListener("pagehide",()=>{
  if(paymentWarningTimer) clearTimeout(paymentWarningTimer);
  paymentWarningTimer=null;
});
window.addEventListener("pageshow",()=>{
  if(!paymentWarningReady() || paymentWarningDialogOpen()) return;
  const remaining=nextPaymentWarningCheckAt-Date.now();
  if(remaining<=0) evaluatePaymentWarnings();
  else schedulePaymentWarningCheck(remaining);
});

function watchGoogleSdkReadiness(){
  if(auth.isReady()) return;
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    renderLoginGate();
    renderSyncStatus();
    if(auth.isReady() || attempts >= 100) clearInterval(timer);
  }, 100);
}

function withTimeout(promise, timeoutMs, errorMessage, onTimeout){
  let timer = null;
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error(errorMessage));
    }, timeoutMs);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

async function initializeDriveForAttempt(attemptId, timeoutMs = 5000, registerAbort = null){
  const controller = new AbortController();
  registerAbort?.(() => controller.abort());
  await withTimeout(
    syncService.syncNow({silent:false, signal:controller.signal}),
    timeoutMs,
    "drive-init-timeout",
    () => controller.abort()
  );
  if(attemptId !== authAttemptId) throw new Error("stale-auth-attempt");
}

async function connectGoogleDriveFromUi(){
  if(isManualConnecting()) return;
  if(!auth.isReady()){
    const message = "Không tải được dịch vụ đăng nhập Google. Vui lòng tải lại trang.";
    logGoogleAuthDiagnostic({message:"gis-not-loaded", code:"gis-not-loaded"}, "sdk_readiness");
    setAuthState(AUTH_STATE.ERROR, message);
    toast(message);
    return;
  }
  const attemptId = ++authAttemptId;
  setAuthState(AUTH_STATE.MANUAL_CONNECTING, "Đang kết nối Google Drive...");
  try{
    await auth.connect();
    if(attemptId !== authAttemptId) return;
    state = localRepository.load();
    localRepository.saveMeta({...localRepository.loadMeta(), status:"syncing"});
    await initializeDriveForAttempt(attemptId, 5000);
    if(attemptId !== authAttemptId) return;
    setAuthState(AUTH_STATE.CONNECTED, "");
    renderAll();
    setView("dashboard");
    startPaymentWarningReminder();
    toast("Đã kết nối Google Drive");
  }catch(e){
    if(attemptId !== authAttemptId) return;
    const message = e.message==="missing-client-id" ? "Chưa cấu hình Google OAuth Client ID." : connectionMessageForError(e);
    logGoogleAuthDiagnostic(e, /^drive-|drive-init-timeout/.test(e?.message || "") || e?.name === "AbortError" || e?.name === "TypeError" ? "drive_initialization" : "oauth");
    auth.cancelPendingRequest();
    setAuthState(AUTH_STATE.ERROR, message);
    toast(message);
  }
}

document.querySelector("#gateConnectDrive").addEventListener("click",()=>connectGoogleDriveFromUi());
document.querySelector("#connectDrive").addEventListener("click",()=>connectGoogleDriveFromUi());
document.querySelector("#syncNow").addEventListener("click",async()=>{ try{ await syncService.syncNow(); toast("Đã đồng bộ"); }catch(e){ toast(e.message==="offline" ? "Đang offline, dữ liệu đã lưu máy này." : "Đồng bộ thất bại"); } });
document.querySelector("#disconnectDrive").addEventListener("click",()=>{ authAttemptId += 1; stopPaymentWarningReminder(); syncService.disconnect(); setAuthState(AUTH_STATE.DISCONNECTED, ""); renderAll(); toast("Đã ngắt kết nối Google Drive"); });
document.querySelector("#setupBack").addEventListener("click",()=>{ setupStep=Math.max(0, setupStep-1); renderSetupWizard(); });
document.querySelector("#setupNext").addEventListener("click",()=>goSetupNext(false));
document.querySelector("#setupSkipHost").addEventListener("click",()=>goSetupNext(true));
syncService.addEventListener("status", e=>{ renderSyncStatus(); if(e.detail.status==="conflict") showConflict(e.detail.driveData); });

document.querySelector("#exportExcel").addEventListener("click",()=>{
  if(typeof XLSX==="undefined"){toast("Không tải được thư viện Excel. Kiểm tra Internet.");return;}
  const wb=XLSX.utils.book_new(), txs=state.transactions, pm=programMetrics(periodTx());
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["CARD FLOW - TỔNG HỢP"],["Năm",selectedYear,"Tháng",selectedMonth],["Tổng tiền đơn",sum(periodTx(),t=>t.amount)],["Host đã Back",sum(periodTx(),t=>t.backAmount)],["Cashback theo rule",sum(pm,x=>x.countedCashback)],["Cashback thực nhận",sum(periodCashbackReceipts(),x=>x.amount)]]),"Tổng hợp");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.banks),"Banks");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.cards),"Cards");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.cashbackPrograms),"Programs");
  XLSX.utils.book_append_sheet(wb,worksheetFromRows(exportCashbackReceiptRows(state.cashbackReceipts), ["Ngày"]),"CashbackReceipts");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.feeTargets||[]),"FeeTargets");
  XLSX.utils.book_append_sheet(wb,worksheetFromRows(exportTransactionsRows(txs), ["Ngày","Ngày Back"]),"Transactions");
  XLSX.utils.book_append_sheet(wb,worksheetFromRows(exportPaymentsRows(state.payments), ["Ngày"]),"Payments");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.hosts),"Hosts");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.mccCategories),"MCC");
  XLSX.writeFile(wb,`CardFlow_${selectedYear}-${String(selectedMonth).padStart(2,"0")}.xlsx`);
});

state = localRepository.load();
setSidebarExpanded(localStorage.getItem(SIDEBAR_STORAGE_KEY)==='true');
initPeriod();
renderAll();
setView("dashboard");
watchGoogleSdkReadiness();
