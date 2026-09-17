# Cashback Package Runtime State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung runtime package state theo cashback period, hỗ trợ chọn ban đầu, đổi gói có giới hạn, lịch sử, kế thừa kỳ và phân loại giao dịch theo timestamp.

**Architecture:** `services/cashback-packages.js` là nguồn sự thật duy nhất cho period key, history, active package, initial selection, switching và transaction resolution. Evaluation, carry-forward, persistence và UI chỉ gọi các API này; chương trình legacy tiếp tục dùng nhánh cũ.

**Tech Stack:** JavaScript ES modules, Node.js assertion tests, HTML/CSS hiện có của CardFlow.

**Spec:** `Docs/superpowers/specs/2026-09-17-cashback-package-runtime-state-design.md`

## Global Constraints

- Không hard-code MB Platinum.
- Không fallback sang package đầu tiên khi chưa từng chọn.
- Timestamp dùng local ISO `YYYY-MM-DDTHH:mm:ss`; khoảng history có `effectiveTo` exclusive.
- `periodKey` dùng `${period.type}:${period.startDate}:${period.endDate}`.
- `packageHistory` lưu trong `cashbackProgramGroups[]`; schema giữ version 17.
- Initial/inherited package không tính là switch.
- UI và evaluation phải gọi cùng service resolution.
- Mọi thay đổi hành vi thực hiện theo Red → Green → Refactor.

---

### Task 1: Runtime history service và 4 case service đầu tiên

**Files:**
- Modify: `services/cashback-packages.js`
- Modify: `tests/cashback-packages.test.mjs`

**Interfaces:**
- Consumes: `getCashbackPeriodForCard(card, referenceDate)`.
- Produces: `cashbackPackagePeriodKey(period)`, `cashbackTransactionTimestamp(transaction)`, `getPackageHistoryForPeriod(program, period)`, `getActiveCashbackPackage(program, period, referenceTimestamp)`, `initializePeriodPackage(program, packageId, period)`, `switchCashbackPackage(program, packageId, effectiveTimestamp, card)`, `getPackageSwitchCount(program, period)`, `getRemainingPackageSwitches(program, period)`, `resolvePackageForTransaction(program, transaction, card)`.

- [ ] **Step 1: Viết test đỏ cho initial package**

```js
const initialized=initializePeriodPackage(programWithoutHistory,"LIFESTYLE",period);
assert.equal(initialized.program.packageHistory.length,1);
assert.equal(initialized.program.packageHistory[0].periodKey,"statement:2026-08-21:2026-09-20");
assert.equal(initialized.program.packageHistory[0].effectiveFrom,"2026-08-21T00:00:00");
assert.equal(getPackageSwitchCount(initialized.program,period),0);
```

- [ ] **Step 2: Chạy test và xác nhận FAIL vì API chưa tồn tại**

Run: `node tests/cashback-packages.test.mjs`

- [ ] **Step 3: Implement period key, timestamp normalization, history filter và initial selection tối thiểu**

```js
export const cashbackPackagePeriodKey=period=>`${period.type}:${period.startDate}:${period.endDate}`;
export function initializePeriodPackage(program,packageId,period){ /* validate + append initial record */ }
```

- [ ] **Step 4: Chạy test initial và xác nhận PASS**

Run: `node tests/cashback-packages.test.mjs`

- [ ] **Step 5: Viết test đỏ cho switch đóng record cũ/mở record mới**

```js
const switched=switchCashbackPackage(initialized.program,"DAILY","2026-09-15T10:30:00",card);
assert.equal(switched.program.packageHistory[0].effectiveTo,"2026-09-15T10:30:00");
assert.equal(switched.program.packageHistory[1].effectiveFrom,"2026-09-15T10:30:00");
assert.equal(getPackageSwitchCount(switched.program,period),1);
```

- [ ] **Step 6: Implement switch bằng timestamp đầy đủ và không mutate input**

- [ ] **Step 7: Viết test đỏ rồi implement limit=1 chặn switch thứ hai ở service**

```js
assert.match(switchCashbackPackage(switched.program,"LIFESTYLE","2026-09-16T09:00:00",card).error,/hết số lần đổi gói/i);
```

- [ ] **Step 8: Viết test đỏ rồi implement transaction resolution trước/sau switch**

```js
assert.equal(resolvePackageForTransaction(switched.program,tx("2026-09-15","10:29:59"),card).id,"LIFESTYLE");
assert.equal(resolvePackageForTransaction(switched.program,tx("2026-09-15","10:30:00"),card).id,"DAILY");
```

- [ ] **Step 9: Chạy test service và syntax**

Run: `node tests/cashback-packages.test.mjs && node --check services/cashback-packages.js`

### Task 2: Kế thừa kỳ mới và normalization/persistence

**Files:**
- Modify: `services/cashback-period.js`
- Modify: `services/local-repository.js`
- Modify: `tests/cashback-packages.test.mjs`

**Interfaces:**
- Consumes: service API Task 1.
- Produces: carry-forward history mới có `periodKey`, timestamp đầu kỳ và save/reload giữ nguyên history.

- [ ] **Step 1: Viết test đỏ cho kỳ mới kế thừa package cuối kỳ và count reset**

```js
const carried=carryForwardCashbackPrograms([switchedProgram],2026,10,[card]);
const next=carried.programs.at(-1);
assert.equal(getActiveCashbackPackage(next,nextPeriod,"2026-09-21T00:00:00").id,"DAILY");
assert.equal(getPackageSwitchCount(next,nextPeriod),0);
```

- [ ] **Step 2: Chạy test và xác nhận FAIL do carry-forward chưa dùng period-aware service**

