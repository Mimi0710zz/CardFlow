import { canonicalizeData, canonicalizeDataWithMigration } from "./local-repository.js?v=20260926-transaction-fee-v1";

function materialChangeRatio(localData, driveData){
  const localCount = localData.banks.length + localData.cards.length + (localData.cashbackProgramGroups||[]).length + localData.hosts.length + localData.mccCategories.length + localData.transactions.length + localData.cashbackReceipts.length + (localData.trackingCashbackReceipts||[]).length + localData.feeTargets.length + localData.payments.length;
  const driveCount = driveData.banks.length + driveData.cards.length + (driveData.cashbackProgramGroups||driveData.cashbackPrograms||[]).length + driveData.hosts.length + driveData.mccCategories.length + driveData.transactions.length + driveData.cashbackReceipts.length + (driveData.trackingCashbackReceipts||[]).length + driveData.feeTargets.length + driveData.payments.length;
  if(!driveCount) return localCount ? 1 : 0;
  return Math.abs(localCount - driveCount) / driveCount;
}

function throwIfAborted(signal){
  if(signal?.aborted) throw new DOMException("Drive request aborted", "AbortError");
}

function stableValue(value){
  if(Array.isArray(value)) return value.map(stableValue);
  if(value&&typeof value==="object") return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));
  return value;
}

function persistedComparisonValue(data){
  const canonical=canonicalizeData(data,data?.deviceId||"");
  const {revision,updatedAt,deviceId,...persisted}=canonical;
  return stableValue(persisted);
}

export function canonicalPersistedDataEqual(localData,driveData){
  return JSON.stringify(persistedComparisonValue(localData))===JSON.stringify(persistedComparisonValue(driveData));
}

export async function runConfirmedDriveSync(confirmSync,sync){
  if(!await confirmSync()) return false;
  await sync();
  return true;
}

export async function applyDriveConflictChoice(choice,{downloadDrive,keepLocal}){
  if(choice==="download") await downloadDrive();
  if(choice==="keep_local") await keepLocal();
  return choice;
}

export class SyncService extends EventTarget {
  constructor({localRepository, driveRepository, auth, getState, setState}){
    super();
    this.localRepository = localRepository;
    this.driveRepository = driveRepository;
    this.auth = auth;
    this.getState = getState;
    this.setState = setState;
    this.timer = null;
    window.addEventListener("online", () => this.syncNow({silent:true}));
  }

  emitStatus(status, detail = {}){
    const meta = this.localRepository.loadMeta();
    this.localRepository.saveMeta({...meta, status});
    this.dispatchEvent(new CustomEvent("status", {detail:{status, meta:this.localRepository.loadMeta(), ...detail}}));
  }

