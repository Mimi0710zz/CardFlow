import { LocalRepository } from "./services/local-repository.js?v=20260913-payment-statement-v1";
import { DriveAuth } from "./services/drive-auth.js";
import { DriveRepository } from "./services/drive-repository.js";
import { SyncService } from "./services/sync-service.js?v=20260909-order-types-v1";
import { cloneSeed } from "./services/default-data.js?v=20260905-cashback-drive-fix";
import { formatMoneyDisplay, formatMoneyInput, normalizeMoney, parseMoney } from "./services/money.js";
import { formatDateDisplay, formatDateTimeDisplay, isValidDate, toStorageDate } from "./services/date.js";
import { summarizeCardStatusRows, summarizeCardsTableRows } from "./services/card-status-summary.js";
import { ALL_MCC_VALUE, ALL_ORDER_TYPE_VALUE, applySharedCashbackDisplay, buildCashbackProgramId, calculateProgramCashback, calculateRuleProgress, calculateSpendToMax, formatCashbackRate, isCashbackCombinationSatisfied, isCashbackUnlimited, isLegacyVpDebitFakeUnlimited, isMccEligible, normalizeCashbackConditions, normalizeCombineOperator, normalizeProgramMcc, normalizeTransactionMethod, uniqueCashbackProgramId } from "./services/cashback.js?v=20260911-cashback-program-id-v1";
import { buildFeeTargetId, calculateFeeTargetMetrics, feeTargetReminder, sortFeeReminderMetrics, sortFeeTargetMetrics } from "./services/fee-target.js?v=20260909-card-fees-v1";
import { TRANSACTION_STATUS, TRANSACTION_STATUS_OPTIONS, isHostFeeApplicable, normalizeTransactionStatus, transactionStatusLabel, transactionStatusOptionsForEditing } from "./services/transaction-status.js?v=20260906-order-types-transaction-v1";
import { matchesTransactionFilters } from "./services/transaction-filter.js?v=20260906-order-types-transaction-v1";
import { CARD_FEE_ORDER_TYPE, isCardFeeOrderType, isCardFeeTransaction, normalizeOrderTypeColor, orderTypeDefaultColor } from "./services/order-type.js";
import { calculateDashboardHostBackMetrics } from "./services/dashboard-host-back.js";
import { financialTransactions } from "./services/financial-totals.js?v=20260909-bug-lazada-financial-exclusion-v1";
import { cashbackTransactions } from "./services/cashback-transactions.js?v=20260913-bug-lazada-cashback-scope-v1";
import { buildCardPaymentObligations, calculatePaymentDueWarnings, calculateStatementDateAdvisories, effectivePaymentDueDateForCycle, isValidPaymentCycle, paymentCycleFromDate, paymentDueWarningText, statementDateAdvisoryText } from "./services/payment-due.js?v=20260909-bug-lazada-financial-exclusion-v1";
import { buildStatementPaymentRows, formatDayMonth, normalizeStatementPayment, statementPaymentRecordId, summarizeStatementPaymentRows } from "./services/payment-statement.js?v=20260913-payment-status-v1";
import { carryForwardCashbackPrograms, cashbackProgramsForPeriod, getCashbackPeriodForCard, getCashbackReferenceDate, isDateInCashbackPeriod } from "./services/cashback-period.js?v=20260912-statement-cycle-v1";
import { INSURANCE_LINKS } from "./services/insurance-links.js";
import { attachResizableTables, syncStickyColumns } from "./services/table-resize.js?v=20260911-card-activation-sticky-v1";
import { sortedUniqueFilterOptions } from "./services/filter-options.js?v=20260912-card-filter-sort-v1";
import { activationDateForFeeTarget, actualFeeAmountForTarget, consecutiveGroupSpan, feeAmountForTarget, feeTargetMatchesFilters, feeTargetWithCardSources, summarizeFeeTargets } from "./services/fee-target-model.js?v=20260912-fee-actual-v1";
import { mountTrackingMatrix } from "./services/tracking-matrix-ui.js?v=20260913-bug-lazada-cashback-scope-v1";

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
const feeTargetFilters={bankId:"",cardId:"",feeType:""};
let feeTargetFilterOpen=false;
const paymentFilters={bankId:"",cardId:"",status:""};
let paymentFilterOpen=false;
let paymentStatementYear=selectedYear;
let paymentStatementMonth=selectedMonth;
let filterPanelOutsideHandler = null;
const PAYMENT_WARNING_INTERVAL_MS = 30 * 60 * 1000;
let paymentWarningTimer = null;
let nextPaymentWarningCheckAt = 0;

const VIEW_META = {
  dashboard: {title:"Tổng hợp", description:"Tổng quan dòng tiền, dư nợ và cashback."},
  transactions: {title:"Giao dịch", description:"Quản lý giao dịch và theo dõi trạng thái hoàn tiền."},
  tracking: {title:"Theo dõi đơn", description:"Ma trận theo dõi và điều phối đơn theo Card ID, chương trình cashback và Host."},
  cards: {title:"Thẻ", description:"Quản lý thẻ Credit/Debit, thông tin và hạn mức liên quan."},
  programs: {title:"Chương trình cashback", description:"Thiết lập và theo dõi các chương trình, tỷ lệ và điều kiện hoàn tiền.", showPeriodFilter:false},
  "cashback-receipts": {title:"Cashback thực nhận", description:"Ghi nhận các đợt tiền cashback thực tế đã nhận từ ngân hàng."},
  "fee-targets": {title:"Phí thẻ", description:"Quản lý phí thường niên, phí quản lý và chỉ tiêu hoàn phí theo từng Card ID.", showPeriodFilter:false},
  payments: {title:"Thanh toán thẻ", description:"Quản lý các khoản thanh toán và dư nợ thẻ.", showPeriodFilter:false},
  hosts: {title:"Hosts", description:"Quản lý danh sách Host sử dụng trong giao dịch."},
  mcc: {title:"Bảng MCC", description:"Quản lý danh mục MCC phục vụ phân loại giao dịch."},
  "order-types": {title:"Loại đơn", description:"Quản lý danh mục loại đơn dùng khi tạo giao dịch."},
  "insurance-links": {title:"Link Bảo Hiểm", description:"Danh sách link thanh toán phí bảo hiểm.", showPeriodFilter:false},
  banks: {title:"Mã ngân hàng", description:"Quản lý ngân hàng và mã viết tắt hiển thị trong ứng dụng."},
  about: {title:"Thông tin & Hướng dẫn", description:"Trung tâm trợ giúp, đồng bộ dữ liệu và thông tin phiên bản."}
};