- [ ] **Step 3: Implement carry-forward bằng package active cuối kỳ; không fallback package đầu tiên**

- [ ] **Step 4: Viết test đỏ persistence schema 17**

```js
const reloaded=canonicalizeData(JSON.parse(JSON.stringify(canonicalizeData(input))));
assert.deepEqual(reloaded.cashbackProgramGroups[0].packageHistory,input.cashbackProgramGroups[0].packageHistory);
assert.equal(reloaded.schemaVersion,17);
```

- [ ] **Step 5: Truyền card context vào normalization và nâng record ngày cũ thành đầu ngày + periodKey**

- [ ] **Step 6: Chạy test package, migration và repository**

Run: `node tests/cashback-packages.test.mjs && node tests/cashback-group-architecture.test.mjs && node tests/fee-target-migration.test.mjs`

### Task 3: Evaluation và legacy regression

**Files:**
- Modify: `services/cashback-evaluation.js`
- Modify: `tests/cashback-packages.test.mjs`
- Modify: `tests/cashback-group-architecture.test.mjs` nếu cần fixture rõ hơn

**Interfaces:**
- Consumes: `resolvePackageForTransaction()`.
- Produces: packaged evaluation phân bucket transaction theo timestamp; legacy evaluation giữ nguyên.

- [ ] **Step 1: Viết test đỏ evaluation với hai giao dịch cùng ngày nằm hai phía timestamp switch**

```js
const result=evaluateCashbackProgram(program,[beforeTx,afterTx],card,{mccCategories,referenceDate:"2026-09-16"});
assert.deepEqual(result.packages.find(x=>x.id==="LIFESTYLE").transactions.map(x=>x.id),["BEFORE"]);
assert.deepEqual(result.packages.find(x=>x.id==="DAILY").transactions.map(x=>x.id),["AFTER"]);
```

- [ ] **Step 2: Chạy test và xác nhận FAIL vì evaluation đang chỉ dùng ngày**

- [ ] **Step 3: Thay lời gọi active package bằng `resolvePackageForTransaction()`**

- [ ] **Step 4: Viết/chạy test legacy không packages với expected cashback hiện hữu**

Run: `node tests/cashback-packages.test.mjs && node tests/cashback-group-architecture.test.mjs`

- [ ] **Step 5: Chạy tracking/dashboard regression**

Run: `node tests/cashback-personal-spend.test.mjs && node tests/tracking-targets-deadline.test.mjs && node tests/bug-lazada-scope.test.mjs`

### Task 4: Runtime card, initial modal, switch modal và history UI

**Files:**
- Create: `services/cashback-package-runtime-view.js`
- Modify: `app.js`
- Modify: `styles.css`
- Create: `tests/cashback-package-runtime-ui.test.mjs`

**Interfaces:**
- Consumes: toàn bộ runtime service API Task 1.
- Produces: `buildCashbackPackageRuntimeView(program,card,referenceTimestamp)` trả view model compact; `app.js` render card và hai flow thao tác lưu qua `saveState()`.

- [ ] **Step 1: Viết test đỏ cho runtime view model**

```js
const emptyView=buildCashbackPackageRuntimeView(programWithoutHistory,card,"2026-09-10T12:00:00");
assert.equal(emptyView.activePackage,null);
assert.equal(emptyView.action,"initialize");
const activeView=buildCashbackPackageRuntimeView(switchedProgram,card,"2026-09-16T12:00:00");
assert.equal(activeView.activePackage.name,"Hằng ngày");
assert.equal(activeView.switchCount,1);
assert.equal(activeView.switchDisabled,true);
assert.deepEqual(activeView.history.map(item=>item.packageName),["Phong cách sống","Hằng ngày"]);
```

- [ ] **Step 2: Chạy test và xác nhận FAIL vì runtime card chưa tồn tại**

Run: `node tests/cashback-package-runtime-ui.test.mjs`

- [ ] **Step 3: Thêm renderer runtime card riêng trong tab chương trình**

`buildCashbackPackageRuntimeView()` lấy period và active history từ service; `app.js` không tự tính lại active package.

- [ ] **Step 4: Thêm modal chọn ban đầu dùng `openForm()` và `initializePeriodPackage()`**

- [ ] **Step 5: Thay flow đổi gói hiện tại bằng modal read-only timestamp, package đích và cảnh báo; gọi `switchCashbackPackage()`**

- [ ] **Step 6: Thêm `<details>` lịch sử tăng dần theo `effectiveFrom`; định dạng ngày giờ bằng helper hiện có**

- [ ] **Step 7: Thêm CSS compact desktop/mobile, tái sử dụng màu/button hiện có**

- [ ] **Step 8: Chạy UI test và syntax**

Run: `node tests/cashback-package-runtime-ui.test.mjs && node --check services/cashback-package-runtime-view.js && node --check app.js`

### Task 5: Xác minh đầy đủ 9 case và hồi quy

**Files:**
- Verify only.

- [ ] **Step 1: Chạy toàn bộ test**

Run: `Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName }`

- [ ] **Step 2: Chạy syntax cho mọi JavaScript thay đổi**

Run: `node --check app.js; node --check services/cashback-packages.js; node --check services/cashback-period.js; node --check services/cashback-evaluation.js; node --check services/local-repository.js`

- [ ] **Step 3: Chạy `git diff --check` và rà đúng 9 case spec**

- [ ] **Step 4: Kiểm tra trực quan desktop/mobile runtime card nếu môi trường trình duyệt khả dụng**

- [ ] **Step 5: Báo chính xác test chạy được, test không chạy được, schema và file thay đổi**
