# MB Platinum Cashback Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Cashback Program thành chương trình trực tiếp theo thẻ và bổ sung workflow MB Platinum theo slot, package luân phiên và kỳ sao kê.

**Architecture:** Giữ `cashbackProgramGroups` làm collection persisted tương thích nhưng canonicalize mỗi phần tử thành một chương trình trực tiếp. Tạo `services/mb-platinum-cashback.js` làm domain strategy thuần, gọi strategy này từ engine và form hiện hữu; cấu hình cấp thẻ nằm trong `cashbackCardConfigs`, còn slot luôn được suy ra từ giao dịch.

**Tech Stack:** Vanilla JavaScript ES modules, browser LocalStorage, Google Drive JSON sync, SheetJS Excel, Node.js `assert` tests.

**Spec:** `Docs/superpowers/specs/2026-09-23-mb-platinum-cashback-refactor-design.md`

## Global Constraints

- Card ID MB Platinum là `MB Pla`; không nhận diện bằng display text.
- Package ID chỉ dùng `DAILY` và `LIFESTYLE`; kỳ tính là kỳ sao kê dùng chung.
- Không lưu bộ đếm slot; luôn suy ra từ transactions và program configuration.
- Local, Drive và Excel cũ phải tiếp tục đọc được; migration không xóa dữ liệu chưa ánh xạ.
- UI tiếng Việt, giữ helper/style nút hiện hữu, không sửa module không liên quan.
- Mọi behavior mới đi qua RED → GREEN → REFACTOR.

## Review Focus

- Program ID hợp lệ nhưng Package ID sai không chiếm slot; Task 3 kiểm thử.
- Hai giao dịch cùng ngày/giờ phân bổ ổn định bằng ID; Task 3 kiểm thử với array đảo thứ tự.
- Edit không tự xung đột với chính giao dịch hiện tại; Task 5 kiểm thử `excludeTransactionId`.
- Condition ID legacy trùng giữa hai parent sinh ID ổn định, không mất dòng; Task 2 kiểm thử.
- `statementDay` 29–31 qua tháng ngắn vẫn luân phiên đúng; Task 3 kiểm thử tháng 2.

---

### Task 1: Domain constants và cấu hình MB Platinum

**Files:**
- Create: `services/mb-platinum-cashback.js`
- Create: `tests/mb-platinum-cashback-config.test.mjs`

**Interfaces:**
- Produces: `MB_PLATINUM_CARD_ID`, `MB_PLATINUM_PACKAGE_IDS`, `MB_PLATINUM_PACKAGE_LABELS`, `isMbPlatinumCard(cardId)`, `normalizeMbPlatinumCardConfig(config,card,options)`.

- [ ] **Step 1: Write the failing test**

```js
assert.equal(MB_PLATINUM_CARD_ID,"MB Pla");
assert.deepEqual(MB_PLATINUM_PACKAGE_IDS,["DAILY","LIFESTYLE"]);
assert.equal(isMbPlatinumCard("MB Platinum"),false);
assert.deepEqual(normalizeMbPlatinumCardConfig({},card,{referenceDate:"2026-09-12"}),{
  cardId:"MB Pla",statementMinSpend:5000000,
  rotationAnchorPeriodKey:"statement:2026-08-21:2026-09-20",
  rotationAnchorPrimaryPackageId:"LIFESTYLE"
});
```

- [ ] **Step 2: Run `node tests/mb-platinum-cashback-config.test.mjs` and confirm missing-module FAIL.**
- [ ] **Step 3: Implement constants and normalization; validate package ID, money and statement anchor while preserving unknown metadata with object spread.**
- [ ] **Step 4: Run the same test and confirm PASS.**
- [ ] **Step 5: Commit `feat: add MB Platinum cashback domain config`.**

### Task 2: Flat-program migration and persisted schema

**Files:**
- Modify: `services/local-repository.js`
- Modify: `services/default-data.js`
- Modify: `services/sync-service.js`
- Modify: `tests/cashback-program-migration.test.mjs`
- Create: `tests/mb-platinum-persistence.test.mjs`

**Interfaces:**
- Consumes: Task 1 config normalization.
- Produces: canonical flat `cashbackProgramGroups[]`, `cashbackCardConfigs[]`, and transaction fields `cashbackPackageId`/`cashbackProgramId`.

- [ ] **Step 1: Add a failing migration fixture** with parent `LEGACY` containing conditions `FOOD` and `SHOP`; assert two flat programs, child names/IDs, preserved `legacyProgram` metadata and idempotent second canonicalization. Add packaged same-name programs and duplicate condition IDs; assert separate package IDs and unique stable IDs.
- [ ] **Step 2: Run `node tests/cashback-program-migration.test.mjs`; confirm FAIL because nesting remains.**
- [ ] **Step 3: Implement `flattenLegacyCashbackPrograms`, `uniqueMigratedProgramId`, `normalizeCashbackCardConfigs`; bump schema consistently and preserve unknown legacy fields.**
- [ ] **Step 4: Add failing persistence assertions:**

