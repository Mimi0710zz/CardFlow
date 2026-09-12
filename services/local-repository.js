import { BANK_MAPPINGS, cloneSeed, MCC_DEFAULTS } from "./default-data.js?v=20260909-order-types-v1";
import { normalizeMoney } from "./money.js";
import { toStorageDate } from "./date.js";
import { activationDateForFeeTarget, feeAmountForTarget, legacyFeeAmount } from "./fee-target-model.js";
import { calculateSpendToMax, isLegacyVpDebitFakeUnlimited, normalizeCashbackConditions, normalizeCashbackProgramIds, normalizeCombineOperator, normalizeProgramMcc } from "./cashback.js?v=20260911-cashback-program-id-v1";
import { TRANSACTION_STATUS, isLegacyIssueStatus, normalizeTransactionStatus } from "./transaction-status.js?v=20260906-order-types-transaction-v1";
import { CARD_FEE_ORDER_TYPE, DEFAULT_ORDER_TYPE_COLORS, orderTypeDefaultColor, normalizeOrderTypeColor } from "./order-type.js";

const V1_KEY = "cardflow-demo-v1";
const V2_KEY = "cardflow-web-data-v2";
const META_KEY = "cardflow-web-sync-meta-v2";

function uuid(){
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeHosts(hosts){
  return (hosts || []).map((host, index) => {
    if(typeof host === "string") return {id:`HOST-${index + 1}`, name:host};
    return {id:host.id || uuid(), name:host.name || ""};
  }).filter(x => x.name);
}

function normalizeMcc(list){
  const source = list && list.length ? list : MCC_DEFAULTS.map(([name,mcc]) => ({name,mcc}));
  return source.map(item => ({
    id: item.id || `MCC-${item.mcc || uuid()}`,
    name: item.name || item[0] || "",
    mcc: String(item.mcc ?? item[1] ?? "").trim(),
    notes: String(item.notes ?? item.note ?? "")
  })).filter(x => x.name);
}

function orderTypeId(name){
  return `ORDER-TYPE-${String(name || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"") || uuid()}`;
}

function normalizeOrderTypes(orderTypes){
  const normalized=[],scores=[],indexByName=new Map();
  const customizationScore=(item,name)=>{
    const color=normalizeOrderTypeColor(item?.color || item?.colour);
    const defaultColor=DEFAULT_ORDER_TYPE_COLORS[name.toUpperCase()] || (name.toLocaleLowerCase("vi")===CARD_FEE_ORDER_TYPE.toLocaleLowerCase("vi") ? "#6b7280" : orderTypeDefaultColor(name));
    return (color&&color!==defaultColor?4:0)+(String(item?.description||"").trim()?2:0)+(String(item?.note??item?.notes??"").trim()?2:0)+(item?.id?1:0);
  };
  (orderTypes || []).forEach((item,index)=>{
    const name=String(item?.name || item?.code || item?.orderTypeCode || "").trim();
    const key=name.toLocaleUpperCase("vi");
    if(!name) return;
    const defaultColor=DEFAULT_ORDER_TYPE_COLORS[name.toUpperCase()] || (name.toLocaleLowerCase("vi")===CARD_FEE_ORDER_TYPE.toLocaleLowerCase("vi") ? "#6b7280" : "");
    const candidate={id:item.id || orderTypeId(name),name,color:normalizeOrderTypeColor(item.color || item.colour) || defaultColor || orderTypeDefaultColor(name,index),description:String(item.description || "").trim(),note:String(item.note ?? item.notes ?? "").trim()};
    const score=customizationScore(item,name);
    if(!indexByName.has(key)){
      indexByName.set(key,normalized.length);
      normalized.push(candidate);
      scores.push(score);
      return;
    }
    const existingIndex=indexByName.get(key);
    if(score>scores[existingIndex]){
      normalized[existingIndex]=candidate;
      scores[existingIndex]=score;
    }
  });
  return normalized;
}

function bankIdFromCode(code){
  return `BANK-${String(code || "").trim().toUpperCase()}`;
}

function cleanBankCode(code){
  return String(code || "").trim().toUpperCase();
}

function findKnownBank(bankName){
  const value = String(bankName || "").trim().toLowerCase();
  return BANK_MAPPINGS.find(x => x.aliases.some(alias => alias.toLowerCase() === value) || x.name.toLowerCase() === value);
}

function normalizeBanks(inputBanks, cards, {cleanupLegacyHdbank=false}={}){
  let sourceBanks=Array.isArray(inputBanks)?inputBanks:[];
  if(cleanupLegacyHdbank){
    const hdb=sourceBanks.find(bank=>cleanBankCode(bank?.code)==="HDB");
    const redundant=sourceBanks.find(bank=>cleanBankCode(bank?.code)==="HDBANK");
    const sameName=hdb&&redundant&&String(hdb.name||"").trim().toLocaleLowerCase("vi")===String(redundant.name||"").trim().toLocaleLowerCase("vi");
    const referenced=redundant&&(cards||[]).some(card=>card?.bankId===redundant.id);
    if(sameName&&!referenced) sourceBanks=sourceBanks.filter(bank=>bank!==redundant);
  }
  const byCode = new Map();
  const addBank = bank => {
    const code = String(bank.code || "").trim();
    const normalizedCode = cleanBankCode(code);
    const name = String(bank.name || "").trim();
    if(!normalizedCode || !name || byCode.has(normalizedCode)) return;
    byCode.set(normalizedCode, {id:bank.id || bankIdFromCode(normalizedCode), code, name});
  };
  sourceBanks.forEach(addBank);
  (cards || []).forEach(card => {
    if(card.bankId && [...byCode.values()].some(bank=>bank.id===card.bankId)) return;
    const known = findKnownBank(card.bank);
    if(known) addBank({id:bankIdFromCode(known.code), code:known.code, name:known.name});
    else if(card.bank){
      const code = cleanBankCode(String(card.bank).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9-]+/g,"-").replace(/^-+|-+$/g,"")) || "BANK";
      addBank({id:bankIdFromCode(code), code, name:String(card.bank).trim()});
    }
  });
  return [...byCode.values()];
}

