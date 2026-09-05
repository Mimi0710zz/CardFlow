import { BANK_MAPPINGS, cloneSeed, MCC_DEFAULTS } from "./default-data.js";
import { normalizeMoney } from "./money.js";
import { toStorageDate } from "./date.js";
import { calculateSpendToMax, isLegacyVpDebitFakeUnlimited, normalizeCombineOperator, normalizeProgramMcc } from "./cashback.js";
import { TRANSACTION_STATUS, normalizeTransactionStatus } from "./transaction-status.js";

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
    mcc: Number(item.mcc ?? item[1] ?? 0)
  })).filter(x => x.name);
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

function normalizeBanks(inputBanks, cards){
  const byCode = new Map();
  const addBank = bank => {
    const code = cleanBankCode(bank.code);
    const name = String(bank.name || "").trim();
    if(!code || !name || byCode.has(code)) return;
    byCode.set(code, {id:bank.id || bankIdFromCode(code), code, name});
  };
  (inputBanks || []).forEach(addBank);
  (cards || []).forEach(card => {
    if(card.bankId && byCode.has(String(card.bankId).replace(/^BANK-/,""))) return;
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
    const cardType = card.cardType === "debit" ? "debit" : "credit";
    const rawStatementDay = card.statementDay === "" || card.statementDay == null ? "" : Number(card.statementDay);
    const statementDay = cardType === "debit" ? "" : (Number.isInteger(rawStatementDay) && rawStatementDay >= 1 && rawStatementDay <= 31 ? rawStatementDay : "");
    const legacyGroup = cardType === "debit" ? "" : (card.limitGroup || card.limitGroupId || card.id);
    const limitGroupId = cardType === "debit" ? "" : (card.limitGroupId || `LG-${String(legacyGroup).trim().toUpperCase().replace(/[^A-Z0-9-]+/g,"-").replace(/-+/g,"-")}`);
    const annualFee = card.annualFee === "" || card.annualFee == null ? null : normalizeMoney(card.annualFee, {emptyValue:0});
    const rawPaymentDueDay = card.paymentDueDay === "" || card.paymentDueDay == null ? null : Number(card.paymentDueDay);
    const paymentDueDay = Number.isInteger(rawPaymentDueDay) && rawPaymentDueDay >= 1 && rawPaymentDueDay <= 31 ? rawPaymentDueDay : null;
    const paymentTrackingStartMonth = paymentDueDay == null ? "" : (/^\d{4}-(0[1-9]|1[0-2])$/.test(card.paymentTrackingStartMonth || "") ? card.paymentTrackingStartMonth : fallbackTrackingMonth);
    const cashbackCycle = card.cashbackCycle === "monthly" || card.cashbackCycle === "statement" ? card.cashbackCycle : "";
    return {...card, cardType, bankId, bank, cardForm:card.cardForm || "", cashbackCycle, statementDay, paymentDueDay, paymentTrackingStartMonth, limitGroupId, limitGroup:cardType === "debit" ? "" : (card.limitGroup || legacyGroup), groupLimit:cardType === "debit" ? 0 : normalizeMoney(card.groupLimit, {emptyValue:0}), annualFee, notes:String(card.notes || "")};
  });
}

function normalizeCashbackPrograms(programs, mccCategories, fallbackPeriod={}){
  return (programs || []).map(program => {
    const isKnownDebitFakeUnlimited = isLegacyVpDebitFakeUnlimited(program);
    const maxCashbackUnlimited = program.maxCashbackUnlimited === true || isKnownDebitFakeUnlimited;
    const max = maxCashbackUnlimited ? null : normalizeMoney(program.max, {emptyValue:0});
    const rate = Number(program.rate) || 0;
    const eligibleTarget = maxCashbackUnlimited ? null : calculateSpendToMax(rate, max);
    const rawTotalTarget = normalizeMoney(program.totalTarget, {emptyValue:null});
    const totalTarget = rawTotalTarget == null || (maxCashbackUnlimited && (rawTotalTarget === 0 || (isKnownDebitFakeUnlimited && rawTotalTarget === 999999999999))) ? null : rawTotalTarget;
    const totalTargetManuallyEdited = program.totalTargetManuallyEdited === true ||
      (totalTarget != null && (eligibleTarget == null || totalTarget !== eligibleTarget));
    const legacySharedCap = program.legacySharedCap ?? program.shared ?? null;
    return {
      ...program,
      ...normalizeProgramMcc(program, mccCategories),
      rate,
      max,
      maxCashbackUnlimited,
      eligibleTarget,
      totalTarget,
      totalTargetManuallyEdited,
      combineOperator:normalizeCombineOperator(program.combineOperator),
      ...(legacySharedCap == null ? {} : {legacySharedCap}),
      year:Number.isInteger(Number(program.year)) ? Number(program.year) : Number(fallbackPeriod.year),
      month:Number.isInteger(Number(program.month)) && Number(program.month)>=1 && Number(program.month)<=12 ? Number(program.month) : Number(fallbackPeriod.month)
    };
  });
}