```js
assert.equal(canonical.transactions[0].cashbackPackageId,"DAILY");
assert.equal(canonical.transactions[0].cashbackProgramId,"DAILY-FOOD");
assert.equal(canonical.cashbackCardConfigs[0].statementMinSpend,5000000);
assert.equal(canonicalPersistedDataEqual(canonical,structuredClone(canonical)),true);
```

- [ ] **Step 5: Run persistence test, implement sync canonical comparison/count support, then run:**

```powershell
node tests/cashback-program-migration.test.mjs
node tests/mb-platinum-persistence.test.mjs
node tests/drive-conflict-safety.test.mjs
```

Expected: all PASS.

- [ ] **Step 6: Commit `feat: migrate cashback programs to flat schema`.**

### Task 3: Statement rotation, qualification and slot derivation

**Files:**
- Modify: `services/mb-platinum-cashback.js`
- Create: `tests/mb-platinum-cashback-slots.test.mjs`

**Interfaces:**
- Produces: `resolveMbPlatinumPackageRotation`, `isMbPlatinumProgramTransactionEligible`, `deriveMbPlatinumSlotUsage`, `validateMbPlatinumAssignment`.

- [ ] **Step 1: Write failing rotation assertions** for three consecutive statement periods, expecting `LIFESTYLE → DAILY → LIFESTYLE` as primary, plus a `statementDay:31` February boundary.
- [ ] **Step 2: Run slot test and confirm missing-export FAIL.**
- [ ] **Step 3: Implement parity from successive statement periods, never calendar-month parity.**
- [ ] **Step 4: Add failing slot cases:** first/second distinct primary programs occupy 1/2 and 2/2; duplicate remains 2/2; third distinct primary rejects; one secondary succeeds; unassigned/MCC mismatch/channel mismatch/wrong package consume none; next period is isolated; `excludeTransactionId` frees edit slot; reversed tied input produces identical IDs.
- [ ] **Step 5: Run test and confirm behavior FAIL.**
- [ ] **Step 6: Implement deterministic sort by `date`, `transactionTime`, `id`, eligibility filtering and validation result:**

```js
{valid:boolean,duplicate:boolean,message:string,usage,program}
```

- [ ] **Step 7: Run:**

```powershell
node tests/mb-platinum-cashback-slots.test.mjs
node tests/cashback-period.test.mjs
node tests/payment-statement.test.mjs
```

Expected: all PASS.

- [ ] **Step 8: Commit `feat: derive MB Platinum cashback slots by statement`.**

### Task 4: Cashback calculation strategy integration

**Files:**
- Modify: `services/mb-platinum-cashback.js`
- Modify: `services/cashback-evaluation.js`
- Modify: `services/tracking-matrix-engine.js`
- Create: `tests/mb-platinum-cashback-evaluation.test.mjs`
- Modify: `tests/cashback-condition-mode.test.mjs`

**Interfaces:**
- Produces: `evaluateMbPlatinumCashback(context)` and MB dispatch from `evaluateCashbackPrograms` when `cashbackCardConfigs` is supplied.

- [ ] **Step 1: Write failing evaluation assertions:**

```js
assert.equal(belowMinimum.totalCashback,0);
assert.equal(belowMinimum.statementMinimumSatisfied,false);
assert.equal(atMinimum.totalCashback,600000);
assert.equal(atMinimum.programResults.length,3);
```

Also assert fourth primary program and unassigned spend do not qualify, while same-name programs in different packages stay distinct.

- [ ] **Step 2: Run evaluation test and confirm missing-strategy FAIL.**
- [ ] **Step 3: Aggregate eligible transactions per occupied Program ID, call existing `calculateProgramCashback`, gate final total by `statementMinSpend`, and return current summary-compatible fields.**
- [ ] **Step 4: Add non-MB regression with `cashbackCardConfigs` present; expected eligible spend, cap and total remain literal prior values.**
- [ ] **Step 5: Run:**

```powershell
node tests/mb-platinum-cashback-evaluation.test.mjs
node tests/cashback-condition-mode.test.mjs
node tests/cashback-personal-spend.test.mjs
node tests/cashback-group-architecture.test.mjs
```

Expected: all PASS.

- [ ] **Step 6: Commit `feat: calculate MB Platinum cashback by slot`.**

### Task 5: MB Platinum transaction-form workflow

**Files:**
- Create: `services/mb-platinum-transaction-form.js`
- Modify: `app.js`
- Modify: `services/transaction-form-context.js`
- Modify: `styles.css`
- Create: `tests/mb-platinum-transaction-form.test.mjs`
- Modify: `tests/transaction-personal-form.test.mjs`

**Interfaces:**
- Produces: `buildMbPlatinumTransactionFormModel(context)` plus persisted form fields and validation.

- [ ] **Step 1: Write failing pure-model assertions:**