function hasMeaningfulData(input){
  return Boolean(
    input.settings?.setupCompleted === true ||
    input.cards?.length ||
    input.cashbackPrograms?.length ||
    input.programs?.length ||
    input.transactions?.length ||
    input.cashbackReceipts?.length ||
    input.feeTargets?.length ||
    input.payments?.length ||
    input.hosts?.length ||
    input.banks?.length
  );
}

function normalizeCards(cards, banks, fallbackTrackingMonth=""){
  return (cards || []).map(card => {
    let bankId = card.bankId || "";
    if(!bankId){
      const known = findKnownBank(card.bank);
      if(known) bankId = bankIdFromCode(known.code);
      else {
        const byName = banks.find(bank => bank.name === card.bank);
        bankId = byName?.id || "";
      }
    }
    const bank = banks.find(x => x.id === bankId)?.name || card.bank || "";
    const cardType = String(card.cardType || "").toLowerCase() === "debit" ? "debit" : "credit";
    const rawStatementDay = card.statementDay === "" || card.statementDay == null ? "" : Number(card.statementDay);
    const statementDay = cardType === "debit" ? "" : (Number.isInteger(rawStatementDay) && rawStatementDay >= 1 && rawStatementDay <= 31 ? rawStatementDay : "");
    const legacyGroup = cardType === "debit" ? "" : (card.limitGroup || card.limitGroupId || card.id);
    const limitGroupId = cardType === "debit" ? "" : (card.limitGroupId || `LG-${String(legacyGroup).trim().toUpperCase().replace(/[^A-Z0-9-]+/g,"-").replace(/-+/g,"-")}`);
    const rawPaymentDueDay = card.paymentDueDay === "" || card.paymentDueDay == null ? null : Number(card.paymentDueDay);
    const paymentDueDay = Number.isInteger(rawPaymentDueDay) && rawPaymentDueDay >= 1 && rawPaymentDueDay <= 31 ? rawPaymentDueDay : null;
    const paymentTrackingStartMonth = paymentDueDay == null ? "" : (/^\d{4}-(0[1-9]|1[0-2])$/.test(card.paymentTrackingStartMonth || "") ? card.paymentTrackingStartMonth : fallbackTrackingMonth);
    const cashbackCycle = card.cashbackCycle === "monthly" || card.cashbackCycle === "statement" ? card.cashbackCycle : "";
    const activationDate = toStorageDate(card.activationDate);
    const {annualFee:_legacyAnnualFee,...cardWithoutAnnualFee}=card;
    return {...cardWithoutAnnualFee, cardType, bankId, bank, cardForm:card.cardForm || "", activationDate, cashbackCycle, statementDay, paymentDueDay, paymentTrackingStartMonth, limitGroupId, limitGroup:cardType === "debit" ? "" : (card.limitGroup || legacyGroup), groupLimit:cardType === "debit" ? 0 : normalizeMoney(card.groupLimit, {emptyValue:0}), notes:String(card.notes || "")};
  });
}

