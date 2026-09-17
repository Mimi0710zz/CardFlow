# Cashback Program UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay tab cashback dạng bảng bằng workflow Card → Program → Package → Conditions, đồng thời bổ sung ba `conditionMode` mà không làm mất Group legacy hoặc `packageHistory`.

**Architecture:** Thêm một service thuần làm adapter giữa dữ liệu Program/Package/Group hiện tại và UI phẳng. Normalization giữ nguyên topology Group, engine áp `conditionMode` ở cấp Program, còn `app.js` chỉ quản lý selection và render detail editor. Persistence tiếp tục dùng `cashbackProgramGroups`; schema 18 bổ sung default `conditionMode` an toàn.

**Tech Stack:** Vanilla JavaScript ES modules, Node.js assert tests, HTML/CSS hiện hữu, SheetJS trong browser.

**Spec:** `Docs/superpowers/specs/2026-09-17-cashback-program-ux-refactor-design.md`

## Global Constraints

- Mọi thay đổi hành vi phải theo RED → GREEN → REFACTOR.
- Không hard-code MB Pla, ngân hàng hoặc Card ID trong engine.
- Không xóa, thay thế hoặc tạo nguồn runtime package ngoài `services/cashback-packages.js`.
- Không hiển thị Group trong UI mới; Group legacy phải được giữ nguyên trong dữ liệu.
- Không thêm chu kỳ cashback ở Program; luôn dùng chu kỳ Card hiện có.
- Thứ tự mảng Conditions là nguồn thứ tự chính.
- Chỉ sửa tab cashback và các service/test trực tiếp liên quan.
- Dùng style/helper nút hiện hữu; repository không có `PROJECT_MEMORY_BUTTON.md`.

---

### Task 1: Program configuration adapter và selection model

**Files:**
- Create: `services/cashback-program-config.js`
- Create: `tests/cashback-program-config.test.mjs`

**Interfaces:**
- Produces: `CASHBACK_CONDITION_MODES`, `normalizeConditionMode(value)`, `programsForCard(programs, cardId)`, `resolveCashbackProgramSelection({cards, programs, cardId, programId, packageId})`, `visibleCashbackConditions(program, packageId, mccCategories)`, `addCashbackCondition(program, scope, draft)`, `updateCashbackCondition(program, ref, draft)`, `removeCashbackCondition(program, ref)`, `moveCashbackCondition(program, ref, direction)`.
- Condition refs use `{packageId, groupId, conditionId}`; `packageId` is empty for simple Programs.

- [ ] **Step 1: Write failing adapter tests**

Add literal fixtures proving:

```js
assert.deepEqual(programsForCard(programs,"CARD-A").map(item=>item.id),["A-1","A-2"]);
assert.equal(resolveCashbackProgramSelection({cards,programs,cardId:"CARD-B",programId:"A-2",packageId:"OLD"}).programId,"B-1");
assert.equal(resolveCashbackProgramSelection({cards,programs,cardId:"CARD-B",programId:"A-2",packageId:"OLD"}).packageId,"");
assert.deepEqual(visibleCashbackConditions(packaged,"PACKAGE-A",mcc).map(item=>item.condition.id),["A-1","A-2"]);
assert.deepEqual(visibleCashbackConditions(packaged,"PACKAGE-B",mcc).map(item=>item.condition.id),["B-1"]);
```

Add scoped mutation assertions: adding/removing in Package A leaves Package B unchanged; updating one member of a multi-Condition legacy Group leaves its sibling and Group metadata intact; moving a Condition produces deterministic array order.

- [ ] **Step 2: Run RED**

Run: `node tests/cashback-program-config.test.mjs`

Expected: FAIL because `services/cashback-program-config.js` does not exist.

- [ ] **Step 3: Implement minimal adapter**

Use immutable shallow copies along the changed Program → Package → Group → Condition path. For a new Condition, create a compatibility Group:

```js
{
  id: `${program.id}-GROUP-${conditionId}`,
  name: condition.name,
  conditionCombination: "OR",
  totalSpendMinimum: null,
  note: "",
  conditions: [condition]
}
```

For a simple Program already stored as a top-level Group, preserve top-level `conditions`; do not wrap the whole Program again. Return refs with stable IDs and the flattened display index.

