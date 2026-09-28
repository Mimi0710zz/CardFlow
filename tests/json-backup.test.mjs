import test from "node:test";
import assert from "node:assert/strict";
import { buildCardFlowBackupFilename, validateCardFlowBackupJson } from "../services/json-backup.js";

test("accepts CardFlow schema 20 backup",()=>{
  const result=validateCardFlowBackupJson({schemaVersion:20,cards:[],transactions:[],payments:[]});
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
  assert.equal(file,"CardFlow_Client_Backup_20260928-150205.json");
});