function normalizeCashbackPrograms(programs, mccCategories, fallbackPeriod={}){
  const normalized = (programs || []).map(program => {
    const conditions=normalizeCashbackConditions(program,mccCategories);
    const first=conditions[0];
    const isKnownDebitFakeUnlimited = isLegacyVpDebitFakeUnlimited(program);
    const maxCashbackUnlimited = first.maxCashbackUnlimited === true || isKnownDebitFakeUnlimited;
    const max = maxCashbackUnlimited ? null : normalizeMoney(first.max, {emptyValue:0});
    const rate = Number(first.rate) || 0;
    const eligibleTarget = maxCashbackUnlimited ? null : calculateSpendToMax(rate, max);
    const rawTotalTarget = normalizeMoney(program.totalTarget, {emptyValue:null});
    const totalTarget = rawTotalTarget == null || (maxCashbackUnlimited && (rawTotalTarget === 0 || (isKnownDebitFakeUnlimited && rawTotalTarget === 999999999999))) ? null : rawTotalTarget;
    const existingTotalCondition=program.totalSpendCondition && typeof program.totalSpendCondition==="object" ? program.totalSpendCondition : null;
    const totalSpendCondition={
      enabled:existingTotalCondition ? existingTotalCondition.enabled===true : totalTarget!=null,
      amount:normalizeMoney(existingTotalCondition?.amount ?? totalTarget,{emptyValue:null})
    };
    const totalTargetManuallyEdited = program.totalTargetManuallyEdited === true ||
      (totalTarget != null && (eligibleTarget == null || totalTarget !== eligibleTarget));
    const legacySharedCap = program.legacySharedCap ?? program.shared ?? null;
    return {
      ...program,
      ...normalizeProgramMcc(first, mccCategories),
      conditions,
      rate,
      max,
      maxCashbackUnlimited,
      eligibleTarget,
      totalTarget,
      totalSpendCondition,
      totalTargetManuallyEdited,
      combineOperator:normalizeCombineOperator(program.combineOperator),
      ...(legacySharedCap == null ? {} : {legacySharedCap}),
      year:Number.isInteger(Number(program.year)) ? Number(program.year) : Number(fallbackPeriod.year),
      month:Number.isInteger(Number(program.month)) && Number(program.month)>=1 && Number(program.month)<=12 ? Number(program.month) : Number(fallbackPeriod.month)
    };
  });
  return normalizeCashbackProgramIds(normalized);
}

function hasCashbackProgramPeriodMigration(programs){
  return (programs || []).some(program=>!Number.isInteger(Number(program.year)) || !Number.isInteger(Number(program.month)) || Number(program.month)<1 || Number(program.month)>12);
}