- [ ] **Step 4: Run GREEN and refactor**

Run: `node tests/cashback-program-config.test.mjs`

Expected: PASS with the exact card/package scoping and legacy sibling preservation assertions.

- [ ] **Step 5: Commit**

```powershell
git add services/cashback-program-config.js tests/cashback-program-config.test.mjs
git commit -m "feat: add cashback program configuration adapter"
```

---

### Task 2: Schema 18 normalization và lossless legacy migration

**Files:**
- Modify: `services/cashback.js`
- Modify: `services/cashback-packages.js`
- Modify: `services/local-repository.js`
- Create: `tests/cashback-program-migration.test.mjs`
- Modify: `tests/cashback-group-architecture.test.mjs`
- Modify: `tests/cashback-packages.test.mjs`

**Interfaces:**
- Consumes: `normalizeConditionMode(value)` from Task 1.
- Produces: normalized Program objects with `conditionMode`; canonical data with `schemaVersion: 18`.
- Preserves: all Program/Package/Group/Condition IDs and `packageHistory` values.

- [ ] **Step 1: Write failing migration tests**

Create schema 17 fixtures for:

```js
const simple={id:"P",cardId:"CARD",name:"Program",conditions:[{id:"C1",name:"One"},{id:"C2",name:"Two"}]};
const packaged={id:"PK",cardId:"CARD",name:"Packaged",packages:[{id:"A",name:"A",groups:[legacyMultiConditionGroup]}],packageHistory:[historyEntry]};
```

Assert schema becomes 18, both Programs receive `conditionMode: "independent"`, two legacy Conditions remain, Group rules remain byte-for-byte equivalent on relevant fields, and `packageHistory` deep-equals the input. Canonicalize the result again and assert `changed === false` and deep equality.

- [ ] **Step 2: Run RED**

Run: `node tests/cashback-program-migration.test.mjs`

Expected: FAIL because current schema is 17 and `conditionMode` is absent.

- [ ] **Step 3: Implement normalization**

Add `conditionMode: normalizeConditionMode(program.conditionMode)` in both simple and packaged normalization paths. Change canonical schema and `changed` comparison from `17` to `18`. Keep current source fallback order and do not reconstruct package history.

- [ ] **Step 4: Update existing schema assertions**

Only change expected schema numbers from 17 to 18 where migration output is under test. Retain old schema 15/16/17 fixtures to prove multi-version upgrade behavior.

- [ ] **Step 5: Run GREEN**

Run:

```powershell
node tests/cashback-program-migration.test.mjs
node tests/cashback-group-architecture.test.mjs
node tests/cashback-packages.test.mjs
```

Expected: all three scripts PASS and package history regression remains green.

- [ ] **Step 6: Commit**

```powershell
git add services/cashback.js services/cashback-packages.js services/local-repository.js tests/cashback-program-migration.test.mjs tests/cashback-group-architecture.test.mjs tests/cashback-packages.test.mjs
git commit -m "feat: migrate cashback programs to schema 18"
```

---

### Task 3: Engine support cho `independent`, `first_match`, `all_required`

**Files:**
- Modify: `services/cashback-evaluation.js`
- Create: `tests/cashback-condition-mode.test.mjs`
- Modify: `tests/cashback-group-architecture.test.mjs`
- Modify: `tests/cashback-packages.test.mjs`

**Interfaces:**
- Consumes: `normalizeConditionMode()` and existing MCC/channel helpers.
- Produces: `evaluateCashbackProgram()` results respecting Program `conditionMode`, Program threshold and cap.
- Internal helper: `assignTransactionsByConditionMode(conditions, transactions, mode, mccCategories)` returning a `Map<conditionId, transaction[]>`.

- [ ] **Step 1: Write RED tests for independent and first-match**

Use two overlapping all-MCC Conditions with literal rates/caps. Assert one transaction contributes to both under `independent`, but only the first under `first_match`. Reverse Conditions and assert the winning Condition reverses, proving persisted order controls behavior.

- [ ] **Step 2: Run RED**

Run: `node tests/cashback-condition-mode.test.mjs`

Expected: FAIL because `first_match` currently credits every eligible Condition.

- [ ] **Step 3: Implement transaction assignment**