const SIDEBAR_STORAGE_KEY="cardflow-sidebar-expanded";
const MASTER_DATA_VIEWS=new Set(["cards","banks","mcc","order-types"]);
const HELP_TOPIC_BY_VIEW={dashboard:"dashboard",cards:"cards",programs:"cashback",transactions:"transactions",tracking:"transactions","cashback-receipts":"cashback-receipts","fee-targets":"annual-fee",payments:"payments",hosts:"getting-started",mcc:"getting-started",banks:"getting-started"};
let activeHelpTab="intro", activeHelpTopic="getting-started", helpSearchTerm="";
const ICON_PATHS={menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',x:'<path d="m18 6-12 12M6 6l12 12"/>','layout-dashboard':'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>','credit-card':'<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>','badge-percent':'<circle cx="9" cy="9" r="2"/><circle cx="15" cy="15" r="2"/><path d="m16 8-8 8M12 2l3 2 3-.5.5 3 2 2-2 2 .5 3-3-.5-3 2-3-2-3 .5.5-3-2-2 2-2-.5-3 3 .5Z"/>','receipt-text':'<path d="M4 2v20l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2V2l-2 2-2-2-2 2-2-2-2 2-2-2-2 2Z"/><path d="M16 8h-6M16 12h-6M13 16h-3"/>','circle-dollar':'<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 18V6"/>',chart:'<path d="M3 3v18h18M7 16v-4M12 16V8M17 16V5"/>','wallet-cards':'<path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10H5a3 3 0 0 1-3-3V7"/><path d="M16 15h2"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>','table-properties':'<path d="M15 3v18M3 9h18M3 15h18"/><rect width="18" height="18" x="3" y="3" rx="2"/>',landmark:'<path d="m3 10 9-7 9 7M5 10v8M9 10v8M15 10v8M19 10v8M3 22h18"/>','circle-help':'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.83 1c0 2-3 2-3 4M12 18h.01"/>'};
Object.assign(ICON_PATHS,{plus:'<path d="M12 5v14M5 12h14"/>',pencil:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',filter:'<path d="M4 5h16l-6 7v5l-4 2v-7Z"/>','chevron-down':'<path d="m6 9 6 6 6-6"/>',external:'<path d="M14 3h7v7M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>','triangle-alert':'<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>'});
function icon(name){return `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]||ICON_PATHS['circle-help']}</svg>`;}
const WORD_THEME_COLORS=[
  ["#ffffff","#f2f2f2","#d9d9d9","#bfbfbf","#a6a6a6","#7f7f7f"],
  ["#000000","#808080","#595959","#404040","#262626","#0d0d0d"],
  ["#e7e6e6","#d0cece","#aeaaaa","#757171","#3a3838","#171616"],
  ["#44546a","#d9e2f3","#b4c6e7","#8eaadb","#2f5597","#203864"],
  ["#5b9bd5","#ddebf7","#bdd7ee","#9dc3e6","#2e75b6","#1f4e78"],
  ["#ed7d31","#fce4d6","#f8cbad","#f4b183","#c65911","#833c0c"],
  ["#70ad47","#e2f0d9","#c6e0b4","#a9d18e","#548235","#375623"],
  ["#00b0f0","#d6e4f0","#b4d5e7","#84c4df","#0070c0","#005a8d"],
  ["#a64d79","#eadcf8","#d5c0e8","#b995d6","#7030a0","#4c216d"],
  ["#70ad47","#e2f0d9","#c6e0b4","#a9d18e","#548235","#375623"]
];
const WORD_STANDARD_COLORS=["#c00000","#ff0000","#ffc000","#ffff00","#92d050","#00b050","#00b0f0","#0070c0","#002060","#7030a0"];
const WORD_MORE_COLORS=[
  "#ff0000","#ff3300","#ff6600","#ff9900","#ffcc00","#ffff00","#ccff00","#99ff00","#66ff00","#33ff00","#00ff00","#00ff33",
  "#00ff66","#00ff99","#00ffcc","#00ffff","#00ccff","#0099ff","#0066ff","#0033ff","#0000ff","#3300ff","#6600ff","#9900ff",
  "#cc00ff","#ff00ff","#ff00cc","#ff0099","#ff0066","#ff0033","#f4cccc","#fce5cd","#fff2cc","#d9ead3","#d0e0e3","#c9daf8",
  "#d9d2e9","#ead1dc","#cc0000","#e69138","#f1c232","#6aa84f","#45818e","#3c78d8","#674ea7","#a64d79"
];
const WORD_GRAY_COLORS=["#ffffff","#e7e6e6","#d0cece","#a6a6a6","#7f7f7f","#595959","#404040","#262626","#000000"];
function wordColorButton(color,extraClass=""){
  return `<button type="button" class="word-color-swatch ${extraClass}" data-word-color="${color}" style="--choice-color:${color}" aria-label="${color}" title="${color}"></button>`;
}
function colorPickerMarkup(name,label,value){
  const current=normalizeOrderTypeColor(value)||"#64748b";
  const themeColumns=WORD_THEME_COLORS.map(column=>`<div class="word-theme-column">${column.map(color=>wordColorButton(color)).join("")}</div>`).join("");
  return `<div class="field full word-color-field" data-word-color-picker>
    <label>${esc(label)}</label>
    <input type="hidden" name="${esc(name)}" value="${esc(current)}" data-word-color-value>
    <button type="button" class="word-color-trigger" data-word-color-trigger><i style="--choice-color:${esc(current)}"></i><span>${esc(current)}</span><span class="word-color-caret">▾</span></button>
    <div class="word-color-popover" data-word-color-popover>
      <button type="button" class="word-automatic" data-word-color="#000000"><i style="--choice-color:#000000"></i><span>Tự động</span></button>
      <div class="word-color-divider"></div>
      <strong>Màu chủ đề</strong>
      <div class="word-theme-grid">${themeColumns}</div>
      <div class="word-color-divider"></div>
      <strong>Màu tiêu chuẩn</strong>
      <div class="word-standard-row">${WORD_STANDARD_COLORS.map(color=>wordColorButton(color)).join("")}</div>
      <div class="word-color-divider"></div>
      <button type="button" class="word-more-colors" data-word-more-colors>🎨 <span>Thêm màu...</span></button>
    </div>
    <div class="word-more-dialog" data-word-more-dialog aria-hidden="true">
      <div class="word-more-card" role="dialog" aria-modal="true" aria-label="Màu sắc">
        <div class="word-more-title"><strong>Màu sắc</strong><button type="button" class="word-more-close" data-word-more-cancel aria-label="Đóng">×</button></div>
        <div class="word-more-content">
          <div class="word-more-left">
            <div class="word-color-tabs" role="tablist">
              <button type="button" class="active" data-word-color-tab="standard">Tiêu chuẩn</button>
              <button type="button" data-word-color-tab="custom">Tùy chỉnh</button>
            </div>
            <div class="word-tab-panel active" data-word-color-panel="standard">
              <span class="word-panel-label">Màu:</span>
              <div class="word-hex-palette">${WORD_MORE_COLORS.map(color=>wordColorButton(color,"hex")).join("")}</div>
              <div class="word-gray-palette">${WORD_GRAY_COLORS.map(color=>wordColorButton(color,"hex gray")).join("")}</div>
            </div>
            <div class="word-tab-panel" data-word-color-panel="custom">
              <span class="word-panel-label">Màu:</span>
              <div class="word-native-color-wrap"><input type="color" value="${esc(current)}" data-word-native-color><span>Nhấp để chọn màu trực quan</span></div>
              <div class="word-color-model-row"><label>Kiểu màu:</label><select disabled><option>RGB</option></select></div>
              <div class="word-rgb-grid">
                <label>Đỏ:<input type="number" min="0" max="255" data-word-rgb="r"></label>
                <label>Lục:<input type="number" min="0" max="255" data-word-rgb="g"></label>
                <label>Lam:<input type="number" min="0" max="255" data-word-rgb="b"></label>
                <label>Hex:<input type="text" maxlength="7" data-word-hex></label>
              </div>
            </div>
          </div>
          <div class="word-more-actions">
            <button type="button" class="primary" data-word-more-ok>OK</button>
            <button type="button" class="secondary-btn" data-word-more-cancel>Hủy</button>
            <div class="word-preview-label">Mới</div><div class="word-preview" data-word-preview="new" style="--choice-color:${esc(current)}"></div>
            <div class="word-preview-label">Hiện tại</div><div class="word-preview" data-word-preview="current" style="--choice-color:${esc(current)}"></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
function hexToRgb(hex){
  const safe=normalizeOrderTypeColor(hex);
  if(!safe)return {r:100,g:116,b:139};
  const value=parseInt(safe.slice(1),16);
  return {r:(value>>16)&255,g:(value>>8)&255,b:value&255};
}
function rgbToHex(r,g,b){
  const clamp=value=>Math.max(0,Math.min(255,Number(value)||0));
  return `#${[clamp(r),clamp(g),clamp(b)].map(value=>Math.round(value).toString(16).padStart(2,"0")).join("")}`;
}
let wordColorOutsideCleanup=()=>{};
function bindSheetsColorPickers(root){
  wordColorOutsideCleanup();
  const cleanups=[];
  root.querySelectorAll("[data-word-color-picker]").forEach(field=>{
    const value=field.querySelector("[data-word-color-value]");
    const trigger=field.querySelector("[data-word-color-trigger]");
    const popover=field.querySelector("[data-word-color-popover]");
    const moreDialog=field.querySelector("[data-word-more-dialog]");
    const native=field.querySelector("[data-word-native-color]");
    const hexInput=field.querySelector("[data-word-hex]");
    const rgbInputs={r:field.querySelector('[data-word-rgb="r"]'),g:field.querySelector('[data-word-rgb="g"]'),b:field.querySelector('[data-word-rgb="b"]')};
    let draft=normalizeOrderTypeColor(value.value)||"#64748b";
    const setPreview=(selector,color)=>field.querySelector(selector)?.style.setProperty("--choice-color",color);
    const syncCustomInputs=color=>{
      const safe=normalizeOrderTypeColor(color)||"#64748b",rgb=hexToRgb(safe);
      draft=safe;
      if(native)native.value=safe;
      if(hexInput)hexInput.value=safe;
      if(rgbInputs.r)rgbInputs.r.value=rgb.r;
      if(rgbInputs.g)rgbInputs.g.value=rgb.g;
      if(rgbInputs.b)rgbInputs.b.value=rgb.b;
      setPreview('[data-word-preview="new"]',safe);
      field.querySelectorAll("[data-word-color]").forEach(button=>button.classList.toggle("selected",button.dataset.wordColor===safe));
    };
    const apply=color=>{
      const safe=normalizeOrderTypeColor(color)||"#64748b";
      value.value=safe;
      trigger.querySelector("i").style.setProperty("--choice-color",safe);
      trigger.querySelector("span:not(.word-color-caret)").textContent=safe;
      setPreview('[data-word-preview="current"]',safe);
      syncCustomInputs(safe);
    };
    const closePopover=()=>popover.classList.remove("open");
    const closeMore=()=>{moreDialog.classList.remove("open");moreDialog.setAttribute("aria-hidden","true");};
    trigger.addEventListener("click",event=>{event.stopPropagation();document.querySelectorAll(".word-color-popover.open").forEach(item=>item!==popover&&item.classList.remove("open"));popover.classList.toggle("open");});
    popover.querySelectorAll("[data-word-color]").forEach(button=>button.addEventListener("click",()=>{apply(button.dataset.wordColor);closePopover();}));
    field.querySelector("[data-word-more-colors]")?.addEventListener("click",()=>{closePopover();draft=value.value;syncCustomInputs(draft);setPreview('[data-word-preview="current"]',value.value);moreDialog.classList.add("open");moreDialog.setAttribute("aria-hidden","false");});
    field.querySelectorAll("[data-word-color-tab]").forEach(button=>button.addEventListener("click",()=>{const tab=button.dataset.wordColorTab;field.querySelectorAll("[data-word-color-tab]").forEach(item=>item.classList.toggle("active",item===button));field.querySelectorAll("[data-word-color-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.wordColorPanel===tab));}));
    field.querySelectorAll(".word-more-dialog [data-word-color]").forEach(button=>button.addEventListener("click",()=>syncCustomInputs(button.dataset.wordColor)));
    native?.addEventListener("input",()=>syncCustomInputs(native.value));
    const syncFromRgb=()=>syncCustomInputs(rgbToHex(rgbInputs.r?.value,rgbInputs.g?.value,rgbInputs.b?.value));
    Object.values(rgbInputs).forEach(input=>input?.addEventListener("input",syncFromRgb));
    hexInput?.addEventListener("input",()=>{const raw=hexInput.value.trim();if(/^#[0-9a-f]{6}$/i.test(raw))syncCustomInputs(raw);});
    field.querySelector("[data-word-more-ok]")?.addEventListener("click",()=>{apply(draft);closeMore();});
    field.querySelectorAll("[data-word-more-cancel]").forEach(button=>button.addEventListener("click",closeMore));
    const outside=event=>{if(popover.classList.contains("open")&&!field.contains(event.target))closePopover();};
    document.addEventListener("pointerdown",outside);
    cleanups.push(()=>document.removeEventListener("pointerdown",outside));
    apply(value.value);
  });
  wordColorOutsideCleanup=()=>{cleanups.splice(0).forEach(cleanup=>cleanup());};
}


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
function cardName(id){ const c=state.cards.find(x=>x.id===id); return c ? `${bankName(c.bankId,c.bank)} ${c.id}` : id; }
function orderTypeByName(name){ return state.orderTypes.find(item=>item.name===name); }
function mccCode(value){ return String(value ?? "").trim(); }
function transactionMccCategory(transaction){ const code=mccCode(transaction?.mcc); return state.mccCategories.find(item=>item.id===transaction?.mccCategoryId || item.name===transaction?.category || mccCode(item.mcc)===code); }
function formatTransactionDate(value){ const date=toStorageDate(value); return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8,10)}/${date.slice(5,7)}` : "Không"; }
function transactionOrderTypeBadge(name){ const item=orderTypeByName(name); const color=normalizeOrderTypeColor(item?.color) || orderTypeDefaultColor(name); return name ? `<span class="order-type-badge" style="--order-type-bg:${esc(color)}">${esc(name)}</span>` : "—"; }
function programs(){ return cashbackProgramsForPeriod(state.cashbackPrograms,selectedYear,selectedMonth); }
function periodTx(){ return state.transactions.filter(inPeriod); }
function cashbackReferenceDate(){ return getCashbackReferenceDate(selectedYear,selectedMonth); }
function periodCashbackReceipts(){ return state.cashbackReceipts.filter(inPeriod); }
function normalizeBankCode(code){ return String(code || "").trim().toUpperCase(); }
function normalizeBankName(name){ return String(name || "").trim(); }
function bankIdFromCode(code){ return `BANK-${normalizeBankCode(code)}`; }
function cardFormLabel(value){
  return value === "physical" ? "Vật lý" : value === "virtual" ? "Phi vật lý" : "Chưa chọn";
}
function cardTypeLabel(value){ return String(value || "").toLowerCase() === "debit" ? "Ghi nợ" : "Tín dụng"; }
function cardDisplayName(card){
  return `${bankName(card.bankId,card.bank)} - ${card.id}`.trim();
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
  if(value === TRANSACTION_STATUS.SENT_BILL || value === TRANSACTION_STATUS.ISSUE) tone = "warning";
  else if(value === TRANSACTION_STATUS.HOST_BACK) tone = "success";
  else if(value === TRANSACTION_STATUS.ANNUAL_FEE || value === TRANSACTION_STATUS.CANCELLED) tone = "danger";
  else if(value === TRANSACTION_STATUS.MANAGEMENT_FEE) tone = "pink";
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
  const spent=sum(financialTransactions(state.transactions).filter(t=>t.cardId===cardId),t=>t.amount);
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
function programMetrics(){
  const cashbackTxs=cashbackTransactions(state.transactions);
  const referenceDate=cashbackReferenceDate();
  const metrics=programs().map(rawProgram=>{
    const program=normalizedProgramForDisplay(rawProgram);
    const combineOperator=normalizeCombineOperator(program.combineOperator);
    const card=state.cards.find(item=>item.id===program.cardId);
    const cashbackPeriod=getCashbackPeriodForCard(card,referenceDate);
    const cardTransactions=cashbackTxs.filter(transaction=>transaction.cardId===program.cardId&&isDateInCashbackPeriod(transaction.date,cashbackPeriod));
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
  return !isCardFeeTransaction(transaction) && isHostFeeApplicable(transaction) ? transactionDifference(transaction) : null;
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
  const txs=financialTransactions(periodTx());
  const totalSpend=sum(txs,t=>t.amount);
  const hostBackMetrics=calculateDashboardHostBackMetrics(txs);
  const hostBack=hostBackMetrics.hostBack;
  const waiting=hostBackMetrics.waiting;
  const orderDelta=sum(txs,transactionHostFeeValue);
  const pm=programMetrics();
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
  const waitingCount=hostBackMetrics.waitingCount;
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
    <div class="card top-space fee-reminder-card"><div class="section-title"><h2>Nhắc nhở phí thẻ</h2><button class="secondary-btn" data-open-fee-targets>Xem tất cả</button></div><div class="reminders">${feeReminders.map(item=>`<button class="reminder fee-reminder fee-${item.warning}" data-open-fee-targets><strong>${esc(item.cardId)}</strong><span>${esc(feeTargetReminder(item,formatMoneyDisplay))}</span></button>`).join("")||'<div class="reminder good">Chưa có chỉ tiêu hoàn phí cần theo dõi.</div>'}</div></div>`;
  document.querySelectorAll("[data-open-fee-targets]").forEach(element=>element.addEventListener("click",()=>setView("fee-targets")));
}
function kpi(label,value,signed=false,tone=""){ return `<div class="card kpi ${tone}"><span>${esc(label)}</span><strong class="${signed?(value<0?"negative":value>0?"positive":"neutral"):""}">${formatMoneyDisplay(value)}</strong></div>`; }

function toolbar(entity, addText = "+ Thêm"){
  return `<div class="crud-toolbar"><input data-search="${entity}" placeholder="Tìm kiếm"><button class="primary" data-add="${entity}">${addText}</button><button class="secondary-btn" data-edit="${entity}">Chỉnh sửa</button><button class="delete-btn" data-remove="${entity}">Xóa</button></div>`;
}
function cardFilterOptions(items,current,label,valueFn=x=>x,labelFn=x=>x,{sortDynamic=false}={}){
  const options=sortDynamic?sortedUniqueFilterOptions(items,valueFn,labelFn):items.map(item=>({value:valueFn(item),label:labelFn(item)}));
  return `<option value="">${esc(label)}: Tất cả</option>${options.map(option=>`<option value="${esc(option.value)}" ${String(option.value)===String(current)?"selected":""}>${esc(option.label)}</option>`).join("")}`;
}
function filterActionBar({apply,clear,cancel}){return `<div class="filter-action-bar"><button type="button" class="primary filter-action--apply" ${apply}>Áp dụng</button><button type="button" class="filter-action--clear" ${clear}>Xóa lọc</button><button type="button" class="secondary-btn filter-action--cancel" ${cancel}>Huỷ</button></div>`;}
function filterPanelConfig(type){
  if(type==="cards") return {panel:"[data-card-filter-panel]",trigger:"[data-card-filter-trigger]",control:"[data-card-filter]",filters:cardFilters,setOpen:value=>{cardFilterOpen=value;}};
  if(type==="feeTargets") return {panel:"[data-fee-target-filter-panel]",trigger:"[data-fee-target-filter-trigger]",control:"[data-fee-target-filter]",filters:feeTargetFilters,setOpen:value=>{feeTargetFilterOpen=value;}};
  if(type==="payments") return {panel:"[data-payment-filter-panel]",trigger:"[data-payment-filter-trigger]",control:"[data-payment-filter]",filters:paymentFilters,setOpen:value=>{paymentFilterOpen=value;}};
  return {panel:"[data-transaction-filter-panel]",trigger:"[data-transaction-filter-trigger]",control:"[data-transaction-filter]",filters:transactionFilters,setOpen:value=>{transactionFilterOpen=value;}};
}
function activeFilterCount(filterState){return Object.values(filterState).filter(Boolean).length;}
function removeFilterPanelOutsideListener(){if(filterPanelOutsideHandler){document.removeEventListener("pointerdown",filterPanelOutsideHandler,true);filterPanelOutsideHandler=null;}}
function syncFilterPanelFromApplied(type,panel=document.querySelector(filterPanelConfig(type).panel)){const config=filterPanelConfig(type);if(!panel)return;panel.querySelectorAll(config.control).forEach(control=>{control.value=config.filters[control.dataset.cardFilter||control.dataset.transactionFilter||control.dataset.feeTargetFilter||control.dataset.paymentFilter]||"";});}
function closeFilterPanelWithoutApply(type){const config=filterPanelConfig(type),panel=document.querySelector(config.panel),trigger=document.querySelector(config.trigger);syncFilterPanelFromApplied(type,panel);if(panel)panel.hidden=true;config.setOpen(false);trigger?.classList.toggle("active",activeFilterCount(config.filters)>0);removeFilterPanelOutsideListener();}
function closeAllFilterPanelsWithoutApply(){closeFilterPanelWithoutApply("cards");closeFilterPanelWithoutApply("transactions");closeFilterPanelWithoutApply("feeTargets");closeFilterPanelWithoutApply("payments");}
function registerFilterPanelOutsideClose(type,panel,trigger){removeFilterPanelOutsideListener();filterPanelOutsideHandler=event=>{const path=event.composedPath?.()||[];if(path.includes(panel)||path.includes(trigger)||panel.contains(event.target)||trigger.contains(event.target))return;closeFilterPanelWithoutApply(type);};setTimeout(()=>document.addEventListener("pointerdown",filterPanelOutsideHandler,true),0);}
function cardToolbar(){
  const activeCount=Object.values(cardFilters).filter(Boolean).length;
  const networks=[...new Set(state.cards.map(card=>card.network).filter(Boolean))].sort(compareVietnameseText);
  return `<div class="crud-toolbar cards-toolbar"><input data-search="cards" placeholder="Tìm Card ID, ngân hàng, phôi..."><button type="button" class="secondary-btn card-filter-trigger ${activeCount?"active":""}" data-card-filter-trigger>${icon("filter")}<span>Bộ lọc</span>${activeCount?`<b>${activeCount}</b>`:""}</button><button type="button" class="secondary-btn refund-guide-trigger" data-refund-guide-trigger>${icon("circle-help")}<span>Hướng dẫn hình thức hoàn</span></button><button class="primary" data-add="cards">+ Thêm</button><button class="secondary-btn" data-edit="cards">Chỉnh sửa</button><button class="delete-btn" data-remove="cards">Xóa</button></div><div class="card-filter-panel" data-card-filter-panel ${cardFilterOpen?"":"hidden"}><select data-card-filter="bankId">${cardFilterOptions(state.banks,cardFilters.bankId,"Ngân hàng",bank=>bank.id,bank=>bank.name,{sortDynamic:true})}</select><select data-card-filter="cardType">${cardFilterOptions([{value:"credit",label:"Tín dụng"},{value:"debit",label:"Ghi nợ"}],cardFilters.cardType,"Loại thẻ",item=>item.value,item=>item.label)}</select><select data-card-filter="network">${cardFilterOptions(networks,cardFilters.network,"Phôi",item=>item,item=>item,{sortDynamic:true})}</select><select data-card-filter="cardForm">${cardFilterOptions(cardFormOptions(false),cardFilters.cardForm,"Hình thức",item=>item.value,item=>item.label)}</select>${filterActionBar({apply:"data-card-filter-apply",clear:"data-card-filter-clear",cancel:"data-card-filter-cancel"})}</div>`;
}
function transactionToolbar(){
  const activeCount=Object.values(transactionFilters).filter(Boolean).length;
  const cardItems=sortDisplayRows(state.cards,card=>card.id);
  const hostItems=sortDisplayRows(state.hosts,host=>host.name);
  const categoryItems=sortDisplayRows(state.orderTypes || [],category=>category.name);
  const mccItems=[...state.mccCategories.filter(category=>category.mcc!=null)].sort((a,b)=>mccCode(a.mcc).localeCompare(mccCode(b.mcc),undefined,{numeric:true,sensitivity:"base"}));
  return `<div class="crud-toolbar transactions-toolbar"><input data-search="transactions" placeholder="Tìm giao dịch, Card ID, Loại đơn..."><button type="button" class="secondary-btn transaction-filter-trigger ${activeCount?"active":""}" data-transaction-filter-trigger>${icon("filter")}<span>Bộ lọc</span>${activeCount?`<b>${activeCount}</b>`:""}</button><button class="primary" data-add="transactions">+ Thêm</button><button class="secondary-btn" data-edit="transactions">Chỉnh sửa</button><button class="delete-btn" data-remove="transactions">Xóa</button></div><div class="transaction-filter-panel" data-transaction-filter-panel ${transactionFilterOpen?"":"hidden"}><select data-transaction-filter="cardId">${cardFilterOptions(cardItems,transactionFilters.cardId,"Thẻ",card=>card.id,card=>card.id)}</select><select data-transaction-filter="category">${cardFilterOptions(categoryItems,transactionFilters.category,"Loại đơn",category=>category.name,category=>category.name)}</select><select data-transaction-filter="host">${cardFilterOptions(hostItems,transactionFilters.host,"Host",host=>host.name,host=>host.name)}</select><select data-transaction-filter="channel">${cardFilterOptions(TRANSACTION_METHOD_OPTIONS,transactionFilters.channel,"Hình thức giao dịch",item=>item.value,item=>item.label)}</select><select data-transaction-filter="status">${cardFilterOptions(TRANSACTION_STATUS_OPTIONS,transactionFilters.status,"Trạng thái",item=>item.value,item=>item.label)}</select><select data-transaction-filter="mcc">${cardFilterOptions(mccItems,transactionFilters.mcc,"MCC",category=>String(category.mcc),category=>String(category.mcc))}</select><label class="compact-date-filter"><span>Từ ngày</span><input type="date" data-transaction-filter="dateFrom" value="${esc(transactionFilters.dateFrom)}"></label><label class="compact-date-filter"><span>Đến ngày</span><input type="date" data-transaction-filter="dateTo" value="${esc(transactionFilters.dateTo)}"></label>${filterActionBar({apply:"data-transaction-filter-apply",clear:"data-transaction-filter-clear",cancel:"data-transaction-filter-cancel"})}</div>`;
}
function feeTargetToolbar(){
  const activeCount=Object.values(feeTargetFilters).filter(Boolean).length;
  const bankOptions=sortedUniqueFilterOptions(state.banks,bank=>bank.id,bank=>bank.name);
  const cardOptions=sortedUniqueFilterOptions(state.cards,card=>card.id,card=>card.id);
  return `<div class="crud-toolbar transactions-toolbar fee-target-toolbar"><input data-search="feeTargets" placeholder="Tìm thẻ, ngân hàng, loại phí..."><button type="button" class="secondary-btn transaction-filter-trigger fee-target-filter-trigger ${activeCount?"active":""}" data-fee-target-filter-trigger>${icon("filter")}<span>Bộ lọc</span>${activeCount?`<b>${activeCount}</b>`:""}</button><button class="primary" data-add="feeTargets">+ Thêm</button><button class="secondary-btn" data-edit="feeTargets">Chỉnh sửa</button><button class="delete-btn" data-remove="feeTargets">Xóa</button></div><div class="transaction-filter-panel fee-target-filter-panel" data-fee-target-filter-panel ${feeTargetFilterOpen?"":"hidden"}><select data-fee-target-filter="bankId">${cardFilterOptions(bankOptions,feeTargetFilters.bankId,"Ngân hàng",item=>item.value,item=>item.label)}</select><select data-fee-target-filter="cardId">${cardFilterOptions(cardOptions,feeTargetFilters.cardId,"Thẻ",item=>item.value,item=>item.label)}</select><select data-fee-target-filter="feeType">${cardFilterOptions(CARD_FEE_TYPES,feeTargetFilters.feeType,"Loại phí",item=>item.value,item=>item.label)}</select>${filterActionBar({apply:"data-fee-target-filter-apply",clear:"data-fee-target-filter-clear",cancel:"data-fee-target-filter-cancel"})}</div>`;
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
function paymentCycleDisplay(value,{emptyText="—"}={}){
  const match=String(value||"").trim().match(/^(\d{4})-(\d{2})$/);
  return match ? `Tháng ${match[2]}-${match[1]}` : emptyText;
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
    document.querySelector("[data-refund-guide-trigger]")?.addEventListener("click",openRefundGuide);
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
  if(entity==="feeTargets"){
    document.querySelector("[data-fee-target-filter-trigger]")?.addEventListener("click",event=>{const trigger=event.currentTarget,panel=document.querySelector("[data-fee-target-filter-panel]"),willOpen=panel?.hidden;closeAllFilterPanelsWithoutApply();if(panel&&willOpen){feeTargetFilterOpen=true;syncFilterPanelFromApplied("feeTargets",panel);panel.hidden=false;trigger.classList.add("active");registerFilterPanelOutsideClose("feeTargets",panel,trigger);}});
    document.querySelector("[data-fee-target-filter-cancel]")?.addEventListener("click",()=>closeFilterPanelWithoutApply("feeTargets"));
    document.querySelector("[data-fee-target-filter-apply]")?.addEventListener("click",()=>{document.querySelectorAll("[data-fee-target-filter]").forEach(control=>{feeTargetFilters[control.dataset.feeTargetFilter]=control.value;});feeTargetFilterOpen=false;removeFilterPanelOutsideListener();clearRowSelection("feeTargets");renderAll();});
    document.querySelector("[data-fee-target-filter-clear]")?.addEventListener("click",()=>{Object.keys(feeTargetFilters).forEach(key=>{feeTargetFilters[key]="";});feeTargetFilterOpen=false;removeFilterPanelOutsideListener();clearRowSelection("feeTargets");renderAll();});
  }
  if(entity==="payments"){
    document.querySelector("[data-payment-statement-year]")?.addEventListener("change",event=>{paymentStatementYear=Number(event.target.value);clearRowSelection("payments");renderAll();});
    document.querySelector("[data-payment-statement-month]")?.addEventListener("change",event=>{paymentStatementMonth=Number(event.target.value);clearRowSelection("payments");renderAll();});
    document.querySelector("[data-payment-filter-trigger]")?.addEventListener("click",event=>{const trigger=event.currentTarget,panel=document.querySelector("[data-payment-filter-panel]"),willOpen=panel?.hidden;closeAllFilterPanelsWithoutApply();if(panel&&willOpen){paymentFilterOpen=true;syncFilterPanelFromApplied("payments",panel);panel.hidden=false;trigger.classList.add("active");registerFilterPanelOutsideClose("payments",panel,trigger);}});
    document.querySelector("[data-payment-filter-cancel]")?.addEventListener("click",()=>closeFilterPanelWithoutApply("payments"));
    document.querySelector("[data-payment-filter-apply]")?.addEventListener("click",()=>{document.querySelectorAll("[data-payment-filter]").forEach(control=>{paymentFilters[control.dataset.paymentFilter]=control.value;});paymentFilterOpen=false;removeFilterPanelOutsideListener();clearRowSelection("payments");renderAll();});
    document.querySelector("[data-payment-filter-clear]")?.addEventListener("click",()=>{Object.keys(paymentFilters).forEach(key=>{paymentFilters[key]="";});paymentFilterOpen=false;removeFilterPanelOutsideListener();clearRowSelection("payments");renderAll();});
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
  if(entity==="programs") table.querySelectorAll("[data-programs-card-span]").forEach(cell=>{
    const rowIndex=rows.indexOf(cell.parentElement);
    const rowForPointer=event=>rows.slice(rowIndex,rowIndex+cell.rowSpan).find(row=>{const rect=row.getBoundingClientRect();return event.clientY>=rect.top&&event.clientY<=rect.bottom;})||rows[rowIndex];
    cell.addEventListener("click",event=>{event.stopPropagation();const row=rowForPointer(event);selectRow(entity,row.dataset.id,{toggle:event.ctrlKey||event.metaKey,range:event.shiftKey});});
    cell.addEventListener("dblclick",event=>{event.stopPropagation();handlers.edit(rowForPointer(event).dataset.id);});
    cell.addEventListener("contextmenu",event=>{event.preventDefault();event.stopPropagation();const row=rowForPointer(event);if(!rowSelection(entity).has(row.dataset.id))selectRow(entity,row.dataset.id);openTableContextMenu(entity,handlers,event.clientX,event.clientY);});
  });
  if(entity==="feeTargets") table.querySelectorAll(".fee-bank-cell,.fee-card-id-cell").forEach(cell=>{
    const rowIndex=rows.indexOf(cell.parentElement);
    const rowForPointer=event=>rows.slice(rowIndex,rowIndex+cell.rowSpan).find(row=>{const rect=row.getBoundingClientRect();return event.clientY>=rect.top&&event.clientY<=rect.bottom;})||rows[rowIndex];
    cell.addEventListener("click",event=>{event.stopPropagation();const row=rowForPointer(event);selectRow(entity,row.dataset.id,{toggle:event.ctrlKey||event.metaKey,range:event.shiftKey});});
    cell.addEventListener("dblclick",event=>{event.stopPropagation();handlers.edit(rowForPointer(event).dataset.id);});
    cell.addEventListener("contextmenu",event=>{event.preventDefault();event.stopPropagation();const row=rowForPointer(event);if(!rowSelection(entity).has(row.dataset.id))selectRow(entity,row.dataset.id);openTableContextMenu(entity,handlers,event.clientX,event.clientY);});
  });
  table.closest(".table-wrap")?.addEventListener("click",event=>{if(entity!=="cards"&&!event.target.closest("tr[data-id],button,a,input,select,textarea,label"))clearRowSelection(entity);});
  applyRowSelection(entity);
}

document.addEventListener("click",event=>{
  if(!selectedIds("cards").length) return;
  const tableWrapper=document.querySelector('#view-cards .table-wrap');
  if(tableWrapper?.contains(event.target)) return;
  clearRowSelection("cards");
});

async function openForm(title, fields, initial = {}, onRender = null){
  const modal=document.querySelector("#formModal");
  const form=modal.querySelector("form");
  const body=modal.querySelector(".modal-body");
  modal.querySelector("h2").textContent=title;
  const formLayout=fields.find(field=>field.formLayout)?.formLayout || "";
  const isOrderTypeForm=fields.some(field=>field.name==="name")&&fields.some(field=>field.name==="color");
  body.className=`modal-body form-grid ${formLayout}`.trim();
  form.classList.toggle("card-modal",formLayout==="card-form-grid");
  form.classList.toggle("transaction-modal",formLayout==="transaction-form-grid");
  form.classList.toggle("order-type-modal",isOrderTypeForm);
  body.innerHTML = fields.map(f => {
    const value = initial[f.name] ?? f.value ?? "";
    const disabledAttr = f.disabled ? "disabled" : "";
    const fieldClass = `field${f.disabled ? " disabled-field" : ""}${f.layoutClass ? ` ${f.layoutClass}` : ""}`;
    if(f.type === "color") return colorPickerMarkup(f.name,f.label,value);
    if(f.type === "select") return `<div class="${fieldClass}"><label>${esc(f.label)}</label><select name="${esc(f.name)}" ${f.required?"required":""} ${disabledAttr}>${f.options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?"selected":""}>${esc(o.label)}</option>`).join("")}</select></div>`;
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
  bindSheetsColorPickers(body);
  modal.classList.add("show");
  return new Promise(resolve => {
    const close = result => { modal.classList.remove("show"); form.onsubmit=null; modal.querySelector("[data-cancel-modal]").onclick=null; resolve(result); };
    modal.querySelector("[data-cancel-modal]").onclick=()=>close(null);
    form.onsubmit=e=>{
      e.preventDefault();
      const fd=new FormData(form);
      const values={};
      fields.forEach(f=>{
        if(f.type === "note" || f.transient) return;
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
  const storedCode = String(values.code || "").trim();
  const code = normalizeBankCode(storedCode);
  const name = normalizeBankName(values.name);
  if(!code) return {error:"Vui lòng nhập mã ngân hàng."};
  if(!name) return {error:"Vui lòng nhập tên ngân hàng."};
  if(/\s/.test(code)) return {error:"Mã ngân hàng không được chứa khoảng trắng."};
  if(!/^[A-Z0-9-]+$/.test(code)) return {error:"Mã ngân hàng chỉ được dùng chữ, số và dấu gạch ngang."};
  if(state.banks.some(x => x.id !== existingId && normalizeBankCode(x.code) === code)) return {error:"Mã ngân hàng đã tồn tại."};
  if(state.banks.some(x => x.id !== existingId && normalizeBankName(x.name).toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))) return {error:"Tên ngân hàng đã tồn tại."};
  return {bank:{id:existingId || bankIdFromCode(code), code:storedCode, name}};
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
    {name:"network", label:"Phôi", value:card.network || "Visa", type:"select", options:networkOptions(card.network)},
    {name:"cardType", label:"Loại thẻ", value:String(card.cardType || "credit").toLowerCase(), type:"select", options:[{value:"credit",label:"Tín dụng"},{value:"debit",label:"Ghi nợ"}]},
    {name:"cardForm", label:"Hình thức", value:card.cardForm || "", type:"select", options:cardFormOptions(true)},
    {name:"activationDate", label:"Ngày kích hoạt", value:card.activationDate || "", type:"date"},
    {name:"groupLimit", label:"Hạn mức (VND)", value:card.groupLimit || 0, type:"text", kind:"money"},
    {name:"statementDay", label:"Ngày sao kê", value:card.statementDay || "", type:"select", options:statementDayOptions(card.statementDay)},
    {name:"paymentDueDay", label:"Hạn thanh toán", value:card.paymentDueDay ?? "", type:"select", options:statementDayOptions(card.paymentDueDay)},
    {name:"cashbackCycle", label:"Hoàn tiền", value:card.cashbackCycle || "monthly", type:"select", options:[{value:"monthly",label:"Theo tháng"},{value:"statement",label:"Theo kỳ sao kê"}]},
    {name:"sharedLimitCards", label:"Dùng chung hạn mức", value:selectedSharedCardsForForm(card), type:"multiselect", options:sharedLimitOptions(card.id,bankId), layoutClass:"span-1", hint:"Chỉ hiển thị Card ID cùng ngân hàng."},
    {name:"notes", label:"Ghi chú", value:card.notes || "", type:"textarea", layoutClass:"span-full"}
  ];
}
function cashbackCycleLabel(value){
  const normalized=String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
  return value === "statement" || normalized === "theokysaoke" ? "Theo kỳ sao kê" : normalized === "theosaoke" ? "Theo sao kê" : value === "monthly" || normalized === "theothang" ? "Theo tháng" : "Chưa thiết lập";
}
function normalizeCardNetwork(value){
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
}
const CARD_NETWORK_TEXT_COLORS=["#2563eb","#ea580c","#0891b2","#7c3aed","#15803d","#be185d","#4338ca","#b45309"];
function cardNetworkPresentation(value){
  const normalized=normalizeCardNetwork(value);
  if(!normalized) return {className:"is-not-applicable",color:"var(--muted)"};
  const known={visa:["network-visa","#2563eb"],mastercard:["network-mastercard","#ea580c"],americanexpress:["network-amex","#0891b2"],amex:["network-amex","#0891b2"],jcb:["network-jcb","#7c3aed"]};
  if(known[normalized]) return {className:known[normalized][0],color:known[normalized][1]};
  let hash=0;
  for(const character of normalized) hash=((hash*31)+character.charCodeAt(0))>>>0;
  return {className:"network-fallback",color:CARD_NETWORK_TEXT_COLORS[hash%CARD_NETWORK_TEXT_COLORS.length]};
}
function refundCycleClass(value,label){
  const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
  const normalizedValues=[normalize(value),normalize(label)];
  return value==="statement"||normalizedValues.includes("theokysaoke")||normalizedValues.includes("theosaoke") ? "refund-statement" : "refund-monthly";
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
  const cardType = values.cardType === "debit" ? "debit" : "credit";
  const statementDay = cardType === "debit" || values.statementDay === "" || values.statementDay == null ? "" : Number(values.statementDay);
  if(cardType === "credit" && statementDay !== "" && (!Number.isInteger(statementDay) || statementDay < 1 || statementDay > 31)) return {error:"Ngày sao kê phải nằm trong khoảng 1 đến 31."};
  const paymentDueDay = values.paymentDueDay === "" || values.paymentDueDay == null ? null : Number(values.paymentDueDay);
  if(paymentDueDay != null && (!Number.isInteger(paymentDueDay) || paymentDueDay < 1 || paymentDueDay > 31)) return {error:"Hạn thanh toán phải là số nguyên từ 1 đến 31."};
  const bank = state.banks.find(x=>x.id===values.bankId);
  if(!bank) return {error:"Ngân hàng đã chọn không tồn tại."};
  const existingCard=state.cards.find(item=>item.id===existingId);
  const paymentTrackingStartMonth=paymentDueDay == null ? "" : (existingCard?.paymentTrackingStartMonth || paymentCycleFromDate());
  const cashbackCycle=values.cashbackCycle === "statement" ? "statement" : "monthly";
  const activationDate=toStorageDate(values.activationDate);
  if(values.activationDate&&!activationDate) return {error:"Ngày kích hoạt không hợp lệ."};
  const card = {...existingCard, ...values, cardType, activationDate, cashbackCycle, statementDay, paymentDueDay, paymentTrackingStartMonth, id, bank:bank.name, groupLimit:cardType === "debit" ? 0 : normalizeMoney(values.groupLimit, {emptyValue:0}), notes:String(values.notes || "")};
  delete card.annualFee;
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

function cardBankName(card){
  return bankName(card?.bankId,card?.bank||"—");
}
const CARD_BANK_TEXT_COLORS=["#2563eb","#15803d","#7c3aed","#c2410c","#0f766e","#4338ca","#92400e","#be185d"];
function cardBankTextColor(card){
  const bank=state.banks.find(item=>item.id===card?.bankId);
  const key=String(bank?.code||cardBankName(card)||"").trim().toUpperCase();
  let hash=0;
  for(const character of key) hash=((hash*31)+character.charCodeAt(0))>>>0;
  return CARD_BANK_TEXT_COLORS[hash%CARD_BANK_TEXT_COLORS.length];
}
function renderCards(){
  const matching=state.cards.filter(card=>(!cardFilters.bankId||card.bankId===cardFilters.bankId)&&(!cardFilters.cardType||card.cardType===cardFilters.cardType)&&(!cardFilters.network||card.network===cardFilters.network)&&(!cardFilters.cardForm||card.cardForm===cardFilters.cardForm));
  const rows=filteredRows("cards",matching,c=>`${c.id} ${cardBankName(c)} ${c.network} ${cardTypeLabel(c.cardType)} ${cardFormLabel(c.cardForm)} ${formatDateDisplay(c.activationDate)} ${sharedLimitLabel(c)} ${paymentDueDayLabel(c.paymentDueDay)} ${c.notes||""}`);
  rows.sort((left,right)=>compareVietnameseText(cardBankName(left),cardBankName(right))||compareVietnameseText(left.id,right.id));
  const summary=summarizeCardsTableRows(rows.map(card=>({
    ...card,
    bankIdentity:String(card.bankId||card.bank||"").trim(),
    limitGroupId:groupIdForCard(card),
    debt:card.cardType==="debit"?0:allDebt(card.id)
  })));
  const mergeBanks=window.matchMedia?.("(min-width:768px)")?.matches!==false;
  const bankSpanAt=index=>{
    if(!mergeBanks)return 1;
    const bank=cardBankName(rows[index]);
    if(index>0&&cardBankName(rows[index-1])===bank)return 0;
    let span=1;
    while(index+span<rows.length&&cardBankName(rows[index+span])===bank)span+=1;
    return span;
  };
  document.querySelector("#view-cards").innerHTML=`<div class="card cards-card">${!state.banks.length?'<div class="note">Chưa có mã ngân hàng. Hãy vào tab Mã ngân hàng để thêm trước khi tạo thẻ.</div>':""}${cardToolbar()}<div class="table-wrap cards-table-wrap"><table class="mobile-card-table cards-table" data-entity="cards" data-sticky-through="Loại thẻ"><thead><tr><th>Ngân hàng</th><th>Thẻ</th><th>Phôi</th><th>Loại thẻ</th><th>Hình thức</th><th>Ngày kích hoạt</th><th>Hạn mức</th><th>Dư nợ</th><th>Chung hạn mức</th><th>Ngày sao kê</th><th>Hạn thanh toán</th><th>Hoàn tiền</th><th>Ghi chú</th></tr></thead><tbody>
  <tr class="summary-row card-total-row"><td class="card-summary-bank-count">${summary.bankCount} ngân hàng</td><td class="card-summary-card-count">${summary.cardCount} thẻ</td><td></td><td></td><td></td><td></td><td class="num card-limit-cell">${formatMoneyDisplay(summary.totalLimit)}</td><td class="num card-balance-cell">${formatMoneyDisplay(summary.outstanding)}</td><td></td><td></td><td></td><td></td><td></td></tr>
  ${rows.map((c,index)=>{const debit=c.cardType==="debit",span=bankSpanAt(index),sharedLabel=sharedLimitLabel(c),refundLabel=cashbackCycleLabel(c.cashbackCycle),refundClass=refundCycleClass(c.cashbackCycle,refundLabel),network=cardNetworkPresentation(c.network);return `<tr data-id="${esc(c.id)}" class="${debit?"debit-row ":""}${selectedRows.cards===c.id?"selected":""}">${span?`<td rowspan="${span}" class="cashback-bank-cell card-bank-cell" style="--card-bank-color:${cardBankTextColor(c)}">${esc(cardBankName(c))}</td>`:""}<td><strong>${esc(c.id)}</strong></td><td class="card-network-cell ${network.className}" style="--card-network-color:${network.color}">${esc(c.network||"—")}</td><td>${esc(cardTypeLabel(c.cardType))}</td><td>${esc(cardFormLabel(c.cardForm))}</td><td>${esc(formatDateDisplay(c.activationDate,{emptyText:"—"}))}</td><td class="num card-limit-cell ${debit?"is-not-applicable":""}">${debit?"—":formatMoneyDisplay(c.groupLimit)}</td><td class="num card-balance-cell ${debit?"is-not-applicable":""}">${debit?"—":formatMoneyDisplay(allDebt(c.id))}</td><td class="wrap-cell card-shared-limit-cell ${sharedLabel==="Không"?"is-none":""}">${esc(sharedLabel)}</td><td>${debit?"—":esc(statementDayLabel(c.statementDay))}</td><td>${esc(paymentDueDayLabel(c.paymentDueDay))}</td><td class="card-refund-cycle-cell ${refundClass}">${esc(refundLabel)}</td><td class="wrap-cell">${esc(c.notes||"—")}</td></tr>`;}).join("")}</tbody></table></div></div>`;
  wireToolbar("cards", {
    add: async()=>{ if(!state.banks.length){ toast("Vui lòng cấu hình Mã ngân hàng trước."); setView("banks"); return; } const v=await openForm("Thêm thẻ", cardFields({}, "add"), {}, wireCardForm); if(!v) return; const result=validateCard(v); if(result.error) return toast(result.error); state.cards.push(result.card); if(result.targetGroupId) syncGroupLimits(result.targetGroupId, result.card.groupLimit); selectedRows.cards=result.card.id; saveState("Đã thêm thẻ"); },
    edit: async id=>{ const i=state.cards.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa thẻ", cardFields(state.cards[i], "edit"), {...state.cards[i], sharedLimitCards:selectedSharedCardsForForm(state.cards[i])}, wireCardForm); if(!v) return; const result=validateCard(v, id); if(result.error) return toast(result.error); state.cards[i]=result.card; renameCardReferences(id,result.card.id); repairLimitGroups(); if(result.targetGroupId) syncGroupLimits(result.targetGroupId, result.card.groupLimit); clearRowSelection("cards"); selectedRows.cards=result.card.id; rowSelection("cards").add(result.card.id); saveState("Đã cập nhật thẻ"); },
    remove: id=>{ if((state.feeTargets||[]).some(target=>target.cardId===id)) return toast("Không thể xóa thẻ đang có dữ liệu phí thẻ."); if(!confirm("Xóa thẻ đã chọn? Các giao dịch/thanh toán liên quan sẽ không bị xóa.")) return; state.cards=state.cards.filter(x=>x.id!==id); repairLimitGroups(); clearRowSelection("cards"); saveState("Đã xóa thẻ"); },
    bulkRemove:ids=>{const blocked=ids.filter(id=>(state.feeTargets||[]).some(target=>target.cardId===id));if(blocked.length)return toast(`Không thể xóa ${blocked.length} thẻ đang có dữ liệu phí thẻ.`);const selected=new Set(ids);state.cards=state.cards.filter(card=>!selected.has(card.id));repairLimitGroups();clearRowSelection("cards");saveState(`Đã xóa ${ids.length} thẻ`);}
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
  ${activeHelpTab==='version'?`<section class="card help-prose"><h2>Thông tin phiên bản</h2><p>CardFlow Web — ứng dụng quản lý thẻ theo mô hình local-first, hỗ trợ đồng bộ Google Drive.</p><p>Dữ liệu hiện dùng schemaVersion 10 và giữ cơ chế chuẩn hóa tương thích với dữ liệu cũ.</p></section>`:''}</div>`;
  wireHelpCenter();
}

function helpTopics(){
  return [
  {id:'getting-started',title:'Bắt đầu sử dụng',html:`<h3>Thiết lập ban đầu</h3><p>Tạo <strong>Mã ngân hàng</strong> trước, sau đó thêm <strong>Thẻ</strong>; Host có thể bỏ qua và bổ sung sau. Card ID do người dùng nhập và phải là duy nhất.</p><p><strong>Thẻ</strong>, <strong>Mã ngân hàng</strong> và <strong>Bảng MCC</strong> là ba danh mục dùng chung toàn ứng dụng: chỉ cấu hình một lần, không phụ thuộc tháng/năm và được các giao dịch, chương trình Cashback cùng các trang liên quan tham chiếu lại. Các dropdown danh mục chữ được sắp xếp theo nhãn tiếng Việt; lựa chọn đặc biệt, ngày, tháng, năm và trạng thái nghiệp vụ vẫn giữ thứ tự phù hợp.</p><p>Kết nối Google Drive để đồng bộ trên nhiều thiết bị.</p><div class="help-callout note"><strong>Lưu ý</strong><p>Nếu chưa có mã ngân hàng, ứng dụng không cho thêm thẻ. Khi đổi Card ID, ứng dụng cập nhật các dữ liệu đang tham chiếu tới thẻ đó.</p></div>`},
  {id:'row-selection',title:'Chọn dòng & Menu chuột phải',html:`<p>Tính năng có trên các bảng CRUD: <strong>Thẻ, Chương trình Cashback, Giao dịch, Cashback thực nhận, Thanh toán thẻ, Phí thẻ, Host, Bảng MCC và Mã ngân hàng</strong>. Các bảng thống kê chỉ đọc không có menu này.</p><h3>Danh sách thu gọn trên tablet và điện thoại</h3><p>Trên tablet và smartphone, mỗi bản ghi được hiển thị thành một dòng tiêu đề nhỏ gọn. Chạm vào tiêu đề để mở hoặc thu gọn chi tiết; biểu tượng mũi tên cho biết trạng thái hiện tại. Ví dụ: giao dịch dùng tiêu đề <strong>Ngày_Card ID</strong>, thẻ và Tình trạng thẻ dùng <strong>Card ID</strong>. Cách trình bày này giúp xem danh sách dài nhanh hơn. Trên desktop, bảng đầy đủ vẫn được giữ nguyên.</p><h3>Chọn một hoặc nhiều dòng</h3><p>Click một dòng để chọn riêng dòng đó; dòng được chọn có nền highlight. Để chọn nhiều dòng rời nhau, dùng <strong>Ctrl + Click</strong> trên Windows/Linux hoặc <strong>Cmd + Click</strong> trên macOS. Để chọn một dải liên tiếp, click dòng đầu, giữ <strong>Shift</strong> rồi click dòng cuối.</p><h3>Menu chuột phải / context menu</h3><p>Bấm chuột phải trên dòng đã chọn để mở menu gần con trỏ. Với một dòng, menu có <strong>Thêm, Chỉnh sửa, Xóa</strong>. Với nhiều dòng, menu có <strong>Thêm</strong> và <strong>Xóa các dòng đã chọn</strong>; Chỉnh sửa bị khóa vì ứng dụng chưa hỗ trợ bulk edit.</p><p>Chuột phải trên một dòng đã thuộc multi-selection sẽ giữ toàn bộ lựa chọn. Chuột phải trên dòng chưa được chọn sẽ bỏ lựa chọn cũ và chỉ chọn dòng mới trước khi mở menu.</p><h3>Xóa nhiều dòng an toàn</h3><p>Chọn nhiều dòng → bấm chuột phải → chọn “Xóa các dòng đã chọn” → xác nhận. Ứng dụng dùng một hộp xác nhận cho cả nhóm và vẫn kiểm tra các ràng buộc dữ liệu trước khi xóa.</p><p>Các nút <strong>Thêm, Chỉnh sửa, Xóa</strong> phía trên bảng vẫn hoạt động bình thường; menu chuột phải chỉ là thao tác nhanh bổ sung trên desktop. Trên tablet/mobile, tiếp tục dùng các nút CRUD. Tablet có chuột hoặc trackpad có thể dùng context menu nếu thiết bị hỗ trợ.</p><div class="help-callout tip"><strong>Mẹo</strong><p>Khi cần xóa nhiều giao dịch, hãy dùng Ctrl + Click hoặc Shift + Click để chọn nhiều dòng rồi bấm chuột phải.</p></div><p class="help-search-keywords">Từ khóa: danh sách thu gọn, accordion, mở chi tiết, chuột phải, menu chuột phải, context menu, chọn nhiều dòng, Ctrl, Cmd, Shift, xóa nhiều dòng, bulk delete.</p>`},
  {id:'cards',title:'Quản lý thẻ',html:`<p>Thẻ là danh sách dùng chung cho mọi tháng. Dùng Thêm, Chỉnh sửa, Xóa để quản lý Card ID, thẻ Credit hoặc Debit, phôi, hình thức, ngày sao kê, hạn mức, phí thường niên và ghi chú; các trang liên quan tham chiếu Card ID từ danh sách này.</p><p><strong>Ngày sao kê</strong> quyết định kỳ của từng giao dịch; <strong>Hạn thanh toán</strong> nằm trong tháng kế tiếp sau kỳ sao kê. Ví dụ Ngày sao kê 20, Hạn thanh toán 5: giao dịch 19-08 thuộc kỳ 08/2026 và đến hạn 05-09-2026; giao dịch 21-08 thuộc kỳ 09/2026 và đến hạn 05-10-2026. Ngày 29–31 được điều chỉnh về ngày hợp lệ cuối tháng khi cần.</p><p>Giao dịch đúng ngày sao kê có thể phụ thuộc thời điểm chốt của ngân hàng. App tạm xếp vào kỳ sớm hơn và cảnh báo để người dùng kiểm tra sao kê thực tế.</p><p>Thẻ Debit không dùng ngày sao kê, hạn mức nhóm hay dư nợ. Với thẻ Credit, chọn các thẻ ở “Dùng chung hạn mức”; các thẻ trong nhóm dùng cùng hạn mức và dư nợ nhóm.</p><div class="help-callout example"><strong>Ví dụ</strong><p>Hai thẻ cùng nhóm hạn mức hiển thị cùng hạn mức khả dụng sau khi trừ tổng dư nợ của cả nhóm.</p></div>`},
  {id:'cashback',title:'Chương trình Cashback',html:`<p>Chương trình Cashback được quản lý riêng theo từng tháng. Khi mở một tháng chưa có rule, ứng dụng tự sao chép toàn bộ rule từ tháng liền trước; nếu tháng trước cũng trống thì tháng mới vẫn để trống.</p><p>Bản sao là snapshot độc lập. Hãy chỉnh rule của tháng mới khi ngân hàng thay đổi chính sách; thêm, sửa hoặc xóa trong tháng mới không làm thay đổi dữ liệu tháng trước.</p><p>Mỗi rule gồm % Cashback, Max CB, chỉ tiêu tổng và MCC áp dụng. Max CB “Không giới hạn” không tạo mức chi nhóm để max; khi có giới hạn, ứng dụng suy ra mức chi cần thiết từ tỷ lệ và Max CB.</p><p>Một thẻ có thể có nhiều tiêu chí. Với các rule cạnh tranh trong cùng thẻ/tháng, rule đạt đủ điều kiện trước được tính; các rule còn lại bị khóa để tránh cộng trùng. Giao dịch phải đúng Card ID, MCC/loại đơn và trạng thái hợp lệ.</p>`},
  {id:'transactions',title:'Giao dịch',html:`<p>Mỗi giao dịch có Ngày, Card ID, Loại đơn, Host, Số tiền đơn, Tiền Back, % Phí Host, Phí Host, hình thức Online/Offline/Quẹt POS, trạng thái và ghi chú.</p><p>Khi chọn “Tiêu dùng cá nhân”, Host, Ngày Back và Tiền Back bị khóa/xóa; giao dịch đó không áp dụng phí Host. <strong>Ghi chú luôn được giữ và vẫn có thể chỉnh sửa.</strong></p><h3>Thao tác nhanh nhiều giao dịch</h3><p>Dùng <strong>Ctrl/Cmd + Click</strong> để chọn từng giao dịch rời nhau hoặc <strong>Shift + Click</strong> để chọn một dải. Bấm chuột phải và chọn “Xóa các dòng đã chọn”; sau khi xác nhận, bảng và các tổng hợp phụ thuộc được tính lại theo dữ liệu còn lại.</p><div class="help-callout tip"><strong>Mẹo</strong><p>Khi cần xóa nhiều giao dịch, hãy dùng Ctrl + Click hoặc Shift + Click để chọn nhiều dòng rồi bấm chuột phải.</p></div>`},
  {id:'cashback-receipts',title:'Cashback thực nhận',html:`<p>Ghi nhận Ngày, Ngân hàng, Card ID, Tiền Cashback và Ghi chú cho khoản ngân hàng thực trả. Dữ liệu này dùng để đối chiếu với Cashback theo rule; hai số có thể khác vì một bên là dự kiến, một bên là khoản đã nhận.</p>`},
  {id:'annual-fee',title:'Phí thẻ',html:`<p>Quản lý phí thường niên và phí quản lý theo từng Card ID. Phí thẻ lý thuyết được nhập tại đây; phí thẻ thực tế bằng 0 khi đã đạt chỉ tiêu hoàn phí, ngược lại bằng phí lý thuyết. Ngày kích hoạt được lấy từ Bảng Thẻ.</p><p>Ứng dụng tiếp tục dùng giao dịch hợp lệ trong khoảng ngày đã chọn để tính số còn thiếu theo công thức hiện có. Mỗi Card ID chỉ có tối đa một bản ghi cho từng loại phí.</p>`},
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
  const id=existing.id || uniqueCashbackProgramId(baseId,state.cashbackPrograms);
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
    <div class="cashback-condition-action">${index?`<button type="button" class="icon-btn cashback-delete-condition" title="Xóa điều kiện" aria-label="Xóa điều kiện">${icon("trash")}</button>`:""}</div>
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
    <section class="cashback-conditions"><div class="cashback-condition-header"><span>Điều kiện</span><span>MCC</span><span>Hình thức giao dịch</span><span>Tỷ lệ hoàn (%)</span><span>Hoàn tối đa</span><span>Chi tối thiểu</span></div><div data-condition-list>${initialConditions.map((condition,index)=>`${cashbackConditionRow(condition,index,existing)}${index<initialConditions.length-1?cashbackConnectorRow(normalizeCombineOperator(existing.combineOperator)):""}`).join("")}</div></section>
    <button type="button" class="secondary-btn cashback-add-condition" data-add-condition>+ Thêm điều kiện</button>
    <div class="cashback-total-row"><label class="check-field cashback-total-toggle"><input type="checkbox" data-total-enabled ${totalCondition.enabled?"checked":""}><span>Chi tổng</span></label><div class="money-input cashback-total-input"><input data-total-amount inputmode="numeric" value="${esc(formatMoneyInput(totalCondition.amount,{allowEmpty:true}))}" ${totalCondition.enabled?"":"disabled"}><span>đ</span></div></div>`;
  let operator=normalizeCombineOperator(existing.combineOperator),openMcc=null;
  const list=body.querySelector("[data-condition-list]");
  const closeOpenMcc=()=>{if(openMcc)openMcc.classList.remove("open");openMcc=null;document.removeEventListener("pointerdown",handleMccOutsidePointer,true);};
  const handleMccOutsidePointer=event=>{if(!openMcc)return;const path=event.composedPath?.()||[];if(path.includes(openMcc)||openMcc.contains(event.target))return;closeOpenMcc();};
  const toggleMcc=mcc=>{if(openMcc===mcc)return closeOpenMcc();closeOpenMcc();openMcc=mcc;mcc.classList.add("open");document.addEventListener("pointerdown",handleMccOutsidePointer,true);};
  const refreshRows=()=>{list.querySelectorAll("[data-condition-connector]").forEach(connector=>connector.remove());const rows=[...list.querySelectorAll("[data-condition-row]")];rows.forEach((row,index)=>{row.querySelector(".cashback-condition-badge").textContent=`Điều kiện ${index+1}`;row.querySelector(".cashback-condition-action").innerHTML=index?`<button type="button" class="icon-btn cashback-delete-condition" title="Xóa điều kiện" aria-label="Xóa điều kiện">${icon("trash")}</button>`:"";if(index<rows.length-1)row.insertAdjacentHTML("afterend",cashbackConnectorRow(operator));});};
  const recalculate=row=>{const unlimited=row.querySelector("[data-condition-max-type]").value==="UNLIMITED",maxInput=row.querySelector("[data-condition-max]"),minInput=row.querySelector("[data-condition-min]"),unit=minInput.nextElementSibling;maxInput.disabled=unlimited;maxInput.placeholder=unlimited?"Không áp dụng":"0";if(unlimited){maxInput.value="";minInput.value="Không giới hạn";unit.classList.add("hidden");}else{maxInput.value=formatMoneyInput(maxInput.value,{allowEmpty:true});const spend=calculateSpendToMax(parseCashbackRateInput(row.querySelector("[data-condition-rate]").value),parseMoney(maxInput.value,{emptyValue:0}));minInput.value=spend==null?"":formatMoneyInput(spend,{allowEmpty:true});unit.classList.toggle("hidden",spend==null);}};
  const wireRow=row=>{const mcc=row.querySelector(".cashback-mcc-select"),toggle=mcc.querySelector("[data-cashback-mcc-toggle]"),boxes=[...mcc.querySelectorAll('input[type="checkbox"]')];toggle.onclick=()=>toggleMcc(mcc);boxes.forEach(box=>box.onchange=()=>{if(box.value===ALL_MCC_VALUE&&box.checked)boxes.forEach(other=>{other.checked=other===box;});else if(box.checked)boxes.find(other=>other.value===ALL_MCC_VALUE).checked=false;toggle.textContent=cashbackMccSummary(row);});const rate=row.querySelector("[data-condition-rate]"),max=row.querySelector("[data-condition-max]");rate.oninput=()=>recalculate(row);rate.onblur=()=>{rate.value=cashbackRateInput(parseCashbackRateInput(rate.value));recalculate(row);};max.oninput=()=>recalculate(row);max.onblur=()=>recalculate(row);row.querySelector("[data-condition-max-type]").onchange=()=>recalculate(row);recalculate(row);};
  [...list.querySelectorAll("[data-condition-row]")].forEach(wireRow);
  body.onclick=event=>{const operatorButton=event.target.closest("[data-operator]");if(operatorButton){operator=operatorButton.dataset.operator;body.querySelectorAll("[data-operator]").forEach(button=>button.classList.toggle("active",button.dataset.operator===operator));return;}if(event.target.closest("[data-add-condition]")){const index=list.querySelectorAll("[data-condition-row]").length;list.insertAdjacentHTML("beforeend",cashbackConditionRow({},index,{id:existing.id||"PROGRAM"}));wireRow(list.lastElementChild);refreshRows();return;}const remove=event.target.closest(".cashback-delete-condition");if(remove&&list.querySelectorAll("[data-condition-row]").length>1){const row=remove.closest("[data-condition-row]");if(openMcc&&row.contains(openMcc))closeOpenMcc();row.remove();refreshRows();}};
  const totalEnabled=body.querySelector("[data-total-enabled]"),totalAmount=body.querySelector("[data-total-amount]");totalEnabled.onchange=()=>{totalAmount.disabled=!totalEnabled.checked;if(totalEnabled.checked)totalAmount.focus();};totalAmount.oninput=()=>{totalAmount.value=formatMoneyInput(totalAmount.value,{allowEmpty:true});};
  const mccModalObserver=new MutationObserver(()=>{if(!modal.classList.contains("show")){closeOpenMcc();mccModalObserver.disconnect();}});
  mccModalObserver.observe(modal,{attributes:true,attributeFilter:["class"]});
  modal.classList.add("show");
  return new Promise(resolve=>{const close=result=>{modal.classList.remove("show");form.onsubmit=null;body.onclick=null;form.classList.remove("cashback-program-modal");resolve(result);};modal.querySelector("[data-cancel-modal]").onclick=()=>close(null);form.onsubmit=event=>{event.preventDefault();const name=body.querySelector('[name="name"]').value;if(!name.trim())return toast("Vui lòng nhập tên chương trình cashback.");const cardId=body.querySelector('[name="cardId"]').value;if(!cardId)return toast("Vui lòng chọn thẻ.");const conditions=[...list.querySelectorAll("[data-condition-row]")].map(collectCashbackCondition);if(conditions.some(condition=>!condition.allMcc&&!condition.mccCategoryIds.length))return toast("Mỗi điều kiện phải chọn Tất cả hoặc ít nhất một nhóm MCC.");if(conditions.some(condition=>condition.rate<=0))return toast("Tỷ lệ hoàn phải lớn hơn 0%.");if(conditions.some(condition=>!condition.maxCashbackUnlimited&&condition.max<=0))return toast("Hoàn tối đa phải lớn hơn 0 hoặc chọn Không giới hạn.");const totalSpendCondition={enabled:totalEnabled.checked,amount:totalEnabled.checked?parseMoney(totalAmount.value,{emptyValue:null}):null};if(totalSpendCondition.enabled&&!totalSpendCondition.amount)return toast("Vui lòng nhập Chi tổng.");close({name,cardId,combineOperator:operator,conditions,totalSpendCondition});};});
}
function normalizeCashbackProgramFormValues(values,existing={}){
  const name=String(values.name||"");
  const id=existing.id||uniqueCashbackProgramId(buildCashbackProgramId(values.cardId,name),state.cashbackPrograms);
  const first=values.conditions[0];
  const totalTarget=values.totalSpendCondition.enabled?values.totalSpendCondition.amount:null;
  return {...existing,id,year:selectedYear,month:selectedMonth,name,cardId:values.cardId,combineOperator:normalizeCombineOperator(values.combineOperator),conditions:values.conditions,totalSpendCondition:values.totalSpendCondition,totalTarget,totalTargetManuallyEdited:values.totalSpendCondition.enabled,...first};
}
function cashbackProgramBankName(program){
  const card=state.cards.find(item=>item.id===program?.cardId);
  return bankName(card?.bankId,card?.bank||"—");
}
function renderPrograms(){
  const pm=programMetrics();
  const rows=sortDisplayRows(
    filteredRows("programs",pm,p=>`${p.cardId} ${p.id} ${p.name} ${isCashbackUnlimited(p)?"Không giới hạn":""} ${mccProgramSummary(p)} ${mccProgramCodes(p)} ${normalizeCombineOperator(p.combineOperator)}`),
    program=>cashbackProgramBankName(program),
    program=>program.cardId,
    program=>program.name
  );
  const spanFrom=(index,predicate)=>{
    let span=1;
    while(index+span<rows.length&&predicate(rows[index],rows[index+span]))span+=1;
    return span;
  };
  document.querySelector("#view-programs").innerHTML=`<div class="card"><div class="section-title"><h2>Chương trình cashback</h2><small>Thiết lập và theo dõi các chương trình, tỷ lệ và điều kiện hoàn tiền.</small></div>${toolbar("programs")}<div class="table-wrap"><table data-entity="programs"><thead><tr><th>Ngân hàng</th><th>Thẻ</th><th>Chương trình</th><th>% CB</th><th>Max CB</th><th>Chi nhóm để max</th><th>Chỉ tiêu tổng</th><th>Hình thức giao dịch</th><th>Nhóm MCC</th><th>Mã MCC</th><th>CB tháng</th></tr></thead><tbody>
  ${rows.map((x,index)=>{const bankStart=index===0||cashbackProgramBankName(rows[index-1])!==cashbackProgramBankName(x),cardStart=index===0||rows[index-1].cardId!==x.cardId;return `<tr data-id="${esc(x.id)}" class="${selectedRows.programs===x.id?"selected":""}${x.competitionLocked?" cashback-rule-locked":""}">${bankStart?`<td rowspan="${spanFrom(index,(left,right)=>cashbackProgramBankName(left)===cashbackProgramBankName(right))}" class="cashback-bank-cell">${esc(cashbackProgramBankName(x))}</td>`:""}${cardStart?`<td rowspan="${spanFrom(index,(left,right)=>left.cardId===right.cardId)}" class="cashback-bank-cell cashback-program-card-cell" data-programs-card-span>${esc(x.cardId)}</td>`:""}<td>${esc(x.name)}${x.conditions?.length>1?` <span class="badge">${x.conditions.length} điều kiện</span>`:""}</td><td>${x.conditions?.length>1?`${x.conditions.map(condition=>formatCashbackRate(condition.rate)).join(" / ")}`:formatCashbackRate(x.rate)}</td><td class="num">${x.conditions?.length>1?x.conditions.map(condition=>isCashbackUnlimited(condition)?"Không giới hạn":formatMoneyDisplay(condition.max)).join(" / "):isCashbackUnlimited(x)?"Không giới hạn":formatMoneyDisplay(x.max)}</td><td class="num">${optionalMoneyDisplay(x.eligibleTarget)}</td><td class="num">${optionalMoneyDisplay(x.totalTarget)}</td><td>${esc(x.conditions?.length>1?x.conditions.map(condition=>transactionMethodLabel(condition.channel)||"Tất cả").join(" / "):transactionMethodLabel(x.channel)||"Tất cả")}</td><td class="wrap-cell">${esc(mccProgramSummary(x))}</td><td class="wrap-cell">${esc(mccProgramCodes(x))}</td><td class="num">${formatMoneyDisplay(x.displayCashback)}</td></tr>`;}).join("")}</tbody></table></div></div>`;
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
  const cardFee=isCardFeeTransaction(tx);
  const personalUse = normalizeTransactionStatus(tx.status) === TRANSACTION_STATUS.PERSONAL_USE;
  const hostOptions = [{value:"", label:""}, ...selectOptions(state.hosts, h=>h.name, h=>h.name)];
  const orderTypeOptions=selectOptions(state.orderTypes || [], item=>item.name, item=>item.name);
  const savedOrderType=String(tx.orderType || "").trim();
  if(savedOrderType&&!orderTypeOptions.some(option=>option.value===savedOrderType)){
    orderTypeOptions.push({value:savedOrderType,label:`${savedOrderType} (dữ liệu cũ)`});
    orderTypeOptions.sort((a,b)=>compareVietnameseText(a.label,b.label));
  }
  const mccOptions=selectOptions(state.mccCategories, item=>item.name, item=>item.id);
  const currentMcc=transactionMccCategory(tx);
  const cardOptions = selectOptions(state.cards, card=>card.id, card=>card.id);
  const savedCardId=String(tx.cardId || "").trim();
  if(savedCardId && !cardOptions.some(option=>option.value===savedCardId)){
    cardOptions.push({value:savedCardId,label:savedCardId});
    cardOptions.sort((a,b)=>compareVietnameseText(a.label,b.label));
  }
  return [
    {name:"date", label:"Ngày", value:tx.date || todayStorageDate(), type:"date", formLayout:"transaction-form-grid"},
    {name:"cardId", label:"Thẻ", value:savedCardId, type:"select", options:[{value:"",label:"Chọn Card ID"}, ...cardOptions], required:true},
    {name:"orderType", label:"Loại đơn", value:savedOrderType, type:"select", options:[{value:"",label:"Chọn Loại đơn"}, ...orderTypeOptions], required:true},
    {name:"mccCategoryId", label:"Nhóm MCC", value:cardFee ? "" : currentMcc?.id || tx.mccCategoryId || "", type:"select", options:[{value:"",label:cardFee ? "Không" : "Chọn Nhóm MCC"}, ...mccOptions], required:!cardFee, disabled:cardFee},
    {name:"mcc", label:"Mã MCC", value:cardFee ? "Không" : currentMcc?.mcc ?? tx.mcc ?? "", type:"text", readonly:true, disabled:cardFee},
    {name:"amount", label:"Tiền đơn (VND)", value:tx.amount ?? 0, type:"text", kind:"money"},
    {name:"backAmount", label:"Tiền về (VND)", value:(cardFee || personalUse) ? "Không" : tx.backAmount ?? 0, type:"text", kind:cardFee || personalUse ? undefined : "money", allowEmpty:true, disabled:cardFee || personalUse},
    {name:"backDate", label:"Ngày về", value:(cardFee || personalUse) ? "Không" : tx.backDate || "", type:cardFee || personalUse ? "text" : "date", disabled:cardFee || personalUse},
    {name:"status", label:"Trạng thái", value:cardFee ? "" : normalizeTransactionStatus(tx.status), type:"select", options:[...transactionStatusOptionsForEditing(tx.status), ...(cardFee ? [{value:"",label:"Không"}] : [])], disabled:cardFee},
    {name:"host", label:"Host", value:tx.host || state.hosts[0]?.name || "", type:"select", options:hostOptions},
    {name:"note", label:"Ghi chú", value:tx.note || "", type:"textarea", layoutClass:"span-full"}
  ];
}
function wireTxForm(modal){
  const status=modal.querySelector('[name="status"]');
  const orderType=modal.querySelector('[name="orderType"]');
  const mccCategory=modal.querySelector('[name="mccCategoryId"]');
  const mcc=modal.querySelector('[name="mcc"]');
  const host=modal.querySelector('[name="host"]');
  const backDate=modal.querySelector('[name="backDate"]');
  const backAmount=modal.querySelector('[name="backAmount"]');
  const note=modal.querySelector('[name="note"]');
  if(!status || !orderType || !mccCategory || !mcc || !host || !backDate || !backAmount || !note) return;
  const setFieldDisabled=(input,disabled)=>{
    input.disabled=disabled;
    input.closest(".field")?.classList.toggle("disabled-field",disabled);
  };
  const apply=()=>{
    const cardFee=isCardFeeOrderType(orderType.value);
    const personalUse=status.value===TRANSACTION_STATUS.PERSONAL_USE;
    const noBack=cardFee || personalUse;
    mccCategory.required=!cardFee;
    backDate.type=noBack ? "text" : "date";
    if(cardFee) status.value="";
    else if(!status.value) status.value=TRANSACTION_STATUS.SENT_BILL;
    setFieldDisabled(status,cardFee);
    setFieldDisabled(backDate,noBack);
    setFieldDisabled(backAmount,noBack);
    if(noBack){ backDate.value="Không"; backAmount.value="Không"; }
    else { if(backDate.value==="Không") backDate.value=""; if(backAmount.value==="Không") backAmount.value=""; }
    if(cardFee){
      mccCategory.value="";
      mcc.value="Không";
    }else{
      if(mcc.value==="Không") mcc.value="";
      if(mccCategory.value) mcc.value=state.mccCategories.find(item=>item.id===mccCategory.value)?.mcc || "";
    }
    setFieldDisabled(mccCategory,cardFee);
    setFieldDisabled(mcc,cardFee);
    setFieldDisabled(note,false);
  };
  status.addEventListener("change",apply);
  orderType.addEventListener("change",apply);
  mccCategory.addEventListener("change",apply);
  apply();
}
function normalizeTx(v, existingId, existing={}){
  const cardFee=isCardFeeOrderType(v.orderType);
  const mccCategory=cardFee ? null : state.mccCategories.find(item=>item.id===v.mccCategoryId) || transactionMccCategory(v);
  const status=cardFee ? "" : normalizeTransactionStatus(v.status);
  const personalUse=status===TRANSACTION_STATUS.PERSONAL_USE;
  return {...existing, ...v, id:existingId || uuid("TX"), date:toStorageDate(v.date), host:v.host ?? existing.host ?? "", orderType:String(v.orderType || "").trim(), category:mccCategory?.name || "", mccCategoryId:mccCategory?.id || "", backDate:cardFee || personalUse ? "" : toStorageDate(v.backDate), mcc:cardFee ? 0 : mccCode(mccCategory?.mcc ?? v.mcc), status, amount:normalizeMoney(v.amount, {emptyValue:0}), backAmount:cardFee || personalUse ? 0 : normalizeMoney(v.backAmount, {emptyValue:0})};
}
function transactionDifferencePercent(transaction){
  if(isCardFeeTransaction(transaction) || !isHostFeeApplicable(transaction)) return null;
  const amount=Number(transaction.amount)||0;
  if(amount===0) return null;
  return transactionDifference(transaction)/amount*100;
}
function transactionMonthlyTotals(transactions){
  const financialTxs=financialTransactions(transactions);
  const amount=sum(financialTxs,transaction=>transaction.amount);
  const backAmount=sum(financialTxs,transaction=>transaction.backAmount);
  const hostFeeRows=financialTxs.filter(transaction=>!isCardFeeTransaction(transaction) && isHostFeeApplicable(transaction));
  const hostFee=sum(hostFeeRows,transaction=>transactionDifference(transaction));
  const hostFeeBase=sum(hostFeeRows,transaction=>transaction.amount);
  return {amount,backAmount,hostFee,hostFeePercent:hostFeeBase===0?null:hostFee/hostFeeBase*100};
}
function renderTransactions(){
  const monthlyRows=[...periodTx()].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const matchingRows=monthlyRows.filter(transaction=>matchesTransactionFilters(transaction,transactionFilters,hostName));
  const rows=filteredRows("transactions", matchingRows, t=>`${formatTransactionDate(t.date)} ${formatTransactionDate(t.backDate)} ${t.orderType||""} ${t.category} ${t.mcc} ${t.cardId} ${transactionStatusLabel(normalizeTransactionStatus(t.status))} ${t.status} ${t.note||""}`);
  const totals=transactionMonthlyTotals(rows);
  const totalTone=totals.hostFee<0?"negative":totals.hostFee>0?"positive":"neutral";
  document.querySelector("#view-transactions").innerHTML=`<div class="card transactions-card"><div class="section-title"><h2>Danh sách giao dịch</h2><small>${rows.length}/${monthlyRows.length} dòng trong tháng</small></div>${transactionToolbar()}<div class="table-wrap"><table class="mobile-card-table transactions-table" data-entity="transactions"><thead><tr><th>Ngày</th><th>Thẻ</th><th>Loại đơn</th><th>MCC</th><th>Tiền đơn</th><th>Tiền về</th><th>Ngày về</th><th>Phí Host (%)</th><th>Phí Host (VNĐ)</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>
  <tr class="summary-row transaction-total-row"><td>TỔNG</td><td></td><td></td><td></td><td class="num tx-money-order">${formatMoneyDisplay(totals.amount)}</td><td class="num tx-money-return">${formatMoneyDisplay(totals.backAmount)}</td><td></td><td class="num ${totalTone}">${formatPercentDisplay(totals.hostFeePercent)}</td><td class="num tx-money-host-fee">${formatMoneyDisplay(totals.hostFee)}</td><td></td><td></td></tr>
  ${rows.map(t=>{ const note = String(t.note || t.notes || "").trim(); const cardFee=isCardFeeTransaction(t); const personalUse=normalizeTransactionStatus(t.status)===TRANSACTION_STATUS.PERSONAL_USE; const noBack=cardFee||personalUse; const hostFee=transactionHostFee(t); const tone=hostFee == null ? "neutral" : hostFee<0?"negative":hostFee>0?"positive":"neutral"; return `<tr data-id="${esc(t.id)}" class="${selectedRows.transactions===t.id?"selected":""}"><td>${esc(formatTransactionDate(t.date))}</td><td>${esc(t.cardId)}</td><td>${transactionOrderTypeBadge(t.orderType)}</td><td>${esc(t.mcc || "—")}</td><td class="num tx-money-order">${formatMoneyDisplay(t.amount)}</td><td class="num ${noBack?"neutral":"tx-money-return"}">${noBack ? "Không" : formatMoneyDisplay(t.backAmount)}</td><td>${noBack ? "Không" : esc(formatTransactionDate(t.backDate))}</td><td class="num ${tone}">${formatPercentDisplay(transactionDifferencePercent(t))}</td><td class="num ${hostFee == null?"neutral":"tx-money-host-fee"}">${hostFee == null ? "—" : formatMoneyDisplay(hostFee)}</td><td>${cardFee ? "Không" : txStatusBadge(t.status)}</td><td class="note-cell" title="${esc(note)}">${esc(note || "—")}</td></tr>`; }).join("")}</tbody></table></div></div>`;
  wireToolbar("transactions", {
    add: async()=>{ const v=await openForm("Thêm giao dịch", txFields(), {}, wireTxForm); if(!v) return; if(!v.cardId) return toast("Vui lòng chọn Card ID."); if(!v.orderType) return toast("Vui lòng chọn Loại đơn."); if(!isCardFeeOrderType(v.orderType)&&!v.mccCategoryId) return toast("Vui lòng chọn Nhóm MCC."); if(!isValidDate(v.date)) return toast("Ngày giao dịch không hợp lệ."); if(v.backDate && !isValidDate(v.backDate)) return toast("Ngày về không hợp lệ."); state.transactions.push(normalizeTx(v)); saveState("Đã lưu giao dịch"); },
    edit: async id=>{ const i=state.transactions.findIndex(x=>x.id===id); const v=await openForm("Chỉnh sửa giao dịch", txFields(state.transactions[i]), state.transactions[i], wireTxForm); if(!v) return; if(!v.cardId) return toast("Vui lòng chọn Card ID."); if(!v.orderType) return toast("Vui lòng chọn Loại đơn."); if(!isCardFeeOrderType(v.orderType)&&!v.mccCategoryId) return toast("Vui lòng chọn Nhóm MCC."); if(!isValidDate(v.date)) return toast("Ngày giao dịch không hợp lệ."); if(v.backDate && !isValidDate(v.backDate)) return toast("Ngày về không hợp lệ."); state.transactions[i]=normalizeTx(v,id,state.transactions[i]); saveState("Đã cập nhật giao dịch"); },
    remove: id=>{ if(!confirm("Xóa giao dịch đã chọn?")) return; state.transactions=state.transactions.filter(t=>t.id!==id); clearRowSelection("transactions"); saveState("Đã xóa giao dịch"); },
    bulkRemove:ids=>{const selected=new Set(ids);state.transactions=state.transactions.filter(transaction=>!selected.has(transaction.id));clearRowSelection("transactions");saveState(`Đã xóa ${ids.length} giao dịch`);}
  });
}

function paymentEffectiveDueDate(payment){
  const card=state.cards.find(item=>item.id===payment.cardId);
  return card ? effectivePaymentDueDateForCycle(card.paymentDueDay,payment.paymentCycle) : null;
}

function paymentToolbar(){
  const activeCount=Object.values(paymentFilters).filter(Boolean).length;
  const bankOptions=sortedUniqueFilterOptions(state.banks,bank=>bank.id,bank=>bank.name);
  const cardOptions=sortedUniqueFilterOptions(state.cards.filter(card=>card.cardType!=="debit"),card=>card.id,card=>card.id);
  const yearOptions=Array.from({length:5},(_,index)=>String(2026+index));
  const monthOptions=Array.from({length:12},(_,index)=>index+1);
  return `<div class="crud-toolbar transactions-toolbar payment-toolbar"><input data-search="payments" placeholder="Tìm thẻ, kỳ sao kê..."><select data-payment-statement-year>${yearOptions.map(year=>`<option value="${year}" ${Number(year)===Number(paymentStatementYear)?"selected":""}>${year}</option>`).join("")}</select><select data-payment-statement-month>${monthOptions.map(month=>`<option value="${month}" ${month===Number(paymentStatementMonth)?"selected":""}>Kỳ sao kê tháng ${month}</option>`).join("")}</select><button type="button" class="secondary-btn transaction-filter-trigger payment-filter-trigger ${activeCount?"active":""}" data-payment-filter-trigger>${icon("filter")}<span>Bộ lọc</span>${activeCount?`<b>${activeCount}</b>`:""}</button><button class="primary" data-add="payments">+ Thêm</button><button class="secondary-btn" data-edit="payments">Chỉnh sửa</button><button class="delete-btn" data-remove="payments">Xóa</button></div><div class="transaction-filter-panel payment-filter-panel" data-payment-filter-panel ${paymentFilterOpen?"":"hidden"}><select data-payment-filter="bankId">${cardFilterOptions(bankOptions,paymentFilters.bankId,"Ngân hàng",item=>item.value,item=>item.label)}</select><select data-payment-filter="cardId">${cardFilterOptions(cardOptions,paymentFilters.cardId,"Thẻ",item=>item.value,item=>item.label)}</select><select data-payment-filter="status">${cardFilterOptions([{value:"paid",label:"Đã thanh toán"},{value:"unpaid",label:"Chưa thanh toán"}],paymentFilters.status,"Trạng thái",item=>item.value,item=>item.label)}</select>${filterActionBar({apply:"data-payment-filter-apply",clear:"data-payment-filter-clear",cancel:"data-payment-filter-cancel"})}</div>`;
}
function paymentFields(row={}){
  return [
    {name:"cardId", label:"Thẻ", value:row.cardId || "", type:"text", readonly:true, formLayout:"transaction-form-grid"},
    {name:"statementPeriod", label:"Kỳ sao kê", value:row.statementPeriodLabel || "—", type:"text", readonly:true},
    {name:"dueDateDisplay", label:"Hạn thanh toán", value:row.dueDateLabel || "—", type:"text", readonly:true},
    {name:"statementBillAmount", label:"Bill sao kê", value:row.statementBillAmount || 0, type:"text", kind:"money"},
    {name:"paidAmount", label:"Đã thanh toán", value:row.paidAmount || 0, type:"text", kind:"money"},
    {name:"paymentDate", label:"Ngày thanh toán", value:row.paymentDate || "", type:"date"},
    {name:"outstandingDisplay", label:"Dư nợ kỳ này", value:formatMoneyDisplay(row.outstandingAmount || 0), type:"text", readonly:true},
    {name:"note", label:"Ghi chú", value:row.note || "", type:"text", layoutClass:"span-full"}
  ];
}
function paymentRowById(rows,id){
  return rows.find(row=>row.id===id) || rows.find(row=>statementPaymentRecordId(row.cardId,row.statementYear,row.statementMonth)===id);
}
function saveStatementPayment(row,values){
  const payment=normalizeStatementPayment({
    ...row,
    statementBillAmount:values.statementBillAmount,
    paidAmount:values.paidAmount,
    paymentDate:values.paymentDate,
    note:values.note
  },{cardId:row.cardId,statementYear:row.statementYear,statementMonth:row.statementMonth});
  const index=state.payments.findIndex(item=>item.id===payment.id || (item.cardId===payment.cardId && (item.statementCycle||item.paymentCycle)===payment.statementCycle));
  if(index>=0) state.payments[index]=payment; else state.payments.push(payment);
  selectedRows.payments=payment.id;
}
function renderPayments(){
  const allRows=buildStatementPaymentRows(state.cards,state.payments,paymentStatementYear,paymentStatementMonth,paymentFilters).sort((a,b)=>compareVietnameseText(cardName(a.cardId),cardName(b.cardId)));
  const rows=filteredRows("payments", allRows, row=>`${row.cardId} ${row.statementPeriodLabel} ${row.dueDateLabel} ${row.statementBillAmount} ${row.paidAmount} ${formatDayMonth(row.paymentDate,{emptyText:""})} ${row.outstandingAmount} ${row.paymentStatusLabel} ${row.paymentReminder} ${row.note||""}`);
  const summary=summarizeStatementPaymentRows(rows);
  document.querySelector("#view-payments").innerHTML=`<div class="card payments-card"><div class="section-title"><h2>Thanh toán thẻ</h2><small>${rows.length} thẻ trong kỳ sao kê</small></div>${paymentToolbar()}<div class="table-wrap payment-table-wrap"><table class="mobile-card-table payment-table" data-entity="payments"><thead><tr><th>Thẻ</th><th>Kỳ sao kê</th><th>Hạn thanh toán</th><th>Bill sao kê</th><th>Đã thanh toán</th><th>Ngày thanh toán</th><th>Dư nợ kỳ này</th><th>Trạng thái</th><th>Tiến độ / Nhắc nhở</th></tr></thead><tbody>${rows.map(row=>`<tr data-id="${esc(row.id)}" class="${selectedRows.payments===row.id?"selected":""}"><td>${esc(row.cardId)}</td><td>${esc(row.statementPeriodLabel)}</td><td>${esc(row.dueDateLabel)}</td><td class="num payment-bill-cell">${formatMoneyDisplay(row.statementBillAmount)}</td><td class="num payment-paid-cell">${formatMoneyDisplay(row.paidAmount)}</td><td>${esc(formatDayMonth(row.paymentDate,{emptyText:"—"}))}</td><td class="num payment-outstanding-cell">${formatMoneyDisplay(row.outstandingAmount)}</td><td class="payment-status-cell payment-status-${esc(row.paymentStatusCode)}">${esc(row.paymentStatusLabel)}</td><td class="payment-reminder-cell payment-reminder-${esc(row.paymentReminderTone)}">${esc(row.paymentReminder)}</td></tr>`).join("")}</tbody><tfoot><tr class="summary-row payment-total-row"><td>Tổng: ${summary.count} thẻ</td><td></td><td></td><td class="num payment-bill-cell">${formatMoneyDisplay(summary.statementBillAmount)}</td><td class="num payment-paid-cell">${formatMoneyDisplay(summary.paidAmount)}</td><td></td><td class="num payment-outstanding-cell">${formatMoneyDisplay(summary.outstandingAmount)}</td><td></td><td></td></tr></tfoot></table></div></div>`;
  wireToolbar("payments", {
    add: async()=>{ const row=selectedRows.payments ? paymentRowById(rows,selectedRows.payments) : rows[0]; if(!row) return toast("Không có thẻ phù hợp kỳ sao kê."); const v=await openForm("Thêm thanh toán", paymentFields(row), row); if(!v) return; if(v.paymentDate && !isValidDate(v.paymentDate)) return toast("Ngày thanh toán không hợp lệ."); saveStatementPayment(row,v); saveState("Đã lưu thanh toán"); },
    edit: async id=>{ const row=paymentRowById(rows,id); if(!row) return; const v=await openForm("Chỉnh sửa thanh toán", paymentFields(row), row); if(!v) return; if(v.paymentDate && !isValidDate(v.paymentDate)) return toast("Ngày thanh toán không hợp lệ."); saveStatementPayment(row,v); saveState("Đã cập nhật thanh toán"); },
    remove: id=>{ const row=paymentRowById(rows,id); if(!row) return; if(!confirm("Xóa dữ liệu thanh toán của thẻ trong kỳ này?")) return; state.payments=state.payments.filter(payment=>!(payment.id===row.id || (payment.cardId===row.cardId && (payment.statementCycle||payment.paymentCycle)===row.statementCycle))); clearRowSelection("payments"); saveState("Đã xóa thanh toán"); },
    bulkRemove:ids=>{const selected=new Set(ids);const selectedRowsForPeriod=rows.filter(row=>selected.has(row.id));state.payments=state.payments.filter(payment=>!selectedRowsForPeriod.some(row=>payment.id===row.id || (payment.cardId===row.cardId && (payment.statementCycle||payment.paymentCycle)===row.statementCycle)));clearRowSelection("payments");saveState(`Đã xóa ${selectedRowsForPeriod.length} khoản thanh toán`);}
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
  const sorted=[...state.mccCategories].sort((left,right)=>mccCode(left.mcc).localeCompare(mccCode(right.mcc),undefined,{numeric:true,sensitivity:"base"})||compareVietnameseText(left.name,right.name));
  const rows=filteredRows("mcc", sorted, c=>`${c.name} ${c.mcc??""} ${c.notes||""}`);
  const fields=[{name:"name",label:"Loại chi tiêu",type:"text"},{name:"mcc",label:"Mã MCC",type:"text",required:true},{name:"notes",label:"Ghi chú",type:"textarea",layoutClass:"span-full"}];
  document.querySelector("#view-mcc").innerHTML=`<div class="card"><div class="section-title"><h2>Nhóm MCC</h2><small>Dùng cho rule Cashback và giao dịch</small></div>${toolbar("mcc")}<div class="table-wrap"><table data-entity="mcc"><thead><tr><th>Loại chi tiêu</th><th>MCC</th><th>Số giao dịch</th><th>Ghi chú</th></tr></thead><tbody>${rows.map(c=>`<tr data-id="${esc(c.id)}" class="${selectedRows.mcc===c.id?"selected":""}"><td>${esc(c.name)}</td><td>${esc(c.mcc)}</td><td class="num">${state.transactions.filter(t=>t.category===c.name).length}</td><td class="note-cell" title="${esc(c.notes||"")}">${esc(c.notes||"—")}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("mcc", {
    add: async()=>{ const v=await openForm("Thêm nhóm MCC", fields); if(!v) return; const mcc=mccCode(v.mcc); if(!mcc) return toast("Vui lòng nhập Mã MCC."); state.mccCategories.push({id:uuid("MCC"),name:v.name,mcc,notes:String(v.notes||"")}); saveState("Đã thêm nhóm MCC"); },
    edit: async id=>{ const i=state.mccCategories.findIndex(x=>x.id===id); const old=state.mccCategories[i].name; const v=await openForm("Chỉnh sửa nhóm MCC", fields, state.mccCategories[i]); if(!v) return; const mcc=mccCode(v.mcc); if(!mcc) return toast("Vui lòng nhập Mã MCC."); state.mccCategories[i]={...state.mccCategories[i],name:v.name,mcc,notes:String(v.notes||"")}; state.transactions.forEach(t=>{ if(t.mccCategoryId===id || t.category===old){ t.mccCategoryId=id; t.category=v.name; t.mcc=mcc; } }); state.cashbackPrograms.forEach(p=>{ const conditions=normalizeCashbackConditions(p,state.mccCategories);conditions.forEach(condition=>{if((condition.mccCategoryIds||[]).includes(id))condition.categories=(condition.mccCategoryIds||[]).map(categoryId=>state.mccCategories.find(x=>x.id===categoryId)?.name).filter(Boolean);});p.conditions=conditions;const first=conditions[0];if((first.mccCategoryIds||[]).includes(id))p.categories=first.categories; }); saveState("Đã cập nhật nhóm MCC"); },
    remove: id=>{ const c=state.mccCategories.find(x=>x.id===id); if(state.transactions.some(t=>t.category===c.name)) return toast("Không thể xóa nhóm MCC đang có giao dịch."); if(state.cashbackPrograms.some(p=>normalizeCashbackConditions(p,state.mccCategories).some(condition=>!condition.allMcc&&(condition.mccCategoryIds||[]).includes(id)))) return toast("Không thể xóa nhóm MCC đang được chương trình cashback sử dụng."); if(!confirm("Xóa nhóm MCC đã chọn?")) return; state.mccCategories=state.mccCategories.filter(x=>x.id!==id); clearRowSelection("mcc"); saveState("Đã xóa nhóm MCC"); },
    bulkRemove:ids=>{const blocked=ids.filter(id=>{const category=state.mccCategories.find(item=>item.id===id);return category&&(state.transactions.some(transaction=>transaction.category===category.name)||state.cashbackPrograms.some(program=>normalizeCashbackConditions(program,state.mccCategories).some(condition=>!condition.allMcc&&(condition.mccCategoryIds||[]).includes(id))));});if(blocked.length)return toast(`Không thể xóa ${blocked.length} nhóm MCC đang được sử dụng.`);const selected=new Set(ids);state.mccCategories=state.mccCategories.filter(category=>!selected.has(category.id));clearRowSelection("mcc");saveState(`Đã xóa ${ids.length} nhóm MCC`);}
  });
}

function orderTypeFields(item={}){
  return [
    {name:"name",label:"Mã loại đơn",value:item.name || "",type:"text",required:true},
    {name:"color",label:"Màu",value:normalizeOrderTypeColor(item.color) || orderTypeDefaultColor(item.name),type:"color"},
    {name:"description",label:"Mô tả",value:item.description || "",type:"text"},
    {name:"note",label:"Ghi chú",value:item.note || "",type:"textarea",layoutClass:"span-full"}
  ];
}

function renderOrderTypes(){
  const rows=filteredRows("orderTypes",sortDisplayRows(state.orderTypes || [],item=>item.name),item=>`${item.name} ${item.description||""} ${item.note||""}`);
  document.querySelector("#view-order-types").innerHTML=`<div class="card"><div class="section-title"><h2>Loại đơn</h2><small>Danh mục dùng trong giao dịch</small></div>${toolbar("orderTypes")}<div class="table-wrap"><table data-entity="orderTypes"><thead><tr><th>Mã loại đơn</th><th>Màu</th><th>Mô tả</th><th>Ghi chú</th></tr></thead><tbody>${rows.map(item=>`<tr data-id="${esc(item.id)}" class="${selectedRows.orderTypes===item.id?"selected":""}"><td><strong>${esc(item.name)}</strong></td><td><span class="order-type-color"><i style="--order-type-color:${esc(normalizeOrderTypeColor(item.color)||orderTypeDefaultColor(item.name))}"></i>${esc(normalizeOrderTypeColor(item.color)||orderTypeDefaultColor(item.name))}</span></td><td>${esc(item.description || "—")}</td><td class="note-cell" title="${esc(item.note || "")}">${esc(item.note || "—")}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireToolbar("orderTypes",{
    add:async()=>{const values=await openForm("Thêm Loại đơn",orderTypeFields());if(!values)return;const name=String(values.name||"").trim();if(!name)return toast("Vui lòng nhập mã loại đơn.");if(state.orderTypes.some(item=>item.name.toLocaleLowerCase("vi")===name.toLocaleLowerCase("vi")))return toast("Mã loại đơn đã tồn tại.");state.orderTypes.push({id:uuid("ORDER-TYPE"),name,color:normalizeOrderTypeColor(values.color)||orderTypeDefaultColor(name),description:String(values.description||"").trim(),note:String(values.note||"").trim()});saveState("Đã thêm Loại đơn");},
    edit:async id=>{const index=state.orderTypes.findIndex(item=>item.id===id);const current=state.orderTypes[index];if(!current)return;const values=await openForm("Tùy chỉnh Loại đơn",orderTypeFields(current),current);if(!values)return;const name=String(values.name||"").trim();if(!name)return toast("Vui lòng nhập mã loại đơn.");if(state.orderTypes.some(item=>item.id!==id&&item.name.toLocaleLowerCase("vi")===name.toLocaleLowerCase("vi")))return toast("Mã loại đơn đã tồn tại.");state.orderTypes[index]={...current,name,color:normalizeOrderTypeColor(values.color)||orderTypeDefaultColor(name),description:String(values.description||"").trim(),note:String(values.note||"").trim()};state.transactions.forEach(transaction=>{if(transaction.orderType===current.name)transaction.orderType=name;});saveState("Đã cập nhật Loại đơn");},
    remove:id=>{const item=state.orderTypes.find(value=>value.id===id);if(!item)return;const used=state.transactions.filter(transaction=>transaction.orderType===item.name).length;if(!confirm(`Xóa “${item.name}”${used?` và giữ nguyên ${used} giao dịch đang tham chiếu`:""}?`))return;state.orderTypes=state.orderTypes.filter(value=>value.id!==id);clearRowSelection("orderTypes");saveState("Đã xóa Loại đơn");},
    bulkRemove:ids=>{const selected=new Set(ids);const used=state.transactions.filter(transaction=>state.orderTypes.some(item=>selected.has(item.id)&&item.name===transaction.orderType)).length;if(!confirm(`Xóa ${ids.length} Loại đơn${used?` và giữ nguyên ${used} giao dịch đang tham chiếu`:""}?`))return;state.orderTypes=state.orderTypes.filter(item=>!selected.has(item.id));clearRowSelection("orderTypes");saveState(`Đã xóa ${ids.length} Loại đơn`);}
  });
}
const INSURANCE_SCREENSHOT_EXAMPLES=[
  {index:1,title:"XÁC NHẬN THÔNG TIN THANH TOÁN",src:"assets/insurance-confirmation-example.png",alt:"Ảnh minh họa màn hình xác nhận thông tin thanh toán"},
  {index:2,title:"BIÊN LAI THANH TOÁN",src:"assets/insurance-receipt-example.png",alt:"Ảnh minh họa biên lai thanh toán"}
];
let insuranceSearch="";
function insurancePaymentReminderMarkup(){
  return `<section class="insurance-warning" aria-label="Lưu ý quan trọng khi thanh toán đơn bảo hiểm">
    <div class="insurance-warning-head">
      <span class="insurance-warning-icon">${icon("triangle-alert")}</span>
      <div>
        <h3>Lưu ý quan trọng khi thanh toán đơn bảo hiểm</h3>
        <p>Trước khi mở link và hoàn tất thanh toán, cần chụp đủ 2 ảnh màn hình để đối soát khi cần.</p>
      </div>
    </div>
    <div class="insurance-warning-list">
      <div class="insurance-warning-item critical">
        <strong>1. XÁC NHẬN THÔNG TIN THANH TOÁN</strong>
        <span><b>Lưu ý:</b> màn hình này chỉ xuất hiện 1 lần. Nếu quên chụp sẽ rất khó đối soát về sau.</span>
      </div>
      <div class="insurance-warning-item">
        <strong>2. BIÊN LAI THANH TOÁN</strong>
      </div>
    </div>
    <p class="insurance-warning-summary">Trước khi rời khỏi trang thanh toán, hãy đảm bảo đã chụp đủ cả 2 ảnh màn hình trên.</p>
    <div class="insurance-example-grid">
      ${INSURANCE_SCREENSHOT_EXAMPLES.map(example=>`<button type="button" class="insurance-example-card" data-insurance-preview="${esc(example.src)}" data-insurance-preview-title="${esc(`${example.index}. ${example.title}`)}">
        <span>${esc(`${example.index}. ${example.title}`)}</span>
        <img src="${esc(example.src)}" alt="${esc(example.alt)}" loading="lazy">
      </button>`).join("")}
    </div>
  </section>`;
}
function renderInsuranceLinks(){
  const root=document.querySelector("#view-insurance-links");if(!root)return;
  const query=insuranceSearch.trim().toLocaleLowerCase("vi"),rows=INSURANCE_LINKS.filter(item=>!query||`${item.name} ${item.url}`.toLocaleLowerCase("vi").includes(query));
  root.innerHTML=`<div class="card"><div class="section-title"><h2>Link Bảo Hiểm</h2><small>${rows.length}/${INSURANCE_LINKS.length} link</small></div>${insurancePaymentReminderMarkup()}<div class="insurance-toolbar"><input data-insurance-search placeholder="Tìm bảo hiểm hoặc link..." value="${esc(insuranceSearch)}"></div><div class="table-wrap"><table data-insurance-table><thead><tr><th>STT</th><th>Bảo hiểm</th><th>Link thanh toán</th><th>Mở link</th></tr></thead><tbody>${rows.map(item=>`<tr><td>${item.index}</td><td>${esc(item.name)}</td><td><span class="insurance-url" title="${esc(item.url)}">${esc(item.url)}</span><button type="button" class="icon-btn insurance-copy" data-copy-insurance="${esc(item.url)}" title="Sao chép link" aria-label="Sao chép link">${icon("copy")}</button></td><td><a class="icon-btn" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" title="Mở link" aria-label="Mở link">${icon("external")}</a></td></tr>`).join("")}</tbody></table></div></div>`;
  root.querySelector("[data-insurance-search]")?.addEventListener("input",event=>{insuranceSearch=event.target.value;renderInsuranceLinks();});
  root.querySelectorAll("[data-copy-insurance]").forEach(button=>button.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(button.dataset.copyInsurance);toast("Đã sao chép link");}catch{toast("Không thể sao chép link");}}));
  root.querySelectorAll("[data-insurance-preview]").forEach(button=>button.addEventListener("click",()=>openInsurancePreview(button.dataset.insurancePreview,button.dataset.insurancePreviewTitle)));
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
    <div class="table-wrap top-space"><table><thead><tr><th>Thẻ</th><th>Ngân hàng</th><th>Card ID</th><th>Hạn mức</th></tr></thead><tbody>${state.cards.map(c=>`<tr class="${c.cardType==="debit"?"debit-row":""}"><td>${esc(cardTypeLabel(c.cardType))}</td><td>${esc(bankName(c.bankId,c.bank))}</td><td>${esc(c.id)}</td><td class="num">${c.cardType==="debit"?"—":formatMoneyDisplay(c.groupLimit)}</td></tr>`).join("")}</tbody></table></div>
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


async function openTrackingTransaction(preset={}){
  const draft={
    date:todayStorageDate(),
    cardId:preset.cardId||"",
    host:preset.host||"",
    mccCategoryId:preset.mccCategoryId||""
  };
  const v=await openForm("Thêm giao dịch",txFields(draft),draft,wireTxForm);
  if(!v)return;
  if(!v.cardId)return toast("Vui lòng chọn Card ID.");
  if(!v.orderType)return toast("Vui lòng chọn Loại đơn.");
  if(!isCardFeeOrderType(v.orderType)&&!v.mccCategoryId)return toast("Vui lòng chọn Nhóm MCC.");
  if(!isValidDate(v.date))return toast("Ngày giao dịch không hợp lệ.");
  if(v.backDate&&!isValidDate(v.backDate))return toast("Ngày về không hợp lệ.");
  state.transactions.push(normalizeTx(v));
  saveState("Đã lưu giao dịch");
}
function renderTracking(){
  const root=document.querySelector("#view-tracking");
  if(!root)return;
  root.innerHTML='<div class="coord-workspace matrix-primary-workspace"><div data-tracking-matrix-root></div></div>';
  mountTrackingMatrix(
    root.querySelector('[data-tracking-matrix-root]'),
    ()=>state,
    ()=>({year:selectedYear,month:selectedMonth}),
    {
      getState:()=>state,
      addOrder:preset=>openTrackingTransaction(preset),
      viewTransactions:cell=>{
        transactionFilters.cardId=cell.card.id;
        transactionFilters.host=cell.host.name;
        transactionFilterOpen=false;
        renderTransactions();
        setView("transactions");
      }
    }
  );
}

function renderAll(){
  removeFilterPanelOutsideListener();
  closeTableContextMenu();
  renderDashboard(); renderTransactions(); renderTracking(); renderCards(); renderPrograms(); renderCashbackReceipts(); renderFeeTargets(); renderPayments(); renderHosts(); renderMcc(); renderOrderTypes(); renderInsuranceLinks(); renderBanks(); renderAbout(); renderSyncStatus(); renderSetupWizard(); renderLoginGate();
  labelResponsiveTables();
  enhanceResponsiveRecordLists();
  attachResizableTables();
  syncTransactionTableStickyOffset();
  syncCardsTableStickyOffset();
  syncFeeTargetTableStickyOffset();
  refreshOpenPaymentWarningDialog();
}

const CARD_FEE_TYPES=[{value:"annual_fee",label:"Phí thường niên"},{value:"management_fee",label:"Phí quản lý"}];
function feeTypeLabel(value){ return CARD_FEE_TYPES.find(option=>option.value===value)?.label || "Phí thường niên"; }
function feeTargetMetrics(){
  const cardsById=new Map(state.cards.map(card=>[card.id,card]));
  return sortFeeTargetMetrics((state.feeTargets||[]).map(target=>calculateFeeTargetMetrics(feeTargetWithCardSources(target,cardsById.get(target.cardId)),state.transactions,state.mccCategories)));
}
function feeTargetFields(target={}){
  const cardOptions=sortedUniqueFilterOptions(state.cards,card=>card.id,card=>card.id);
  const selectedCard=state.cards.find(card=>card.id===(target.cardId||cardOptions[0]?.value));
  const feeType=target.feeType||"annual_fee";
  return [
    {name:"cardId",label:"Thẻ",value:target.cardId||"",type:"select",required:true,options:[{value:"",label:"Chọn Card ID"},...cardOptions]},
    {name:"feeType",label:"Loại phí",value:feeType,type:"select",required:true,options:CARD_FEE_TYPES},
    {name:"feeAmount",label:"Phí thẻ lý thuyết",value:feeAmountForTarget({...target,feeType},selectedCard),type:"text",kind:"money"},
    {name:"activationDate",label:"Ngày kích hoạt thẻ",value:activationDateForFeeTarget(target,selectedCard),type:"date",readonly:true,hint:"Lấy từ Bảng Thẻ."},
    {name:"deadline",label:"Hạn chốt",value:target.deadline||target.periodEnd||todayStorageDate(),type:"date",required:true},
    {name:"targetAmount",label:"Chỉ tiêu hoàn phí",value:target.targetAmount??0,type:"text",kind:"money"},
    {name:"notes",label:"Ghi chú",value:target.notes||"",type:"textarea"}
  ];
}
function wireFeeTargetForm(modal,target={}){
  const cardSelect=modal.querySelector('[name="cardId"]'),activationInput=modal.querySelector('[name="activationDate"]');
  const refresh=()=>{
    const card=state.cards.find(item=>item.id===cardSelect?.value);
    if(activationInput) activationInput.value=activationDateForFeeTarget({},card);
  };
  cardSelect?.addEventListener("change",refresh);
  refresh();
}
function normalizeFeeTargetValues(values,existing={}){
  const card=state.cards.find(item=>item.id===values.cardId);
  if(!values.cardId || !card) return {error:"Vui lòng chọn thẻ."};
  if(!CARD_FEE_TYPES.some(option=>option.value===values.feeType)) return {error:"Loại phí không hợp lệ."};
  const duplicate=(state.feeTargets||[]).find(item=>item.id!==existing.id&&item.cardId===values.cardId&&item.feeType===values.feeType);
  if(duplicate) return {error:`${values.cardId} đã có ${feeTypeLabel(values.feeType)}. Vui lòng chỉnh sửa bản ghi hiện có.`};
  const feeAmount=normalizeMoney(values.feeAmount,{emptyValue:0});
  const targetAmount=normalizeMoney(values.targetAmount,{emptyValue:0});
  if(feeAmount<0) return {error:"Mức phí phải lớn hơn hoặc bằng 0."};
  if(targetAmount<0) return {error:"Chỉ tiêu hoàn phí phải lớn hơn hoặc bằng 0."};
  const activationDate=toStorageDate(card.activationDate),deadline=toStorageDate(values.deadline);
  if(!isValidDate(activationDate)) return {error:"Vui lòng thiết lập Ngày kích hoạt trong Bảng Thẻ trước."};
  if(!isValidDate(deadline)) return {error:"Hạn chốt không hợp lệ."};
  if(deadline<activationDate) return {error:"Hạn chốt phải từ ngày kích hoạt thẻ trở đi."};
  const periodStart=activationDate,periodEnd=deadline;
  const id=existing.id||buildFeeTargetId(values.cardId,values.feeType,periodStart,(state.feeTargets||[]).map(item=>item.id));
  const target={...existing,...values,id,feeAmount,targetAmount,activationDate,deadline,periodStart,periodEnd,allMcc:existing.allMcc??true,mccCategoryIds:existing.mccCategoryIds||[],channel:existing.channel||"all",conditionType:"spend_target",reminderEnabled:existing.reminderEnabled!==false,notes:String(values.notes||"")};
  return {target};
}
function renderFeeTargets(){
  const typeRank={annual_fee:0,management_fee:1};
  const cardsById=new Map(state.cards.map(card=>[card.id,card]));
  const grouped=feeTargetMetrics().map(item=>{
    const card=cardsById.get(item.cardId);
    return {...item,actualFeeAmount:actualFeeAmountForTarget(item),card,bankId:card?.bankId||"",bankLabel:card?cardBankName(card):"—"};
  }).sort((a,b)=>compareVietnameseText(a.bankLabel,b.bankLabel)||compareVietnameseText(a.cardId,b.cardId)||(typeRank[a.feeType]??9)-(typeRank[b.feeType]??9)||compareVietnameseText(a.id,b.id));
  const matching=grouped.filter(item=>feeTargetMatchesFilters(item,feeTargetFilters));
  const rows=filteredRows("feeTargets",matching,item=>`${item.bankLabel} ${item.cardId} ${feeTypeLabel(item.feeType)} ${item.feeAmount} ${item.actualFeeAmount} ${item.notes||""}`);
  const mergeFeeGroups=window.matchMedia?.("(min-width: 768px)")?.matches!==false;
  const summary=summarizeFeeTargets(rows);
  document.querySelector("#view-fee-targets").innerHTML=`<div class="card fee-targets-card"><div class="section-title"><h2>Phí thẻ</h2><small>${rows.length} khoản phí</small></div>${feeTargetToolbar()}<div class="table-wrap fee-target-table-wrap"><table class="mobile-card-table fee-target-table" data-entity="feeTargets"><thead><tr><th data-column-key="bankId">Ngân hàng</th><th data-column-key="cardId">Thẻ</th><th data-column-key="feeType">Loại phí</th><th data-column-key="feeAmount">Phí thẻ lý thuyết</th><th data-column-key="actualFeeAmount">Phí thẻ thực tế</th><th data-column-key="activationDate">Ngày kích hoạt thẻ</th><th data-column-key="deadline">Hạn chót</th><th data-column-key="waiverTarget">Chỉ tiêu hoàn phí</th><th data-column-key="remaining">Còn thiếu</th><th data-column-key="note">Ghi chú</th></tr></thead><tbody><tr class="summary-row fee-total-row"><td>TỔNG</td><td></td><td></td><td class="num card-fee-amount">${formatMoneyDisplay(summary.feeAmount)}</td><td class="num positive">${formatMoneyDisplay(summary.actualFeeAmount)}</td><td></td><td></td><td class="num">${formatMoneyDisplay(summary.targetAmount)}</td><td></td><td></td></tr>${rows.map((item,index)=>{const bankSpan=mergeFeeGroups?consecutiveGroupSpan(rows,index,row=>row.bankId||row.bankLabel):1,cardSpan=mergeFeeGroups?consecutiveGroupSpan(rows,index,row=>`${row.bankId||row.bankLabel}|${row.cardId}`):1;return `<tr data-id="${esc(item.id)}" class="${item.card?.cardType==="debit"?"debit-row ":""}${selectedRows.feeTargets===item.id?"selected":""}">${bankSpan?`<td rowspan="${bankSpan}" class="cashback-bank-cell fee-bank-cell">${esc(item.bankLabel)}</td>`:""}${cardSpan?`<td rowspan="${cardSpan}" class="fee-card-id-cell">${esc(item.cardId)}</td>`:""}<td>${esc(feeTypeLabel(item.feeType))}</td><td class="num card-fee-amount" data-mobile-label="Phí thẻ lý thuyết">${formatMoneyDisplay(item.feeAmount)}</td><td class="num positive" data-mobile-label="Phí thẻ thực tế">${formatMoneyDisplay(item.actualFeeAmount)}</td><td>${esc(formatDateDisplay(item.activationDate,{emptyText:"—"}))}</td><td>${esc(formatDateDisplay(item.deadline||item.periodEnd,{emptyText:"—"}))}</td><td class="num">${formatMoneyDisplay(item.targetAmount)}</td><td class="num">${formatMoneyDisplay(item.remainingAmount)}</td><td class="note-cell" title="${esc(item.notes||"")}">${esc(item.notes||"—")}</td></tr>`;}).join("")}</tbody></table></div></div>`;
  document.querySelector('#view-fee-targets [data-column-key="deadline"]').textContent="Hạn chốt";
  const handlers={
    add:async()=>{ if(!state.cards.length) return toast("Vui lòng thêm Thẻ trước."); const values=await openForm("Thêm phí thẻ",feeTargetFields(),{},modal=>wireFeeTargetForm(modal)); if(!values) return; const result=normalizeFeeTargetValues(values); if(result.error) return toast(result.error); state.feeTargets.push(result.target); selectedRows.feeTargets=result.target.id; saveState("Đã thêm phí thẻ"); },
    edit:async id=>{ const index=state.feeTargets.findIndex(item=>item.id===id); const existing=state.feeTargets[index]; if(!existing) return; const values=await openForm("Chỉnh sửa phí thẻ",feeTargetFields(existing),existing,modal=>wireFeeTargetForm(modal,existing)); if(!values) return; const result=normalizeFeeTargetValues(values,existing); if(result.error) return toast(result.error); state.feeTargets[index]=result.target; selectedRows.feeTargets=id; saveState("Đã cập nhật phí thẻ"); },
    remove:id=>{ if(!confirm("Xóa phí thẻ đã chọn?")) return; state.feeTargets=state.feeTargets.filter(item=>item.id!==id); clearRowSelection("feeTargets"); saveState("Đã xóa phí thẻ"); },
    bulkRemove:ids=>{const selected=new Set(ids);state.feeTargets=state.feeTargets.filter(target=>!selected.has(target.id));clearRowSelection("feeTargets");saveState(`Đã xóa ${ids.length} khoản phí thẻ`);}
  };
  wireToolbar("feeTargets",handlers);
}
function labelResponsiveTables(){
  document.querySelectorAll("table.mobile-card-table,table[data-entity],table[data-accordion-entity]").forEach(table=>{
    const labels=[...table.querySelectorAll("thead th")].map(th=>th.textContent.trim());
    const occupied=[];
    [...table.querySelectorAll("tbody tr")].forEach((row,rowIndex)=>{
      occupied[rowIndex]||=[];
      let logicalIndex=0;
      [...row.children].forEach(cell=>{
        while(occupied[rowIndex][logicalIndex]) logicalIndex+=1;
        cell.dataset.label=labels[logicalIndex] || "";
        const colSpan=Math.max(1,Number(cell.colSpan)||1),rowSpan=Math.max(1,Number(cell.rowSpan)||1);
        for(let r=rowIndex;r<rowIndex+rowSpan;r+=1){
          occupied[r]||=[];
          for(let c=logicalIndex;c<logicalIndex+colSpan;c+=1) occupied[r][c]=true;
        }
        logicalIndex+=colSpan;
      });
    });
  });
}
function syncTransactionTableStickyOffset(){
  const wrapper=document.querySelector("#view-transactions .table-wrap");
  const header=document.querySelector("#view-transactions .transactions-table thead");
  if(!wrapper||!header)return;
  wrapper.style.setProperty("--transaction-header-height",`${Math.ceil(header.getBoundingClientRect().height)}px`);
}
function syncCardsTableStickyOffset(){
  const wrapper=document.querySelector("#view-cards .cards-table-wrap");
  const header=document.querySelector("#view-cards .cards-table thead");
  if(!wrapper||!header)return;
  wrapper.style.setProperty("--cards-header-height",`${Math.ceil(header.getBoundingClientRect().height)}px`);
}
function syncFeeTargetTableStickyOffset(){
  const wrapper=document.querySelector("#view-fee-targets .fee-target-table-wrap");
  const header=document.querySelector("#view-fee-targets .fee-target-table thead");
  if(!wrapper||!header)return;
  wrapper.style.setProperty("--fee-target-header-height",`${Math.ceil(header.getBoundingClientRect().height)}px`);
}
window.addEventListener("resize",()=>{
  if(currentView==="transactions")syncTransactionTableStickyOffset();
  const cardsTable=document.querySelector("#view-cards .cards-table");
  if(cardsTable){syncStickyColumns(cardsTable,cardsTable.dataset.stickyThrough.split("|"));syncCardsTableStickyOffset();}
  syncFeeTargetTableStickyOffset();
});
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
  document.body.classList.toggle("transactions-view-active",name==="transactions");
  document.body.classList.toggle("fee-targets-view-active",name==="fee-targets");
  if(name==="programs") ensureCashbackProgramsForSelectedPeriod();
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
  const meta = VIEW_META[name] || {title:name, description:""};
  document.querySelector(".topbar h1").textContent = meta.title;
  document.querySelector("#subtitle").textContent = meta.description;
  const helpButton=document.querySelector('.context-help');
  if(helpButton) helpButton.hidden=name==='about';
  document.querySelector('.period-filter')?.classList.toggle('page-context-hidden',meta.showPeriodFilter===false||name==='about'||MASTER_DATA_VIEWS.has(name));
  document.querySelector('.drive-panel')?.classList.toggle('page-context-hidden',name==='about');
  if(name==="transactions")syncTransactionTableStickyOffset();
  setSidebarOpen(false);
}

function renderSyncStatus(){
  const meta=localRepository.loadMeta();
  const labels={synced:"Đã đồng bộ",syncing:"Đang đồng bộ...",dirty:"Chưa đồng bộ",conflict:"Có xung đột",disconnected:"Chưa kết nối Google Drive"};
  document.querySelector("#driveStatusText").textContent=labels[meta.status] || (meta.dirty ? labels.dirty : labels.disconnected);
  document.querySelector("#driveStatusText").className=`drive-state ${meta.status||"disconnected"}`;
  document.querySelector("#lastSyncTime").textContent=meta.lastSyncAt ? `Lần cuối: ${formatDateTimeDisplay(meta.lastSyncAt)}` : "Chưa có lần đồng bộ thành công";
  const connected = isConnected() && auth.hasToken();
  document.querySelector("#connectDrive").disabled=isManualConnecting() || connected;
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
    button.disabled = isManualConnecting();
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
    "Thẻ": t.cardId,
    "Loại đơn": t.orderType || "",
    "MCC": t.mcc,
    "Tiền đơn": t.amount,
    "Tiền về": isCardFeeTransaction(t) || normalizeTransactionStatus(t.status)===TRANSACTION_STATUS.PERSONAL_USE ? "Không" : t.backAmount,
    "Ngày về": isCardFeeTransaction(t) || normalizeTransactionStatus(t.status)===TRANSACTION_STATUS.PERSONAL_USE ? "Không" : excelDateValue(t.backDate),
    "Phí Host (%)": transactionDifferencePercent(t),
    "Phí Host (VNĐ)": transactionHostFee(t),
    "Trạng thái": isCardFeeTransaction(t) ? "Không" : transactionStatusLabel(normalizeTransactionStatus(t.status)),
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
function openRefundGuide(){document.querySelector("#refundGuideModal")?.classList.add("show");}
function closeRefundGuide(){document.querySelector("#refundGuideModal")?.classList.remove("show");}
document.querySelector("[data-close-refund-guide]")?.addEventListener("click",closeRefundGuide);
document.querySelector("#refundGuideModal")?.addEventListener("click",event=>{if(event.target.id==="refundGuideModal")closeRefundGuide();});
function openInsurancePreview(src,title){
  const modal=document.querySelector("#insurancePreviewModal"),image=modal?.querySelector("[data-insurance-preview-image]"),heading=modal?.querySelector("#insurancePreviewTitle");
  if(!modal||!image||!heading)return;
  image.src=src||"";
  image.alt=title||"Ảnh minh họa";
  heading.textContent=title||"Ảnh minh họa";
  modal.classList.add("show");
}
function closeInsurancePreview(){document.querySelector("#insurancePreviewModal")?.classList.remove("show");}
document.querySelector("[data-close-insurance-preview]")?.addEventListener("click",closeInsurancePreview);
document.querySelector("#insurancePreviewModal")?.addEventListener("click",event=>{if(event.target.id==="insurancePreviewModal")closeInsurancePreview();});
document.addEventListener("keydown",event=>{ if(event.key==="Escape"){setSidebarOpen(false);closeTableContextMenu();closeRefundGuide();closeInsurancePreview();} });
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
  if(!auth.isConfigured()){
    const message = "Chưa cấu hình Google OAuth Client ID.";
    logGoogleAuthDiagnostic({message:"missing-client-id", code:"missing-client-id"}, "configuration");
    setAuthState(AUTH_STATE.ERROR, message);
    toast(message);
    return;
  }
  if(!window.google?.accounts?.oauth2){
    const message = "Không tải được dịch vụ đăng nhập Google. Vui lòng tải lại trang.";
    logGoogleAuthDiagnostic({message:"gis-not-loaded", code:"gis-not-loaded"}, "sdk_readiness");
    watchGoogleSdkReadiness();
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

document.querySelector("#gateConnectDrive").addEventListener("click",connectGoogleDriveFromUi);
document.querySelector("#connectDrive").addEventListener("click",connectGoogleDriveFromUi);
document.querySelector("#syncNow").addEventListener("click",async()=>{ try{ await syncService.syncNow(); toast("Đã đồng bộ"); }catch(e){ toast(e.message==="offline" ? "Đang offline, dữ liệu đã lưu máy này." : "Đồng bộ thất bại"); } });
document.querySelector("#disconnectDrive").addEventListener("click",()=>{ authAttemptId += 1; stopPaymentWarningReminder(); syncService.disconnect(); setAuthState(AUTH_STATE.DISCONNECTED, ""); renderAll(); toast("Đã ngắt kết nối Google Drive"); });
document.querySelector("#setupBack").addEventListener("click",()=>{ setupStep=Math.max(0, setupStep-1); renderSetupWizard(); });
document.querySelector("#setupNext").addEventListener("click",()=>goSetupNext(false));
document.querySelector("#setupSkipHost").addEventListener("click",()=>goSetupNext(true));
syncService.addEventListener("status", e=>{ renderSyncStatus(); if(e.detail.status==="conflict") showConflict(e.detail.driveData); });

const MASTER_DATA_SHEETS=Object.freeze({mcc:"Bảng MCC",orderTypes:"Loại đơn",banks:"Mã ngân hàng"});

function masterDataSheet(rows, widths=[]){
  const sheet=XLSX.utils.json_to_sheet(rows);
  if(widths.length) sheet["!cols"]=widths.map(wch=>({wch}));
  return sheet;
}

const EXPORTABLE_SHEETS=Object.freeze([
  {key:"cards",label:"Thẻ",sheetName:"Thẻ"},
  {key:"programs",label:"Chương trình Cashback",sheetName:"Chương trình Cashback"},
  {key:"transactions",label:"Giao dịch",sheetName:"Giao dịch"},
  {key:"cashbackReceipts",label:"Cashback thực nhận",sheetName:"Cashback thực nhận"},
  {key:"feeTargets",label:"Phí thẻ",sheetName:"Phí thẻ"},
  {key:"payments",label:"Thanh toán thẻ",sheetName:"Thanh toán thẻ"},
  {key:"hosts",label:"Host",sheetName:"Host"},
  {key:"mcc",label:"Bảng MCC",sheetName:MASTER_DATA_SHEETS.mcc},
  {key:"orderTypes",label:"Loại đơn",sheetName:MASTER_DATA_SHEETS.orderTypes},
  {key:"insuranceLinks",label:"Link Bảo Hiểm",sheetName:"Link Bảo Hiểm"},
  {key:"banks",label:"Mã ngân hàng",sheetName:MASTER_DATA_SHEETS.banks}
]);

function exportCardsRows(){
  return [...(state.cards||[])].sort((a,b)=>compareVietnameseText(cardBankName(a),cardBankName(b))||compareVietnameseText(a.id,b.id)).map(c=>({
    "Ngân hàng":cardBankName(c),
    "Card ID":c.id||"",
    "Phôi":c.network||"",
    "Loại thẻ":cardTypeLabel(c.cardType),
    "Hình thức":cardFormLabel(c.cardForm),
    "Ngày kích hoạt":excelDateValue(c.activationDate),
    "Hạn mức":c.cardType==="debit"?"":Number(c.groupLimit)||0,
    "Dư nợ":c.cardType==="debit"?"":allDebt(c.id),
    "Chung hạn mức":sharedLimitLabel(c),
    "Ngày sao kê":c.cardType==="debit"?"":statementDayLabel(c.statementDay),
    "Hạn thanh toán":paymentDueDayLabel(c.paymentDueDay),
    "Hoàn tiền":cashbackCycleLabel(c.cashbackCycle),
    "Ghi chú":c.notes||""
  }));
}

function exportProgramsRows(){
  return [...(state.cashbackPrograms||[])].sort((a,b)=>(a.year||0)-(b.year||0)||(a.month||0)-(b.month||0)||compareVietnameseText(a.cardId,b.cardId)||compareVietnameseText(a.name,b.name)).map(raw=>{
    const p=normalizedProgramForDisplay(raw);
    const conditions=normalizeCashbackConditions(p,state.mccCategories);
    return {
      "Năm":p.year||"",
      "Tháng":p.month||"",
      "Ngân hàng":cashbackProgramBankName(p),
      "Card ID":p.cardId||"",
      "Chương trình":p.name||"",
      "Điều kiện kết hợp":normalizeCombineOperator(p.combineOperator),
      "% CB":conditions.map(c=>formatCashbackRate(c.rate)).join(" / "),
      "Max CB":conditions.map(c=>isCashbackUnlimited(c)?"Không giới hạn":Number(c.max)||0).join(" / "),
      "Chi nhóm để max":conditions.map(c=>c.eligibleTarget==null?"":c.eligibleTarget).join(" / "),
      "Chỉ tiêu tổng":p.totalTarget??"",
      "Hình thức giao dịch":conditions.map(c=>transactionMethodLabel(c.channel)||"Tất cả").join(" / "),
      "Nhóm MCC":mccProgramSummary(p),
      "Mã MCC":mccProgramCodes(p)
    };
  });
}

function exportFeeTargetRows(){
  return feeTargetMetrics().map(item=>({
    "Thẻ":item.cardId||"",
    "Loại phí":feeTypeLabel(item.feeType),
    "Phí thẻ lý thuyết":Number(item.feeAmount)||0,
    "Phí thẻ thực tế":actualFeeAmountForTarget(item),
    "Ngày kích hoạt thẻ":excelDateValue(item.activationDate),
    "Hạn chốt":excelDateValue(item.deadline||item.periodEnd),
    "Chỉ tiêu hoàn phí":Number(item.targetAmount)||0,
    "Còn thiếu":Number(item.remainingAmount)||0,
    "Ghi chú":item.notes||""
  }));
}

function exportPaymentRowsFull(){
  const obligationsByKey=new Map(paymentObligations().map(obligation=>[obligation.key,obligation]));
  return [...(state.payments||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(p=>({
    "Ngày":excelDateValue(p.date),
    "Thẻ":p.cardId||"",
    "Kỳ thanh toán":paymentCycleDisplay(p.paymentCycle,{emptyText:""}),
    "Hạn thanh toán":excelDateValue(paymentEffectiveDueDate(p)),
    "Trạng thái":p.paymentStatus==="paid"?"Đã thanh toán":"Chưa thanh toán",
    "Số tiền":Number(p.amount)||0,
    "Dư nợ":Number(obligationsByKey.get(`${p.cardId}|${p.paymentCycle}`)?.outstandingAmount)||0,
    "Ghi chú":p.note||""
  }));
}

function exportSheetDefinition(key){
  switch(key){
    case "cards": return {rows:exportCardsRows(),dateHeaders:["Ngày kích hoạt"],widths:[22,18,16,14,14,14,16,16,24,14,16,16,36]};
    case "programs": return {rows:exportProgramsRows(),widths:[9,9,20,18,30,18,20,24,22,18,22,44,22]};
    case "transactions": return {rows:exportTransactionsRows([...(state.transactions||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||""))),dateHeaders:["Ngày","Ngày về"],widths:[24,14,18,18,12,16,16,14,14,16,18,40]};
    case "cashbackReceipts": return {rows:exportCashbackReceiptRows([...(state.cashbackReceipts||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||""))),dateHeaders:["Ngày"],widths:[24,14,22,24,18,40]};
    case "feeTargets": return {rows:exportFeeTargetRows(),dateHeaders:["Ngày kích hoạt thẻ","Hạn chốt"],widths:[18,20,22,20,18,16,20,18,40]};
    case "payments": return {rows:exportPaymentRowsFull(),dateHeaders:["Ngày","Hạn thanh toán"],widths:[14,18,18,18,18,16,16,40]};
    case "hosts": return {rows:sortDisplayRows(state.hosts||[],item=>item.name).map(item=>({"Tên Host":item.name||""})),widths:[30]};
    case "mcc": return {rows:[...(state.mccCategories||[])].sort((a,b)=>mccCode(a.mcc).localeCompare(mccCode(b.mcc),undefined,{numeric:true,sensitivity:"base"})).map(item=>({"Loại chi tiêu":item.name||"","MCC":item.mcc||"","Ghi chú":item.notes||""})),widths:[42,12,44]};
    case "orderTypes": return {rows:sortDisplayRows(state.orderTypes||[],item=>item.name).map(item=>({"Mã loại đơn":item.name||"","Màu":normalizeOrderTypeColor(item.color)||orderTypeDefaultColor(item.name),"Mô tả":item.description||"","Ghi chú":item.note||""})),widths:[20,14,36,40]};
    case "insuranceLinks": return {rows:(INSURANCE_LINKS||[]).map(item=>({"STT":item.index,"Bảo hiểm":item.name||"","Link thanh toán":item.url||""})),widths:[8,24,90]};
    case "banks": return {rows:sortDisplayRows(state.banks||[],item=>item.code).map(item=>({"Mã ngân hàng":item.code||"","Tên ngân hàng":item.name||""})),widths:[20,34]};
    default:return {rows:[],widths:[]};
  }
}

function ensureExportExcelModal(){
  let modal=document.querySelector("#exportExcelModal");
  if(modal)return modal;
  modal=document.createElement("div");
  modal.id="exportExcelModal";
  modal.className="modal export-excel-modal";
  modal.innerHTML=`<section class="modal-card export-excel-card" role="dialog" aria-modal="true" aria-labelledby="exportExcelTitle">
    <div class="section-title"><div><h2 id="exportExcelTitle">Xuất Excel</h2><small>Chọn các tab muốn xuất thành sheet Excel</small></div></div>
    <div class="export-excel-actions-top"><button type="button" class="ghost" data-export-select-all>Chọn tất cả</button><button type="button" class="ghost" data-export-clear-all>Bỏ chọn</button></div>
    <div class="export-excel-options">${EXPORTABLE_SHEETS.map(item=>`<label class="export-excel-option"><input type="checkbox" value="${esc(item.key)}" checked><span>${esc(item.label)}</span></label>`).join("")}</div>
    <div class="modal-actions"><button type="button" class="ghost" data-export-cancel>Huỷ</button><button type="button" class="primary" data-export-confirm>Xuất Excel</button></div>
  </section>`;
  document.body.appendChild(modal);
  modal.querySelector("[data-export-select-all]").onclick=()=>modal.querySelectorAll('.export-excel-options input[type="checkbox"]').forEach(box=>box.checked=true);
  modal.querySelector("[data-export-clear-all]").onclick=()=>modal.querySelectorAll('.export-excel-options input[type="checkbox"]').forEach(box=>box.checked=false);
  modal.querySelector("[data-export-cancel]").onclick=()=>modal.classList.remove("show");
  modal.addEventListener("click",event=>{if(event.target===modal)modal.classList.remove("show");});
  return modal;
}

function exportSelectedExcel(selectedKeys){
  if(typeof XLSX==="undefined"){toast("Không tải được thư viện Excel. Kiểm tra Internet.");return;}
  const selected=EXPORTABLE_SHEETS.filter(item=>selectedKeys.includes(item.key));
  if(!selected.length){toast("Vui lòng chọn ít nhất một tab để xuất Excel.");return;}
  const wb=XLSX.utils.book_new();
  selected.forEach(item=>{
    const definition=exportSheetDefinition(item.key);
    const sheet=worksheetFromRows(definition.rows,definition.dateHeaders||[]);
    if(definition.widths?.length)sheet["!cols"]=definition.widths.map(wch=>({wch}));
    XLSX.utils.book_append_sheet(wb,sheet,item.sheetName.slice(0,31));
  });
  XLSX.writeFile(wb,`CardFlow_Export_${new Date().toISOString().slice(0,10).replaceAll("-","")}.xlsx`);
  toast(`Đã xuất ${selected.length} tab ra Excel`);
}

function exportMasterDataExcel(){
  const modal=ensureExportExcelModal();
  modal.querySelectorAll('.export-excel-options input[type="checkbox"]').forEach(box=>box.checked=true);
  modal.querySelector("[data-export-confirm]").onclick=()=>{
    const selectedKeys=[...modal.querySelectorAll('.export-excel-options input[type="checkbox"]:checked')].map(box=>box.value);
    if(!selectedKeys.length){toast("Vui lòng chọn ít nhất một tab để xuất Excel.");return;}
    modal.classList.remove("show");
    exportSelectedExcel(selectedKeys);
  };
  modal.classList.add("show");
}

function readMasterRows(workbook,sheetName){
  const sheet=workbook.Sheets[sheetName];
  if(!sheet) throw new Error(`Thiếu sheet “${sheetName}”.`);
  return XLSX.utils.sheet_to_json(sheet,{defval:"",raw:false}).filter(row=>Object.values(row).some(value=>String(value??"").trim()));
}

function normalizeImportText(value){ return String(value??"").trim(); }
function viKey(value){ return normalizeImportText(value).toLocaleLowerCase("vi"); }

function excelImportDate(value){
  if(value==null||value==="")return "";
  if(value instanceof Date)return toStorageDate(value);
  if(typeof value==="number"){
    const parts=XLSX.SSF.parse_date_code(value);
    return parts?toStorageDate(`${parts.y}-${parts.m}-${parts.d}`):"";
  }
  return toStorageDate(value);
}

function cardActivationUpdates(workbook){
  const sheet=workbook.Sheets["Thẻ"];
  if(!sheet)return [];
  const rows=XLSX.utils.sheet_to_json(sheet,{defval:"",raw:true});
  if(!rows.length)return [];
  const hasActivation=Object.prototype.hasOwnProperty.call(rows[0],"Ngày kích hoạt");
  const hasLegacyAnnualFee=Object.prototype.hasOwnProperty.call(rows[0],"Phí thường niên");
  if(!hasActivation&&!hasLegacyAnnualFee)return [];
  return rows.map((row,index)=>{
    const id=normalizeImportText(row["Card ID"]);
    const raw=hasActivation?row["Ngày kích hoạt"]:"";
    const activationDate=excelImportDate(raw);
    if(raw!==""&&!activationDate)throw new Error(`Sheet “Thẻ”, dòng ${index+2}: Ngày kích hoạt không hợp lệ.`);
    const annualFee=hasLegacyAnnualFee?normalizeMoney(row["Phí thường niên"],{emptyValue:0}):0;
    return {id,activationDate:hasActivation?activationDate:null,annualFee};
  }).filter(item=>item.id);
}

function migrateImportedCardAnnualFees(updates=[]){
  const annualCards=new Set((state.feeTargets||[]).filter(target=>target.feeType==="annual_fee").map(target=>target.cardId));
  updates.forEach(update=>{
    if(update.annualFee<=0||annualCards.has(update.id)||!state.cards.some(card=>card.id===update.id))return;
    const periodStart=state.cards.find(card=>card.id===update.id)?.activationDate||"";
    const id=buildFeeTargetId(update.id,"annual_fee",periodStart,(state.feeTargets||[]).map(target=>target.id));
    state.feeTargets.push({id,cardId:update.id,feeType:"annual_fee",feeAmount:update.annualFee,activationDate:periodStart,periodStart,deadline:"",periodEnd:"",targetAmount:0,allMcc:true,mccCategoryIds:[],channel:"all",reminderEnabled:true,notes:""});
    annualCards.add(update.id);
  });
}

function buildImportedMcc(rows){
  const seen=new Set();
  const currentByCode=new Map((state.mccCategories||[]).map(item=>[mccCode(item.mcc),item]));
  return rows.map((row,index)=>{
    const name=normalizeImportText(row["Loại chi tiêu"] ?? row["Nhóm MCC"]);
    const mcc=mccCode(row["MCC"]);
    const notes=normalizeImportText(row["Ghi chú"]);
    if(!name||!mcc) throw new Error(`Sheet “${MASTER_DATA_SHEETS.mcc}”, dòng ${index+2}: Loại chi tiêu và MCC không được để trống.`);
    const isSales=mcc.toLocaleLowerCase("vi")==="doanh số";
    if(!isSales&&!/^\d{4}$/.test(mcc)) throw new Error(`Sheet “${MASTER_DATA_SHEETS.mcc}”, dòng ${index+2}: MCC phải gồm đúng 4 chữ số.`);
    if(!isSales&&!name.startsWith(`${mcc} - `)) throw new Error(`Sheet “${MASTER_DATA_SHEETS.mcc}”, dòng ${index+2}: Loại chi tiêu phải theo cú pháp “${mcc} - Tên loại chi tiêu”.`);
    if(isSales&&viKey(name)!=="doanh số") throw new Error(`Sheet “${MASTER_DATA_SHEETS.mcc}”, dòng ${index+2}: MCC Doanh số phải có Loại chi tiêu là “Doanh số”.`);
    if(seen.has(mcc)) throw new Error(`Sheet “${MASTER_DATA_SHEETS.mcc}”: MCC ${mcc} bị trùng.`);
    seen.add(mcc);
    const current=currentByCode.get(mcc);
    return {id:current?.id||uuid("MCC"),name,mcc,notes};
  });
}

function buildImportedOrderTypes(rows){
  const seen=new Set();
  const currentByName=new Map((state.orderTypes||[]).map(item=>[viKey(item.name),item]));
  return rows.map((row,index)=>{
    const name=normalizeImportText(row["Mã loại đơn"]);
    const colorRaw=normalizeImportText(row["Màu"] ?? row["Màu sắc"]);
    const description=normalizeImportText(row["Mô tả"]);
    const note=normalizeImportText(row["Ghi chú"]);
    if(!name) throw new Error(`Sheet “${MASTER_DATA_SHEETS.orderTypes}”, dòng ${index+2}: Mã loại đơn không được để trống.`);
    const key=viKey(name);
    if(seen.has(key)) throw new Error(`Sheet “${MASTER_DATA_SHEETS.orderTypes}”: Mã loại đơn “${name}” bị trùng.`);
    seen.add(key);
    if(colorRaw&&!normalizeOrderTypeColor(colorRaw)) throw new Error(`Sheet “${MASTER_DATA_SHEETS.orderTypes}”, dòng ${index+2}: Màu phải theo dạng #RRGGBB.`);
    const current=currentByName.get(key);
    return {id:current?.id||uuid("ORDER-TYPE"),name,color:normalizeOrderTypeColor(colorRaw)||orderTypeDefaultColor(name),description,note};
  });
}

function buildImportedBanks(rows){
  const seenCodes=new Set(),seenNames=new Set();
  const currentByCode=new Map((state.banks||[]).map(item=>[normalizeBankCode(item.code),item]));
  return rows.map((row,index)=>{
    const storedCode=normalizeImportText(row["Mã ngân hàng"]);
    const code=normalizeBankCode(storedCode);
    const name=normalizeBankName(row["Tên ngân hàng"]);
    if(!code||!name) throw new Error(`Sheet “${MASTER_DATA_SHEETS.banks}”, dòng ${index+2}: Mã ngân hàng và Tên ngân hàng không được để trống.`);
    if(/\s/.test(code)||!/^[A-Z0-9-]+$/.test(code)) throw new Error(`Sheet “${MASTER_DATA_SHEETS.banks}”, dòng ${index+2}: Mã ngân hàng chỉ được dùng chữ, số và dấu gạch ngang, không có khoảng trắng.`);
    const nameKey=viKey(name);
    if(seenCodes.has(code)) throw new Error(`Sheet “${MASTER_DATA_SHEETS.banks}”: Mã ngân hàng ${code} bị trùng.`);
    if(seenNames.has(nameKey)) throw new Error(`Sheet “${MASTER_DATA_SHEETS.banks}”: Tên ngân hàng “${name}” bị trùng.`);
    seenCodes.add(code);seenNames.add(nameKey);
    const current=currentByCode.get(code);
    return {id:current?.id||bankIdFromCode(code),code:storedCode,name};
  });
}

function importDeletionSummary(nextMcc,nextOrderTypes,nextBanks){
  const mccCodes=new Set(nextMcc.map(item=>mccCode(item.mcc)));
  const orderKeys=new Set(nextOrderTypes.map(item=>viKey(item.name)));
  const bankCodes=new Set(nextBanks.map(item=>normalizeBankCode(item.code)));
  return {
    mcc:(state.mccCategories||[]).filter(item=>!mccCodes.has(mccCode(item.mcc))),
    orderTypes:(state.orderTypes||[]).filter(item=>!orderKeys.has(viKey(item.name))),
    banks:(state.banks||[]).filter(item=>!bankCodes.has(normalizeBankCode(item.code)))
  };
}

function validateMasterDeletions(deletions){
  const blockedBanks=deletions.banks.filter(bank=>(state.cards||[]).some(card=>card.bankId===bank.id));
  if(blockedBanks.length){
    const names=blockedBanks.map(bank=>bank.code).join(", ");
    throw new Error(`Không thể xóa ngân hàng đang được thẻ sử dụng: ${names}. Hãy giữ các ngân hàng này trong file Excel master.`);
  }
}

function applyMasterDataImport(nextMcc,nextOrderTypes,nextBanks,deletions){
  const oldMccById=new Map((state.mccCategories||[]).map(item=>[item.id,item]));
  const nextMccById=new Map(nextMcc.map(item=>[item.id,item]));
  const deletedMccIds=new Set(deletions.mcc.map(item=>item.id));
  const oldBankById=new Map((state.banks||[]).map(item=>[item.id,item]));
  const nextBankById=new Map(nextBanks.map(item=>[item.id,item]));

  state.transactions.forEach(transaction=>{
    const nextCategory=nextMccById.get(transaction.mccCategoryId);
    if(nextCategory){
      transaction.category=nextCategory.name;
      transaction.mcc=nextCategory.mcc;
    }else if(deletedMccIds.has(transaction.mccCategoryId)){
      transaction.mccCategoryId="";
    }
  });

  state.cashbackPrograms.forEach(program=>{
    const conditions=normalizeCashbackConditions(program,state.mccCategories).map(condition=>{
      if(condition.allMcc) return condition;
      const ids=(condition.mccCategoryIds||[]).filter(id=>nextMccById.has(id));
      return {...condition,mccCategoryIds:ids,categories:ids.map(id=>nextMccById.get(id)?.name).filter(Boolean)};
    });
    program.conditions=conditions;
    const first=conditions[0];
    if(first){
      program.mccCategoryIds=first.mccCategoryIds||[];
      program.categories=first.categories||[];
    }
  });

  state.cards.forEach(card=>{
    const current=oldBankById.get(card.bankId);
    const next=nextBankById.get(card.bankId);
    if(current&&next) card.bank=next.name;
  });

  state.mccCategories=nextMcc;
  state.orderTypes=nextOrderTypes;
  state.banks=nextBanks;
  clearAllRowSelections();
}

async function importMasterDataExcel(file){
  if(typeof XLSX==="undefined"){toast("Không tải được thư viện Excel. Kiểm tra Internet.");return;}
  if(!file) return;
  try{
    const buffer=await file.arrayBuffer();
    const workbook=XLSX.read(buffer,{type:"array",cellDates:true});
    const mccRows=readMasterRows(workbook,MASTER_DATA_SHEETS.mcc);
    const orderRows=readMasterRows(workbook,MASTER_DATA_SHEETS.orderTypes);
    const bankRows=readMasterRows(workbook,MASTER_DATA_SHEETS.banks);
    const nextMcc=buildImportedMcc(mccRows);
    const nextOrderTypes=buildImportedOrderTypes(orderRows);
    const nextBanks=buildImportedBanks(bankRows);
    const activationUpdates=cardActivationUpdates(workbook);
    const deletions=importDeletionSummary(nextMcc,nextOrderTypes,nextBanks);
    validateMasterDeletions(deletions);
    const deleteCount=deletions.mcc.length+deletions.orderTypes.length+deletions.banks.length;
    const message=[
      "Import Excel sẽ đồng bộ 3 danh mục theo file master:",
      `• MCC: ${nextMcc.length} dòng${deletions.mcc.length?` (xóa ${deletions.mcc.length})`:""}`,
      `• Loại đơn: ${nextOrderTypes.length} dòng${deletions.orderTypes.length?` (xóa ${deletions.orderTypes.length})`:""}`,
      `• Mã ngân hàng: ${nextBanks.length} dòng${deletions.banks.length?` (xóa ${deletions.banks.length})`:""}`,
      "",
      deleteCount?"Các dòng không có trong Excel sẽ bị xóa khỏi danh mục. Tiếp tục?":"Không có dòng nào bị xóa. Tiếp tục?"
    ].join("\n");
    if(!confirm(message)) return;
    applyMasterDataImport(nextMcc,nextOrderTypes,nextBanks,deletions);
    const activationByCardId=new Map(activationUpdates.filter(item=>item.activationDate!=null).map(item=>[item.id,item.activationDate]));
    state.cards.forEach(card=>{if(activationByCardId.has(card.id))card.activationDate=activationByCardId.get(card.id);});
    migrateImportedCardAnnualFees(activationUpdates);
    saveState("Đã import Excel và đồng bộ danh mục theo file master");
  }catch(error){
    console.error("Import master data failed",error);
    toast(error?.message||"Import Excel thất bại");
  }
}

document.querySelector("#importExcel")?.addEventListener("click",()=>document.querySelector("#importExcelFile")?.click());
document.querySelector("#importExcelFile")?.addEventListener("change",async event=>{
  const input=event.currentTarget;
  const file=input.files?.[0];
  input.value="";
  await importMasterDataExcel(file);
});
document.querySelector("#exportExcel")?.addEventListener("click",exportMasterDataExcel);

state = localRepository.load();
setSidebarExpanded(localStorage.getItem(SIDEBAR_STORAGE_KEY)==='true');
initPeriod();
renderAll();
setView("dashboard");
watchGoogleSdkReadiness();
