import assert from "node:assert/strict";

globalThis.window={addEventListener(){}};

const {SyncService,applyDriveConflictChoice,canonicalPersistedDataEqual,runConfirmedDriveSync}=await import("../services/sync-service.js");

const data=(name,{revision=1,updatedAt="2026-09-18T00:00:00.000Z",deviceId="DEVICE-A",transient}={})=>({
  schemaVersion:18,revision,updatedAt,deviceId,
  banks:[],cards:[],cashbackProgramGroups:[],hosts:[{id:"HOST-1",name}],mccCategories:[],orderTypes:[],transactions:[],cashbackReceipts:[],feeTargets:[],payments:[],reminders:[],settings:{setupCompleted:true},
  transient
});

assert.equal(canonicalPersistedDataEqual(
  data("Giống nhau",{revision:1,updatedAt:"2026-09-18T00:00:00.000Z",deviceId:"LOCAL",transient:{selectedTab:"cards"}}),
  data("Giống nhau",{revision:8,updatedAt:"2026-09-19T00:00:00.000Z",deviceId:"DRIVE",transient:{selectedTab:"programs"}})
),true,"metadata và trạng thái UI không được tạo xung đột giả");
assert.equal(canonicalPersistedDataEqual(data("Bản máy"),data("Bản Drive")),false,"dữ liệu nghiệp vụ khác nhau phải tạo xung đột");

function harness(localData,driveData){
  let state=structuredClone(localData),uploads=0;
  const meta={deviceId:"LOCAL",fileId:"",baseRevision:0,dirty:true,status:"dirty"};
  const localRepository={
    loadMeta:()=>({...meta}),
    saveMeta:value=>Object.assign(meta,value),
    saveDataOnly:value=>{state=structuredClone(value);},
    save:(value,{dirty=true}={})=>{state=structuredClone(value);meta.dirty=dirty;return state;},
    markClean:(revision,lastSyncAt)=>Object.assign(meta,{baseRevision:revision,lastSyncAt,dirty:false,status:"synced"})
  };
  const driveRepository={
    findDataFile:async()=>({id:"DRIVE-FILE"}),
    readFile:async()=>structuredClone(driveData),
    updateFile:async()=>{uploads+=1;}
  };
  const service=new SyncService({localRepository,driveRepository,auth:{isConfigured:()=>true,hasToken:()=>true},getState:()=>state,setState:value=>{state=structuredClone(value);}});
  return {service,get state(){return state;},get uploads(){return uploads;},meta};
}

const equal=harness(data("Giống nhau"),data("Giống nhau",{revision:4,deviceId:"DRIVE"}));
const equalResult=await equal.service.inspectAfterConnect();
assert.equal(equalResult.conflict,false);
assert.equal(equal.uploads,0,"kết nối với dữ liệu giống nhau không được upload");

const conflict=harness(data("Bản máy"),data("Bản Drive",{revision:4,deviceId:"DRIVE"}));
const conflictResult=await conflict.service.inspectAfterConnect();
assert.equal(conflictResult.conflict,true);
assert.equal(conflict.state.hosts[0].name,"Bản máy","phát hiện xung đột không được tự download");
assert.equal(conflict.uploads,0,"phát hiện xung đột không được tự upload");

await conflict.service.keepLocalVersion(conflictResult.driveData);
assert.equal(conflict.state.hosts[0].name,"Bản máy");
assert.equal(conflict.uploads,0,"giữ bản máy không được upload");

const download=harness(data("Bản máy"),data("Bản Drive",{revision:4,deviceId:"DRIVE"}));
await download.service.downloadDriveVersion(data("Bản Drive",{revision:4,deviceId:"DRIVE"}));
assert.equal(download.state.hosts[0].name,"Bản Drive");
assert.equal(download.uploads,0,"tải bản Drive không được upload ngược ngay");

let syncCount=0;
assert.equal(await runConfirmedDriveSync(async()=>false,async()=>{syncCount+=1;}),false);
assert.equal(syncCount,0,"chọn Không không được đồng bộ");
assert.equal(await runConfirmedDriveSync(async()=>true,async()=>{syncCount+=1;}),true);
assert.equal(syncCount,1,"chọn Có phải chạy đúng workflow đồng bộ hiện tại");

let downloaded=0,kept=0;
await applyDriveConflictChoice("cancel",{downloadDrive:async()=>{downloaded+=1;},keepLocal:async()=>{kept+=1;}});
assert.deepEqual([downloaded,kept],[0,0],"Huỷ không được sửa local hoặc Drive");
await applyDriveConflictChoice("download",{downloadDrive:async()=>{downloaded+=1;},keepLocal:async()=>{kept+=1;}});
await applyDriveConflictChoice("keep_local",{downloadDrive:async()=>{downloaded+=1;},keepLocal:async()=>{kept+=1;}});
assert.deepEqual([downloaded,kept],[1,1],"mỗi lựa chọn chỉ chạy đúng một action");

console.log("drive conflict safety tests passed");