For `first_match`, walk period transactions in original order and Conditions in persisted order, assigning each transaction to the first MCC/channel match. For other modes, preserve current matching behavior. Do not mutate transaction or Condition arrays.

- [ ] **Step 4: Run GREEN for first-match**

Run: `node tests/cashback-condition-mode.test.mjs`

Expected: first-match and order assertions PASS.

- [ ] **Step 5: Add RED tests for all-required and Program threshold**

Assert a two-Condition Program returns `0` when one configured `eligibleSpendMinimum` is unmet, returns the sum when both are met, and returns `0` under every mode when `totalSpendMinimum` is unmet. Add a final cap assertion for `maxCashbackPerPeriod`.

- [ ] **Step 6: Implement minimal all-required gate**

Evaluate Condition metrics first, compute `allRequiredSatisfied`, then set payable cashback to zero when false. Apply legacy Group gates before Program aggregation and Program cap last. For package Programs, apply mode per selected package transaction collection while retaining `resolvePackageForTransaction()`.

- [ ] **Step 7: Run engine regression suite**

Run:

```powershell
node tests/cashback-condition-mode.test.mjs
node tests/cashback-group-architecture.test.mjs
node tests/cashback-packages.test.mjs
node tests/cashback-personal-spend.test.mjs
```

Expected: all scripts PASS; existing non-package and package totals remain unchanged for default `independent`.

- [ ] **Step 8: Commit**

```powershell
git add services/cashback-evaluation.js tests/cashback-condition-mode.test.mjs tests/cashback-group-architecture.test.mjs tests/cashback-packages.test.mjs
git commit -m "feat: evaluate cashback program condition modes"
```

---

### Task 4: Testable editor view model và HTML renderer

**Files:**
- Modify: `services/cashback-program-config.js`
- Create: `tests/cashback-program-editor.test.mjs`

**Interfaces:**
- Produces: `buildCashbackProgramEditorModel(input)` and `renderCashbackProgramEditor(model, helpers)`.
- Model contains exactly one `selectedCard`, one `selectedProgram`, optional `selectedPackage`, and `conditions` only for that scope.
- Renderer returns markup with `data-cashback-card-select`, `data-cashback-program-select`, optional `data-cashback-package-select`, radio inputs sharing `name="cashbackConditionMode"`, and readonly `data-condition-spend-to-max`.

- [ ] **Step 1: Write failing behavioral renderer tests**

Build models from real fixtures and assert:

```js
assert.deepEqual(model.programOptions.map(item=>item.value),["A-1","A-2"]);
assert.equal(model.packageOptions.length,0);
assert.equal(simpleHtml.includes("data-cashback-package-select"),false);
assert.equal(packagedAHtml.includes("A Condition"),true);
assert.equal(packagedAHtml.includes("B Condition"),false);
assert.equal((html.match(/name="cashbackConditionMode"/g)||[]).length,3);
assert.match(html,/data-condition-spend-to-max[^>]*readonly/);
```

Also assert the rendered program name differs from every Condition name and Group labels/controls are absent.

- [ ] **Step 2: Run RED**

Run: `node tests/cashback-program-editor.test.mjs`

Expected: FAIL because model and renderer functions do not exist.

- [ ] **Step 3: Implement minimal model and renderer**

Keep renderer dependency-free. Pass escaping, money formatting, MCC option markup and transaction-method options through `helpers` so browser-specific state stays in `app.js`. Render move buttons only when mode is `first_match`.

- [ ] **Step 4: Run GREEN and refactor markup helpers**

Run: `node tests/cashback-program-editor.test.mjs`

Expected: PASS with one-scope rendering and no Group UI.

- [ ] **Step 5: Commit**

```powershell
git add services/cashback-program-config.js tests/cashback-program-editor.test.mjs
git commit -m "feat: render focused cashback program editor"
```

---

### Task 5: Replace cashback table with selector/detail workflow

**Files:**
- Modify: `app.js`
- Modify: `tests/cashback-program-form-ui.test.mjs`
- Create: `tests/cashback-program-workflow-ui.test.mjs`

**Interfaces:**
- Consumes: Task 1 and Task 4 config APIs.
- Adds UI state: `cashbackProgramSelection = {cardId:"", programId:"", packageId:""}`.
- Replaces primary table renderer in `renderPrograms()`; retains `renderCashbackRuntimePanel(programId)` separately.

