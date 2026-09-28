import test from "node:test";
import assert from "node:assert/strict";
import { buildCardFlowBackupFilename, createCardFlowBackup, validateCardFlowBackupJson } from "../services/json-backup.js";

test("accepts CardFlow schema 20 backup",()=>{
  const result=validateCardFlowBackupJson(createCardFlowBackup({schemaVersion:20,cards:[],transactions:[],payments:[]},"2026-09-28T08:00:00.000Z"));
  assert.equal(result.valid,true);
  assert.equal(result.summary.schemaVersion,20);
});

test("rejects unrelated JSON",()=>{
  const result=validateCardFlowBackupJson({hello:"world"});
  assert.equal(result.valid,false);
  assert.ok(result.errors.length>=1);
});

test("builds deterministic backup filename",()=>{
  const file=buildCardFlowBackupFilename(new Date(2026,8,28,15,2,5));
  assert.equal(file,"CardFlow_Backup_20260928-150205.json");
});

test("rejects incompatible envelope without exposing partial data",()=>{
  const result=validateCardFlowBackupJson({format:"CardFlowBackup",version:99,exportedAt:"2026-09-28T08:00:00.000Z",data:{schemaVersion:20,cards:[],transactions:[]}});
  assert.equal(result.valid,false);
  assert.match(result.errors.join(" "),/không được hỗ trợ/);
});

test("round trip preserves business IDs and excludes secrets",()=>{
  const source={schemaVersion:20,deviceId:"DEVICE-1",cards:[{id:"CARD-1"}],transactions:[{id:"TX-1",cardId:"CARD-1"}],cashbackProgramGroups:[{id:"PROGRAM-1",cardId:"CARD-1"}],cashbackReceipts:[{id:"RECEIPT-1",cardId:"CARD-1"}],settings:{setupCompleted:true},accessToken:"SECRET",uiState:{open:true}};
  const parsed=JSON.parse(JSON.stringify(createCardFlowBackup(source,"2026-09-28T08:00:00.000Z")));
  const result=validateCardFlowBackupJson(parsed);
  assert.equal(result.valid,true);
  assert.deepEqual(result.data.cards,source.cards);
  assert.deepEqual(result.data.transactions,source.transactions);
  assert.deepEqual(result.data.cashbackProgramGroups,source.cashbackProgramGroups);
  assert.equal("accessToken" in result.data,false);
  assert.equal("uiState" in result.data,false);
});
