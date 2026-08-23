import { BANK_MAPPINGS, cloneSeed, MCC_DEFAULTS } from "./default-data.js";
import { normalizeMoney } from "./money.js";
import { toStorageDate } from "./date.js";

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
    input.payments?.length ||
    input.hosts?.length ||
    input.banks?.length
  );
}

function normalizeCards(cards, banks){
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
    const rawStatementDay = card.statementDay === "" || card.statementDay == null ? "" : Number(card.statementDay);
    const statementDay = Number.isInteger(rawStatementDay) && rawStatementDay >= 1 && rawStatementDay <= 31 ? rawStatementDay : "";
    const legacyGroup = card.limitGroup || card.limitGroupId || card.id;
    const limitGroupId = card.limitGroupId || `LG-${String(legacyGroup).trim().toUpperCase().replace(/[^A-Z0-9-]+/g,"-").replace(/-+/g,"-")}`;
    const annualFee = card.annualFee === "" || card.annualFee == null ? null : normalizeMoney(card.annualFee, {emptyValue:0});
    return {...card, bankId, bank, cardForm:card.cardForm || "", statementDay, limitGroupId, limitGroup:card.limitGroup || legacyGroup, groupLimit:normalizeMoney(card.groupLimit, {emptyValue:0}), annualFee, notes:String(card.notes || "")};
  });
}

function normalizeCashbackPrograms(programs){
  return (programs || []).map(program => ({
    ...program,
    max: normalizeMoney(program.max, {emptyValue:0}),
    eligibleTarget: normalizeMoney(program.eligibleTarget, {emptyValue:0}),
    totalTarget: normalizeMoney(program.totalTarget, {emptyValue:0})
  }));
}

function normalizeTransactions(transactions){
  return (transactions || []).map(transaction => ({
    ...transaction,
    date: toStorageDate(transaction.date),
    backDate: toStorageDate(transaction.backDate),
    amount: normalizeMoney(transaction.amount, {emptyValue:0}),
    backAmount: normalizeMoney(transaction.backAmount, {emptyValue:0})
  }));
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
    amount: normalizeMoney(payment.amount, {emptyValue:0})
  }));
}

export function canonicalizeData(input = {}, existingDeviceId = ""){
  const seed = cloneSeed();
  const rawCards = Array.isArray(input.cards) ? input.cards : seed.cards;
  const banks = normalizeBanks(input.banks, rawCards);
  const meaningful = hasMeaningfulData(input);
  const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
  return {
    schemaVersion: 2,
    revision: Number(input.revision ?? 0),
    updatedAt: input.updatedAt || new Date().toISOString(),
    deviceId: input.deviceId || existingDeviceId || uuid(),
    banks,
    cards: normalizeCards(rawCards, banks),
    cashbackPrograms: normalizeCashbackPrograms(Array.isArray(input.cashbackPrograms) ? input.cashbackPrograms : (Array.isArray(input.programs) ? input.programs : seed.cashbackPrograms)),
    hosts: normalizeHosts(input.hosts || seed.hosts),
    mccCategories: normalizeMcc(input.mccCategories),
    transactions: normalizeTransactions(Array.isArray(input.transactions) ? input.transactions : []),
    cashbackReceipts: normalizeCashbackReceipts(Array.isArray(input.cashbackReceipts) ? input.cashbackReceipts : []),
    payments: normalizePayments(Array.isArray(input.payments) ? input.payments : []),
    settings: {...settings, setupCompleted:settings.setupCompleted === true || meaningful}
  };
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
      const data = canonicalizeData(JSON.parse(v2), meta.deviceId);
      this.saveDataOnly(data);
      if(!meta.deviceId) this.saveMeta({...meta, deviceId:data.deviceId});
      return data;
    }

    const v1 = localStorage.getItem(V1_KEY);
    const data = canonicalizeData(v1 ? JSON.parse(v1) : cloneSeed(), meta.deviceId);
    this.saveDataOnly(data);
    this.saveMeta({...meta, deviceId:data.deviceId, baseRevision:data.revision});
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
