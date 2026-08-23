import { canonicalizeData } from "./local-repository.js";

function materialChangeRatio(localData, driveData){
  const localCount = localData.banks.length + localData.cards.length + localData.cashbackPrograms.length + localData.hosts.length + localData.mccCategories.length + localData.transactions.length + localData.payments.length;
  const driveCount = driveData.banks.length + driveData.cards.length + driveData.cashbackPrograms.length + driveData.hosts.length + driveData.mccCategories.length + driveData.transactions.length + driveData.payments.length;
  if(!driveCount) return localCount ? 1 : 0;
  return Math.abs(localCount - driveCount) / driveCount;
}

function throwIfAborted(signal){
  if(signal?.aborted) throw new DOMException("Drive request aborted", "AbortError");
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
      const localData = canonicalizeData(this.getState(), meta.deviceId);
      const fileId = await this.ensureDriveFile(localData, {signal});
      throwIfAborted(signal);
      const driveData = canonicalizeData(await this.driveRepository.readFile(fileId, {signal}), localData.deviceId);
      throwIfAborted(signal);
      const currentMeta = this.localRepository.loadMeta();

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
    const data = canonicalizeData(driveData, this.localRepository.loadMeta().deviceId);
    this.setState(data);
    this.localRepository.save(data, {dirty:false});
    this.localRepository.markClean(data.revision, new Date().toISOString());
    this.emitStatus("synced");
  }

  async keepLocalVersion(){
    await this.syncNow({silent:false, forceKeepLocal:true});
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