  schedule(){
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.syncNow({silent:true}), 1200);
  }

  async connect(){
    await this.auth.connect();
    this.emitStatus("dirty");
    return this.syncNow({silent:false});
  }

  disconnect(){
    this.auth.disconnect();
    this.localRepository.clearDriveLink();
    this.emitStatus("disconnected");
  }

  async ensureDriveFile(localData, {signal} = {}){
    const meta = this.localRepository.loadMeta();
    if(meta.fileId) return meta.fileId;
    throwIfAborted(signal);
    const found = await this.driveRepository.findDataFile({signal});
    if(found){
      this.localRepository.saveMeta({...meta, fileId:found.id});
      return found.id;
    }
    throwIfAborted(signal);
    const created = await this.driveRepository.createFile({...localData, revision:0, updatedAt:new Date().toISOString()}, {signal});
    this.localRepository.markClean(0, new Date().toISOString());
    this.localRepository.saveMeta({...this.localRepository.loadMeta(), fileId:created.id});
    return created.id;
  }

  async inspectAfterConnect({signal=null}={}){
    throwIfAborted(signal);
    this.emitStatus("syncing");
    const meta=this.localRepository.loadMeta();
    const localData=canonicalizeData(this.getState(),meta.deviceId);
    const found=await this.driveRepository.findDataFile({signal});
    throwIfAborted(signal);
    if(!found){
      this.localRepository.saveMeta({...this.localRepository.loadMeta(),fileId:"",dirty:true,status:"dirty"});
      this.emitStatus("dirty");
      return {conflict:false,missing:true};
    }
    const driveMigration=canonicalizeDataWithMigration(await this.driveRepository.readFile(found.id,{signal}),localData.deviceId);
    const driveData=driveMigration.data;
    throwIfAborted(signal);
    this.localRepository.saveMeta({...this.localRepository.loadMeta(),fileId:found.id});
    if(!canonicalPersistedDataEqual(localData,driveData)){
      this.emitStatus("conflict",{driveData});
      return {conflict:true,driveData};
    }
    const aligned={...localData,revision:driveData.revision,updatedAt:driveData.updatedAt};
    this.setState(aligned);
    this.localRepository.saveDataOnly(aligned);
    this.localRepository.markClean(driveData.revision,new Date().toISOString());
    this.localRepository.saveMeta({...this.localRepository.loadMeta(),fileId:found.id});
    this.emitStatus("synced");
    return {conflict:false,driveData};
  }

  async syncNow({silent = false, forceKeepLocal = false, signal = null} = {}){
    if(!navigator.onLine){
      this.emitStatus("dirty");
      if(!silent) throw new Error("offline");
      return;
    }
    if(!this.auth.isConfigured()){
      this.emitStatus("disconnected");
      if(!silent) throw new Error("missing-client-id");
      return;
    }
    try{
      throwIfAborted(signal);
      this.emitStatus("syncing");
      if(!this.auth.hasToken()){
        this.emitStatus("disconnected");
        if(!silent) throw new Error("not-authenticated");
        return;
      }
      throwIfAborted(signal);
      const meta = this.localRepository.loadMeta();
      let localData = canonicalizeData(this.getState(), meta.deviceId);
      const fileId = await this.ensureDriveFile(localData, {signal});
      throwIfAborted(signal);
      const driveMigration = canonicalizeDataWithMigration(await this.driveRepository.readFile(fileId, {signal}), localData.deviceId);
      const driveData = driveMigration.data;
      throwIfAborted(signal);
      let currentMeta = this.localRepository.loadMeta();

      if(driveMigration.changed && driveData.revision >= localData.revision && !currentMeta.dirty){
        this.setState(driveData);
        localData = this.localRepository.save(driveData, {dirty:true});
        this.localRepository.saveMeta({...this.localRepository.loadMeta(), baseRevision:driveData.revision, fileId});
        currentMeta = this.localRepository.loadMeta();
      }

      if(driveData.revision > localData.revision && !currentMeta.dirty && !forceKeepLocal){
        this.setState(driveData);
        this.localRepository.save(driveData, {dirty:false});
        this.localRepository.markClean(driveData.revision, new Date().toISOString());
        this.emitStatus("synced");
        return;
      }

      if(currentMeta.dirty){
        if(!forceKeepLocal && driveData.revision !== currentMeta.baseRevision){
          this.emitStatus("conflict", {driveData});
          return;
        }
        await this.maybeBackupDrive(fileId, localData, driveData, {signal});
        const uploadData = {...localData, revision:driveData.revision + 1, updatedAt:new Date().toISOString(), deviceId:localData.deviceId};
        await this.driveRepository.updateFile(fileId, uploadData, {signal});
        this.setState(uploadData);
        this.localRepository.save(uploadData, {dirty:false});
        this.localRepository.markClean(uploadData.revision, new Date().toISOString());
        this.localRepository.saveMeta({...this.localRepository.loadMeta(), fileId});
        this.emitStatus("synced");
        return;
      }

      if(driveData.revision > localData.revision){
        this.setState(driveData);
        this.localRepository.save(driveData, {dirty:false});
        this.localRepository.markClean(driveData.revision, new Date().toISOString());
      }
      this.localRepository.saveMeta({...this.localRepository.loadMeta(), fileId});
      this.emitStatus("synced");
    }catch(error){
      console.error("[Google Drive Sync]", {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        status: error?.status
      });
      if(error.name === "AbortError"){
        this.emitStatus("disconnected", {error});
        if(!silent) throw error;
        return;
      }
      this.emitStatus("dirty", {error});
      if(!silent) throw error;
    }
  }

  async downloadDriveVersion(driveData){
    const migration = canonicalizeDataWithMigration(driveData, this.localRepository.loadMeta().deviceId);
    const data = migration.data;
    this.setState(data);
    this.localRepository.saveDataOnly(data);
    if(migration.changed){
      this.localRepository.saveMeta({...this.localRepository.loadMeta(), baseRevision:data.revision, dirty:true, status:"dirty"});
      this.emitStatus("dirty");
    }else{
      this.localRepository.markClean(data.revision, new Date().toISOString());
      this.emitStatus("synced");
    }
  }

  async keepLocalVersion(driveData=null){
    const meta=this.localRepository.loadMeta();
    this.localRepository.saveMeta({...meta,baseRevision:driveData?.revision??meta.baseRevision,dirty:true,status:"dirty"});
    this.emitStatus("dirty");
  }

  async maybeBackupDrive(fileId, localData, driveData, {signal} = {}){
    const meta = this.localRepository.loadMeta();
    const today = new Date().toISOString().slice(0,10);
    if(meta.lastBackupDate === today) return;
    if(driveData.revision > 0 && materialChangeRatio(localData, driveData) >= 0.25){
      await this.driveRepository.createBackup({...driveData, backupOf:fileId, backedUpAt:new Date().toISOString()}, {signal});
      this.localRepository.saveMeta({...this.localRepository.loadMeta(), lastBackupDate:today});
    }
  }
}
