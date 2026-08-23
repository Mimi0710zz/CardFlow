import { cloneSeed, MCC_DEFAULTS } from "./default-data.js";

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

export function canonicalizeData(input = {}, existingDeviceId = ""){
  const seed = cloneSeed();
  return {
    schemaVersion: 2,
    revision: Number(input.revision ?? 0),
    updatedAt: input.updatedAt || new Date().toISOString(),
    deviceId: input.deviceId || existingDeviceId || uuid(),
    cards: Array.isArray(input.cards) ? input.cards : seed.cards,
    cashbackPrograms: Array.isArray(input.cashbackPrograms) ? input.cashbackPrograms : (Array.isArray(input.programs) ? input.programs : seed.cashbackPrograms),
    hosts: normalizeHosts(input.hosts || seed.hosts),
    mccCategories: normalizeMcc(input.mccCategories),
    transactions: Array.isArray(input.transactions) ? input.transactions : [],
    payments: Array.isArray(input.payments) ? input.payments : [],
    settings: input.settings && typeof input.settings === "object" ? input.settings : {}
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
    localStorage.setItem(META_KEY, JSON.stringify({...defaultMeta(meta.deviceId || ""), ...meta}));
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