function hasCashbackProgramIdMigration(programs, normalizedPrograms){
  return (programs || []).some((program, index) => String(program?.id || "").trim() !== String(normalizedPrograms[index]?.id || ""));
}

function normalizeTransactions(transactions,mccCategories=[]){
  return (transactions || []).map(transaction => {
    // Keep the legacy label intact on load; it is converted only if the user saves an edit.
    const status = isLegacyIssueStatus(transaction.status) ? transaction.status : normalizeTransactionStatus(transaction.status);
    const orderType = String(transaction.orderType || transaction.orderTypeCode || transaction.type || "").trim();
    const cardFee = orderType.toLocaleLowerCase("vi") === CARD_FEE_ORDER_TYPE.toLocaleLowerCase("vi");
    const personalUse = normalizeTransactionStatus(status) === TRANSACTION_STATUS.PERSONAL_USE;
    const requestedMcc=String(transaction.mccCategoryId || transaction.category || transaction.mcc || "").trim();
    const mccCategory=mccCategories.find(item=>item.id===requestedMcc || item.name===requestedMcc || String(item.mcc)===requestedMcc);
    return {
      ...transaction,
      date: toStorageDate(transaction.date),
      host: personalUse ? null : (transaction.host || ""),
      category: cardFee ? "" : mccCategory?.name || String(transaction.category || "").trim(),
      orderType,
      mccCategoryId:cardFee ? "" : mccCategory?.id || String(transaction.mccCategoryId || "").trim(),
      mcc:cardFee ? 0 : String(mccCategory?.mcc ?? transaction.mcc ?? "").trim(),
      backDate: cardFee || personalUse ? "" : toStorageDate(transaction.backDate),
      status:cardFee ? "" : status,
      amount: normalizeMoney(transaction.amount, {emptyValue:0}),
      backAmount: cardFee || personalUse ? 0 : normalizeMoney(transaction.backAmount, {emptyValue:0})
    };
  });
}

function hasTransactionStatusMigration(transactions){
  return (transactions || []).some(transaction => {
    const status = isLegacyIssueStatus(transaction.status) ? transaction.status : normalizeTransactionStatus(transaction.status);
    return transaction.status !== status ||
      (normalizeTransactionStatus(status) === TRANSACTION_STATUS.PERSONAL_USE && (transaction.host != null || toStorageDate(transaction.backDate) || normalizeMoney(transaction.backAmount, {emptyValue:0}) !== 0));
  });
}

function normalizeCashbackReceipts(receipts){
  return (receipts || []).map(receipt => ({
    ...receipt,
    id: receipt.id || `CBR-${uuid()}`,
    date: toStorageDate(receipt.date),
    bankId: receipt.bankId || "",
    cardId: receipt.cardId || "",
    amount: normalizeMoney(receipt.amount, {emptyValue:0}),
    notes: String(receipt.notes || "")
  }));
}

function normalizePayments(payments){
  return (payments || []).map(payment => ({
    ...payment,
    date: toStorageDate(payment.date),
    amount: normalizeMoney(payment.amount, {emptyValue:0}),
    paymentCycle:/^\d{4}-(0[1-9]|1[0-2])$/.test(payment.paymentCycle || "") ? payment.paymentCycle : "",
    paymentStatus:payment.paymentStatus === "paid" ? "paid" : ""
  }));
}