- [ ] **Step 1: Write RED workflow tests**

Use the renderer/model API, not source-regex-only assertions, to prove card selection filters Programs, package selection filters Conditions, and radio mode is mutually exclusive. Keep a narrow source-level assertion only for `renderPrograms()` wiring when browser DOM cannot be imported safely.

- [ ] **Step 2: Run RED**

Run:

```powershell
node tests/cashback-program-workflow-ui.test.mjs
node tests/cashback-program-form-ui.test.mjs
```

Expected: workflow test FAIL because `renderPrograms()` still renders the large table.

- [ ] **Step 3: Wire selector and render lifecycle**

Import config APIs. In `renderPrograms()`:

1. Resolve valid selection from current Card/Program/Package arrays.
2. Render the focused editor.
3. Bind Card, Program and Package `change` events to update only selection and rerender.
4. Preserve selected Card across normal tab rerenders.
5. Show an empty state if there are no Cards or no Programs for the selected Card.

Do not use `toolbar("programs")` or the old multi-row table as the primary UI.

- [ ] **Step 4: Wire Program CRUD and save**

Add Program with the selected `cardId`, explicit `name`, default `conditionMode: "independent"`, one initial compatibility Condition, and period from the current view. Rename edits only `program.name`. Delete confirms the selected Program ID and filters only that object. Save parses detail fields and uses adapter mutations without rebuilding unrelated Packages/Groups.

- [ ] **Step 5: Wire Condition CRUD, order and derived spend**

Reuse the existing MCC multi-select wiring and canonical transaction methods. Recalculate `Chi để đạt Max CB` through `calculateSpendToMax(rate,max)` only. Persist manually entered `eligibleSpendMinimum` as `Chi tổng doanh số kèm theo`; never collect the readonly derived field as the rule. Move actions call `moveCashbackCondition()` and rerender.

- [ ] **Step 6: Run UI tests**

Run:

```powershell
node tests/cashback-program-workflow-ui.test.mjs
node tests/cashback-program-form-ui.test.mjs
node tests/cashback-transaction-method-ui.test.mjs
node tests/cashback-package-runtime-ui.test.mjs
```

Expected: all scripts PASS. Update the old form test to assert the new labels and readonly field contract, not removed Group markup.

- [ ] **Step 7: Commit**

```powershell
git add app.js tests/cashback-program-form-ui.test.mjs tests/cashback-program-workflow-ui.test.mjs
git commit -m "feat: add focused cashback program workflow"
```

---

### Task 6: Responsive CardFlow styling

**Files:**
- Modify: `styles.css`
- Modify: `tests/cashback-program-workflow-ui.test.mjs`

**Interfaces:**
- Consumes the new `cashback-program-*` classes from Task 5.
- Produces compact desktop grid and one-column mobile layout without affecting unrelated tables/forms.

- [ ] **Step 1: Add failing style contract assertions**

Assert the rendered HTML exposes stable layout classes and the CSS includes scoped rules for selector row, section, condition list/card, action row and the existing mobile breakpoint. Assert removed Group editor classes are not required by new markup.

- [ ] **Step 2: Run RED**

Run: `node tests/cashback-program-workflow-ui.test.mjs`

Expected: FAIL on missing scoped layout rules.

- [ ] **Step 3: Implement scoped CSS**

Use existing variables `--panel`, `--line`, `--nav2`, `--muted`, `--bad` and current button classes. Keep section borders shallow, cap selector widths, use compact gaps, allow notes to wrap, and collapse field grids to one column below `767px`.

- [ ] **Step 4: Run GREEN**

Run: `node tests/cashback-program-workflow-ui.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add styles.css tests/cashback-program-workflow-ui.test.mjs
git commit -m "style: refine cashback program editor layout"
```

---

### Task 7: Backward-compatible Excel round trip

**Files:**
- Create: `services/cashback-program-excel.js`
- Modify: `app.js`
- Create: `tests/cashback-program-excel.test.mjs`

**Interfaces:**
- Produces: `exportCashbackProgramRows(programs, context)` and `importCashbackProgramRows(rows, context)`.
- `context` supplies MCC lookup, bank-name lookup, ID builders and formatting/parsing callbacks currently embedded in `app.js`.
- New columns: `Condition Mode`, `Max cashback chương trình`, `Chi tổng doanh số kèm theo`, `Thứ tự điều kiện`; legacy column aliases remain accepted.