```js
assert.equal(blank.packageId,"");
assert.equal(blank.programId,"");
assert.deepEqual(blank.programOptions,[]);
assert.deepEqual(lifestyle.programOptions.map(x=>x.id),["LIFE-FOOD","LIFE-ONLINE"]);
assert.match(fullPackage.label,/Đã dùng 2\/2 chương trình/);
```

Assert non-MB returns `{visible:false}` and edit passes `excludeTransactionId`.

- [ ] **Step 2: Run form test and confirm missing-service FAIL.**
- [ ] **Step 3: Implement DOM-free model with status, disabled flags and explanations; duplicate occupied programs stay selectable.**
- [ ] **Step 4: Add failing integration cases:** saving preserves both IDs; invalid slot returns Vietnamese message; switching away from MB clears IDs; normal/personal form fields remain unchanged.
- [ ] **Step 5: Run integration tests and confirm FAIL on missing wiring.**
- [ ] **Step 6: Extend `txFields`, `wireTxForm`, `normalizeTx`, `validateTransactionForm`; never auto-select package/program; refresh help on relevant field changes; add only scoped help/status CSS.**
- [ ] **Step 7: Run transaction-form, personal-form, transaction-time and child-tab tests; expect all PASS.**
- [ ] **Step 8: Commit `feat: add MB Platinum transaction assignment UI`.**

### Task 6: Cashback Program editor flattening and terminology

**Files:**
- Modify: `services/cashback-program-config.js`
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `tests/cashback-program-config.test.mjs`
- Modify: `tests/cashback-program-editor.test.mjs`
- Modify: `tests/cashback-program-form-ui.test.mjs`
- Modify: `tests/cashback-program-workflow-ui.test.mjs`

**Interfaces:**
- Produces: Card ID → flat program editor; MB Package and statement-minimum controls; no user-facing “Điều kiện”.

- [ ] **Step 1: Change tests first** to require `+ Thêm chương trình`, `Tên chương trình`, no `Điều kiện`/`Tên điều kiện`/`Thêm điều kiện`, no parent program-name layer; MB model must show both package labels and 5.000.000 global minimum.
- [ ] **Step 2: Run editor/config/workflow tests and confirm current nested UI FAIL.**
- [ ] **Step 3: Make selected flat row the editable program; reuse MCC, money, rate, method, snapshot, save/cancel and button helpers. Add/delete/rename operate by stable program ID.**
- [ ] **Step 4: Store MB statement minimum in `cashbackCardConfigs`, not duplicated in programs; keep normal-card behavior unchanged.**
- [ ] **Step 5: Run config/editor/form/workflow/transaction-method tests; expect all PASS.**
- [ ] **Step 6: Commit `refactor: flatten cashback program editor`.**

### Task 7: Excel round-trip

**Files:**
- Modify: `services/cashback-program-excel.js`
- Modify: `app.js`
- Modify: `tests/cashback-program-excel.test.mjs`
- Create: `tests/mb-platinum-excel.test.mjs`

**Interfaces:**
- Produces: backward-compatible legacy import and lossless flat program/config/transaction round-trip.

- [ ] **Step 1: Add failing round-trip assertions** for same-name programs in different packages, MB `statementMinSpend`, anchor key, anchor primary package, and transaction assignments. Legacy rows without new columns must import empty assignment strings.
- [ ] **Step 2: Run both Excel tests and confirm missing-column FAIL.**
- [ ] **Step 3: Export/import these columns while retaining legacy aliases:** `Program ID`, `Package ID`, `Tên chương trình`, `Mức chi tối thiểu kỳ sao kê`, `Kỳ neo luân phiên`, `Gói chính tại kỳ neo`, `Cashback Package ID`, `Cashback Program ID`.
- [ ] **Step 4: Run both Excel tests; expect PASS.**
- [ ] **Step 5: Commit `feat: round trip MB cashback data in Excel`.**

### Task 8: Full verification

**Files:**
- Modify only files required by freshly reproduced integration failures.
- Test: all `tests/*.test.mjs`.

**Interfaces:**
- Produces: verified integrated feature and evidence-backed report.

- [ ] **Step 1: Run full suite:**

```powershell
Get-ChildItem tests/*.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if($LASTEXITCODE -ne 0){ throw "Test failed: $($_.Name)" } }
```

- [ ] **Step 2: Run syntax checks:**

```powershell
node --check app.js
Get-ChildItem services/*.js | ForEach-Object { node --check $_.FullName; if($LASTEXITCODE -ne 0){ throw "Syntax failed: $($_.Name)" } }
```

- [ ] **Step 3: Run `git diff --check` and `git status --short`; confirm only intended files and no whitespace errors.**
- [ ] **Step 4: Map passing tests to requirements A–K:** normal card, migration, primary/duplicate/secondary slots, unqualified transactions, statement boundary, alternation, edit/delete, global minimum, same-name cross-package.
- [ ] **Step 5: Commit only integration fixes proven by failing tests with `test: verify MB Platinum cashback workflow`.**
- [ ] **Step 6: Report in Vietnamese: files, model, MB rule, compatibility, tests, actual commands/results, risks; mark unrun checks `[Chưa xác minh]`.**