function migrateCardAnnualFees(cards=[],targets=[]){
  const migrated=[...targets];
  const annualCards=new Set(migrated.filter(target=>target.feeType!=="management_fee"&&(target.feeType==="annual_fee"||target.annualFee!=null)).map(target=>target.cardId));
  const usedIds=new Set(migrated.map(target=>target.id).filter(Boolean));
  cards.forEach(card=>{
    const feeAmount=normalizeMoney(card.annualFee,{emptyValue:0});
    if(!card.id||feeAmount<=0||annualCards.has(card.id)) return;
    const base=`FEE-${card.id}-ANNUAL-LEGACY`;
    let id=base,suffix=2;
    while(usedIds.has(id)){id=`${base}-${suffix}`;suffix+=1;}
    usedIds.add(id);
    annualCards.add(card.id);
    const activationDate=toStorageDate(card.activationDate);
    migrated.push({id,cardId:card.id,feeType:"annual_fee",feeAmount,activationDate,periodStart:activationDate,deadline:"",periodEnd:"",targetAmount:0,notes:""});
  });
  return migrated;
}

function normalizeFeeTargets(targets,mccCategories,cards=[]){
  const cardsById=new Map(cards.map(card=>[card.id,card]));
  return (targets || []).map(target=>{
    const mcc=normalizeProgramMcc(target,mccCategories);
    const feeType=target.feeType==="management_fee"||(!target.feeType&&target.managementFee!=null&&Number(target.managementFee)!==0)?"management_fee":"annual_fee";
    const card=cardsById.get(target.cardId);
    const preservedLegacyFee=legacyFeeAmount(target);
    const preservedLegacyActivation=toStorageDate(target.legacyActivationDate||target.activationDate||target.periodStart);
    const feeAmount=normalizeMoney(feeAmountForTarget({...target,feeType}),{emptyValue:0});
    const activationDate=activationDateForFeeTarget(target,card);
    const deadline=toStorageDate(target.deadline||target.periodEnd||target.settlementDate||target.cutoffDate);
    return {
      ...target,
      id:target.id || `FEE-${uuid()}`,
      feeType,
      feeAmount,
      legacyFeeAmount:target.legacyFeeAmount??preservedLegacyFee,
      activationDate,
      legacyActivationDate:preservedLegacyActivation,
      deadline,
      conditionType:target.conditionType || "spend_target",
      targetAmount:normalizeMoney(target.targetAmount??target.waiverTarget,{emptyValue:0}),
      periodStart:activationDate||preservedLegacyActivation,
      periodEnd:deadline,
      allMcc:mcc.allMcc,
      mccCategoryIds:mcc.mccCategoryIds,
      channel:target.channel || "all",
      reminderEnabled:target.reminderEnabled !== false,
      notes:String(target.notes ?? target.note ?? "")
    };
  });
}

function replaceMappedValue(value, cardIdMap, groupIdMap){
  if(typeof value !== "string") return value;
  if(groupIdMap.has(value)) return groupIdMap.get(value);
  if(cardIdMap.has(value)) return cardIdMap.get(value);
  for(const [oldId, newId] of cardIdMap){
    if(value === `LG-${oldId}`) return `LG-${newId}`;
  }
  return value;
}