- [ ] **Step 1: Write failing round-trip tests**

Export one simple and one packaged Program. Assert rows include explicit Program name, mode, package identity and deterministic order, but no `packageHistory`. Import exported rows and assert structural rule fields match. Import a literal legacy row using `Tên nhóm`, `Điều kiện kết hợp` and `Chi nhóm tối thiểu`; assert it normalizes without data loss.

- [ ] **Step 2: Run RED**

Run: `node tests/cashback-program-excel.test.mjs`

Expected: FAIL because the service module does not exist.

- [ ] **Step 3: Extract and extend Excel mapping**

Move only cashback row conversion out of `app.js`. Preserve `Group ID`, `Tên nhóm`, Group thresholds and Group combination columns for lossless legacy round trips, even though the UI hides them. Sort imported Conditions by numeric `Thứ tự điều kiện` when present, otherwise keep sheet row order. Default missing mode to `independent`.

- [ ] **Step 4: Wire browser export/import**

Replace `exportProgramsRows()` and `buildImportedCashbackGroups()` internals with service calls and browser context callbacks. Keep current sheet name and unrelated master-data behavior unchanged.

- [ ] **Step 5: Run GREEN**

Run:

```powershell
node tests/cashback-program-excel.test.mjs
node tests/cashback-program-migration.test.mjs
```

Expected: both scripts PASS; runtime `packageHistory` is absent from export and untouched by rule editing.

- [ ] **Step 6: Commit**

```powershell
git add services/cashback-program-excel.js app.js tests/cashback-program-excel.test.mjs
git commit -m "feat: update cashback Excel program format"
```

---

### Task 8: Full verification and focused cleanup

**Files:**
- Verify: `app.js`
- Verify: `styles.css`
- Verify: `services/cashback.js`
- Verify: `services/cashback-evaluation.js`
- Verify: `services/cashback-packages.js`
- Verify: `services/cashback-program-config.js`
- Verify: `services/cashback-program-excel.js`
- Verify: `services/local-repository.js`
- Verify: `tests/*.test.mjs`

**Interfaces:**
- Verifies all spec requirements and repository regressions.

- [ ] **Step 1: Run all cashback tests**

```powershell
$cashbackTests = Get-ChildItem tests -Filter 'cashback*.test.mjs' | Sort-Object Name
foreach ($test in $cashbackTests) { node $test.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

Record the exact number of scripts and assertion failures.

- [ ] **Step 2: Run all existing tests**

```powershell
$allTests = Get-ChildItem tests -Filter '*.test.mjs' | Sort-Object Name
foreach ($test in $allTests) { node $test.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

Record the exact pass/fail script count.

- [ ] **Step 3: Syntax-check changed JavaScript**

```powershell
$changedJs = git diff --name-only HEAD~7 -- '*.js' '*.mjs'
foreach ($file in $changedJs) { node --check $file; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

If commit count differs, derive the base from the design commit `3051593` with `git diff --name-only 3051593..HEAD`.

- [ ] **Step 4: Verify diff hygiene**

Run:

```powershell
git diff --check 3051593..HEAD
git status --short
```

Expected: no whitespace errors and only intended files changed.

- [ ] **Step 5: Source/manual checklist**

Verify:

- Normal Card shows Card → Program → Conditions and no Package selector.
- Packaged Card shows one Package selector and Conditions from only the selected Package.
- Only one Card, Program and Package detail is rendered at once.
- Program name is separate from Condition names.
- No Group label/control appears in the new UI.
- `5%` plus `200,000` displays readonly `4,000,000`.
- `packageHistory` remains deep-equal before and after a configuration edit.
- `services/cashback-packages.js` remains the sole runtime package implementation.
- Unrelated tabs have no source changes.

- [ ] **Step 6: Handle verification failures through TDD**

If any verification fails, add or tighten the smallest failing regression test in the owning cashback test file, run it to confirm RED, patch only the owning production file, rerun that test to GREEN, then repeat Steps 1–5. Commit the exact repaired production/test pair with `git commit -m "fix: resolve cashback program regression"`. Do not create an empty commit.
