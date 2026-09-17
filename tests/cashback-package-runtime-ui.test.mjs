import assert from "node:assert/strict";
import fs from "node:fs";
import { getCashbackPeriodForCard } from "../services/cashback-period.js";
import { initializePeriodPackage, switchCashbackPackage } from "../services/cashback-packages.js";

const runtimeViewModule=await import("../services/cashback-package-runtime-view.js").catch(()=>({}));
assert.equal(typeof runtimeViewModule.buildCashbackPackageRuntimeView,"function","runtime package view builder must exist");
const {buildCashbackPackageRuntimeView}=runtimeViewModule;

const card={id:"CARD",cashbackCycle:"statement",statementDay:20};
const program={id:"PROGRAM",cardId:"CARD",name:"Selectable",packageSwitchLimit:1,packages:[
  {id:"LIFESTYLE",name:"Phong cách sống",groups:[]},
  {id:"DAILY",name:"Hằng ngày",groups:[]}
],packageHistory:[]};
const period=getCashbackPeriodForCard(card,"2026-09-16");

const emptyView=buildCashbackPackageRuntimeView(program,card,"2026-09-16T12:00:00");
assert.equal(emptyView.activePackage,null);
assert.equal(emptyView.action,"initialize");
assert.equal(emptyView.switchCount,0);
assert.equal(emptyView.history.length,0);

const initialized=initializePeriodPackage(program,"LIFESTYLE",period).program;
const switched=switchCashbackPackage(initialized,"DAILY","2026-09-15T10:30:00",card).program;
const activeView=buildCashbackPackageRuntimeView(switched,card,"2026-09-16T12:00:00");
assert.equal(activeView.activePackage.name,"Hằng ngày");
assert.equal(activeView.activeSince,"2026-09-15T10:30:00");
assert.equal(activeView.switchCount,1);
assert.equal(activeView.switchLimit,1);
assert.equal(activeView.switchDisabled,true);
assert.equal(activeView.action,"switch");
assert.deepEqual(activeView.history.map(item=>item.packageName),["Phong cách sống","Hằng ngày"]);
assert.equal(activeView.history[1].effectiveTo,null);

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../styles.css",import.meta.url),"utf8");
assert.match(app,/GÓI HOÀN TIỀN HIỆN TẠI/);
assert.match(app,/Chưa thiết lập/);
assert.match(app,/Chọn gói ban đầu/);
assert.match(app,/data-manage-cashback-package \$\{view\.switchDisabled\?"disabled":""\}/);
assert.match(app,/LỊCH SỬ GÓI/);
assert.match(app,/options:\[\{value:"",label:"Chọn gói hoàn tiền"\},\.\.\.program\.packages/);
assert.match(app,/<th>Gói<\/th><th>Từ<\/th><th>Đến<\/th>/);
assert.match(app,/function cashbackRuntimeTimestamp\(\)\{\s*return `\$\{todayStorageDate\(\)\}T\$\{currentTransactionTime\(\)\}`;/);
assert.match(css,/\.cashback-runtime-card\{/);

console.log("cashback package runtime UI tests passed");