export function migrateLegacySacombankCardIds(data){
  const cards = Array.isArray(data.cards) ? data.cards : [];
  const banks = Array.isArray(data.banks) ? data.banks : [];
  const existingIds = new Set(cards.map(card => card.id));
  const cardIdMap = new Map();
  const conflicts = [];

  cards.forEach(card => {
    const bank = banks.find(item => item.id === card.bankId);
    const isSacombank = String(bank?.name || card.bank || "").trim().toLowerCase() === "sacombank";
    const bankCode = cleanBankCode(bank?.code);
    if(!isSacombank || !bankCode || !String(card.id || "").startsWith("SCB-")) return;
    const targetId = `${bankCode}-${String(card.id).slice(4)}`;
    if(targetId === card.id) return;
    if(existingIds.has(targetId)){
      conflicts.push({oldId:card.id, targetId, reason:"target-exists"});
      return;
    }
    cardIdMap.set(card.id, targetId);
    existingIds.add(targetId);
  });

  if(!cardIdMap.size) return {data, changed:false, cardIdMap:Object.fromEntries(cardIdMap), conflicts};

  const legacyGroups = new Map();
  cards.forEach(card => {
    const group = card.limitGroupId || card.limitGroup;
    if(!group) return;
    if(!legacyGroups.has(group)) legacyGroups.set(group, []);
    legacyGroups.get(group).push(card);
  });
  const groupIdMap = new Map();
  legacyGroups.forEach((members, group) => {
    if((group === "SCB-SHARED" || group === "LG-SCB-SHARED") && members.length && members.every(card => cardIdMap.has(card.id))){
      groupIdMap.set(group, group.replace("SCB-SHARED", "SACOM-SHARED"));
      groupIdMap.set("SCB-SHARED", "SACOM-SHARED");
      groupIdMap.set("LG-SCB-SHARED", "LG-SACOM-SHARED");
    }
  });

  const mapCardReference = item => ({...item, cardId:cardIdMap.get(item.cardId) || item.cardId});
  const migrated = {
    ...data,
    cards: cards.map(card => ({
      ...card,
      id:cardIdMap.get(card.id) || card.id,
      limitGroup:replaceMappedValue(card.limitGroup, cardIdMap, groupIdMap),
      limitGroupId:replaceMappedValue(card.limitGroupId, cardIdMap, groupIdMap)
    })),
    cashbackPrograms:(data.cashbackPrograms || []).map(mapCardReference),
    transactions:(data.transactions || []).map(mapCardReference),
    payments:(data.payments || []).map(mapCardReference),
    cashbackReceipts:(data.cashbackReceipts || []).map(mapCardReference),
    feeTargets:(data.feeTargets || []).map(mapCardReference)
  };
  return {data:migrated, changed:true, cardIdMap:Object.fromEntries(cardIdMap), groupIdMap:Object.fromEntries(groupIdMap), conflicts};
}

export function canonicalizeDataWithMigration(input = {}, existingDeviceId = ""){
  const seed = cloneSeed();
  const rawCards = Array.isArray(input.cards) ? input.cards : seed.cards;
  const rawTransactions = Array.isArray(input.transactions) ? input.transactions : [];
  const transactionStatusChanged = hasTransactionStatusMigration(rawTransactions);
  const rawCashbackPrograms=Array.isArray(input.cashbackPrograms) ? input.cashbackPrograms : (Array.isArray(input.programs) ? input.programs : seed.cashbackPrograms);
  const cashbackProgramPeriodChanged=hasCashbackProgramPeriodMigration(rawCashbackPrograms);
  const banks = normalizeBanks(input.banks, rawCards,{cleanupLegacyHdbank:Number(input.schemaVersion||0)<9});
  const mccCategories = normalizeMcc(input.mccCategories);
  const orderTypes = normalizeOrderTypes(Array.isArray(input.orderTypes)?input.orderTypes:(!hasMeaningfulData(input)?seed.orderTypes:[]));
  const meaningful = hasMeaningfulData(input);
  const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
  const fallbackProgramDate=/^\d{4}-\d{2}/.test(input.updatedAt || "") ? new Date(`${input.updatedAt.slice(0,7)}-01T00:00:00`) : new Date();
  const fallbackProgramPeriod={year:fallbackProgramDate.getFullYear(),month:fallbackProgramDate.getMonth()+1};
  const cashbackPrograms = normalizeCashbackPrograms(rawCashbackPrograms, mccCategories, fallbackProgramPeriod);
  const cashbackProgramIdChanged=hasCashbackProgramIdMigration(rawCashbackPrograms, cashbackPrograms);
  const cards=normalizeCards(rawCards, banks, /^\d{4}-\d{2}/.test(input.updatedAt || "") ? input.updatedAt.slice(0,7) : `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`);
  const migratedFeeTargets=migrateCardAnnualFees(rawCards,Array.isArray(input.feeTargets)?input.feeTargets:[]);
  const canonical = {
    schemaVersion: 13,
    revision: Number(input.revision ?? 0),
    updatedAt: input.updatedAt || new Date().toISOString(),
    deviceId: input.deviceId || existingDeviceId || uuid(),
    banks,
    cards,
    cashbackPrograms,
    hosts: normalizeHosts(input.hosts || seed.hosts),
    mccCategories,
    orderTypes,
    transactions: normalizeTransactions(rawTransactions,mccCategories),
    cashbackReceipts: normalizeCashbackReceipts(Array.isArray(input.cashbackReceipts) ? input.cashbackReceipts : []),
    feeTargets: normalizeFeeTargets(migratedFeeTargets,mccCategories,cards),
    payments: normalizePayments(Array.isArray(input.payments) ? input.payments : []),
    settings: {...settings, setupCompleted:settings.setupCompleted === true || meaningful,orderTypesInitialized:true}
  };
  return {data:canonical, changed:Number(input.schemaVersion || 0)!==13 || transactionStatusChanged || cashbackProgramPeriodChanged || cashbackProgramIdChanged, cardIdMap:{}, groupIdMap:{}, conflicts:[]};
}