function hasCashbackProgramPeriodMigration(programs){
  return (programs || []).some(program=>!Number.isInteger(Number(program.year)) || !Number.isInteger(Number(program.month)) || Number(program.month)<1 || Number(program.month)>12);
}

function normalizeTransactions(transactions){
  return (transactions || []).map(transaction => {
    const status = normalizeTransactionStatus(transaction.status);
    const personalUse = status === TRANSACTION_STATUS.PERSONAL_USE;
    return {
      ...transaction,
      date: toStorageDate(transaction.date),
      host: personalUse ? null : (transaction.host || ""),
      category: String(transaction.category || "").trim(),
      backDate: personalUse ? "" : toStorageDate(transaction.backDate),
      status,
      amount: normalizeMoney(transaction.amount, {emptyValue:0}),
      backAmount: personalUse ? 0 : normalizeMoney(transaction.backAmount, {emptyValue:0})
    };
  });
}

function hasTransactionStatusMigration(transactions){
  return (transactions || []).some(transaction => {
    const status = normalizeTransactionStatus(transaction.status);
    return transaction.status !== status ||
      (status === TRANSACTION_STATUS.PERSONAL_USE && (transaction.host != null || toStorageDate(transaction.backDate) || normalizeMoney(transaction.backAmount, {emptyValue:0}) !== 0));
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

function normalizeFeeTargets(targets,mccCategories){
  return (targets || []).map(target=>{
    const mcc=normalizeProgramMcc(target,mccCategories);
    return {
      ...target,
      feeType:target.feeType || "annual_fee",
      feeAmount:normalizeMoney(target.feeAmount,{emptyValue:0}),
      conditionType:target.conditionType || "spend_target",
      targetAmount:normalizeMoney(target.targetAmount,{emptyValue:0}),
      periodStart:toStorageDate(target.periodStart),
      periodEnd:toStorageDate(target.periodEnd),
      allMcc:mcc.allMcc,
      mccCategoryIds:mcc.mccCategoryIds,
      channel:target.channel || "all",
      reminderEnabled:target.reminderEnabled !== false,
      notes:String(target.notes || "")
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
  const banks = normalizeBanks(input.banks, rawCards);
  const mccCategories = normalizeMcc(input.mccCategories);
  const meaningful = hasMeaningfulData(input);
  const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
  const fallbackProgramDate=/^\d{4}-\d{2}/.test(input.updatedAt || "") ? new Date(`${input.updatedAt.slice(0,7)}-01T00:00:00`) : new Date();
  const fallbackProgramPeriod={year:fallbackProgramDate.getFullYear(),month:fallbackProgramDate.getMonth()+1};
  const canonical = {
    schemaVersion: 4,
    revision: Number(input.revision ?? 0),
    updatedAt: input.updatedAt || new Date().toISOString(),
    deviceId: input.deviceId || existingDeviceId || uuid(),
    banks,
    cards: normalizeCards(rawCards, banks, /^\d{4}-\d{2}/.test(input.updatedAt || "") ? input.updatedAt.slice(0,7) : `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`),
    cashbackPrograms: normalizeCashbackPrograms(rawCashbackPrograms, mccCategories, fallbackProgramPeriod),
    hosts: normalizeHosts(input.hosts || seed.hosts),
    mccCategories,
    transactions: normalizeTransactions(rawTransactions),
    cashbackReceipts: normalizeCashbackReceipts(Array.isArray(input.cashbackReceipts) ? input.cashbackReceipts : []),
    feeTargets: normalizeFeeTargets(Array.isArray(input.feeTargets) ? input.feeTargets : [],mccCategories),
    payments: normalizePayments(Array.isArray(input.payments) ? input.payments : []),
    settings: {...settings, setupCompleted:settings.setupCompleted === true || meaningful}
  };
  return {data:canonical, changed:Number(input.schemaVersion || 0)!==4 || transactionStatusChanged || cashbackProgramPeriodChanged, cardIdMap:{}, groupIdMap:{}, conflicts:[]};
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