export function canonicalizeData(input = {}, existingDeviceId = ""){
  return canonicalizeDataWithMigration(input, existingDeviceId).data;
}

function defaultMeta(deviceId){
  return {
    deviceId,
    fileId: "",
    baseRevision: 0,
    dirty: false,
    lastSyncAt: "",
    lastBackupDate: "",
    status: "disconnected"
  };
}

export class LocalRepository {
  load(){
    const meta = this.loadMeta();
    const v2 = localStorage.getItem(V2_KEY);
    if(v2){
      const migration = canonicalizeDataWithMigration(JSON.parse(v2), meta.deviceId);
      const data = migration.data;
      if(migration.conflicts.length) console.warn("[CardFlow Card ID Migration] Bỏ qua do trùng ID đích", migration.conflicts);
      this.saveDataOnly(data);
      if(!meta.deviceId || migration.changed) this.saveMeta({...meta, deviceId:data.deviceId, dirty:meta.dirty || migration.changed, status:migration.changed ? "dirty" : meta.status});
      return data;
    }

    const v1 = localStorage.getItem(V1_KEY);
    const migration = canonicalizeDataWithMigration(v1 ? JSON.parse(v1) : cloneSeed(), meta.deviceId);
    const data = migration.data;
    if(migration.conflicts.length) console.warn("[CardFlow Card ID Migration] Bỏ qua do trùng ID đích", migration.conflicts);
    this.saveDataOnly(data);
    this.saveMeta({...meta, deviceId:data.deviceId, baseRevision:data.revision, dirty:meta.dirty || migration.changed, status:migration.changed ? "dirty" : meta.status});
    return data;
  }

  save(data, {dirty = true} = {}){
    const canonical = canonicalizeData({...data, updatedAt:new Date().toISOString()}, data.deviceId);
    this.saveDataOnly(canonical);
    const meta = this.loadMeta();
    this.saveMeta({...meta, deviceId:canonical.deviceId, dirty});
    return canonical;
  }

  saveDataOnly(data){
    localStorage.setItem(V2_KEY, JSON.stringify(data));
  }

  loadMeta(){
    try{
      const raw = JSON.parse(localStorage.getItem(META_KEY) || "{}");
      return {...defaultMeta(raw.deviceId || ""), ...raw};
    }catch{
      return defaultMeta("");
    }
  }

  saveMeta(meta){
    const {googleConnectionPreferred, ...safeMeta} = meta || {};
    localStorage.setItem(META_KEY, JSON.stringify({...defaultMeta(safeMeta.deviceId || ""), ...safeMeta}));
  }

  markClean(revision, lastSyncAt){
    const meta = this.loadMeta();
    this.saveMeta({...meta, baseRevision:revision, dirty:false, lastSyncAt, status:"synced"});
  }

  clearDriveLink(){
    const meta = this.loadMeta();
    this.saveMeta({...meta, fileId:"", baseRevision:0, dirty:true, status:"disconnected"});
  }
}
