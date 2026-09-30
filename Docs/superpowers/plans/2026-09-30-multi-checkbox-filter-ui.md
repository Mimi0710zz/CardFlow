# Multi-checkbox Filter UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp sáu khu vực filter của CardFlow Client thành multi-checkbox có OR trong nhóm, AND giữa nhóm, Select All, filter count, reset, search kết hợp và totals theo kết quả đã lọc.

**Architecture:** Tạo service thuần dùng chung cho `Set` state, matching, count, Select All và renderer markup; các màn hình hiện hữu tiếp tục sở hữu nguồn dữ liệu, applied/draft state và render bảng. Chuyển lần lượt predicate và UI của Thẻ, Giao dịch, Phí thẻ, Thanh toán thẻ, Theo dõi đơn và Lời nhắc mà không đổi schema hoặc nghiệp vụ.

**Tech Stack:** JavaScript ES modules, browser DOM APIs, HTML/CSS, Node.js `assert` tests.

**Spec:** `Docs/superpowers/specs/2026-09-30-multi-checkbox-filter-ui-design.md`

## Global Constraints

- Không thay đổi transaction calculation, cashback calculation, MB Platinum package logic, statement-period logic, Card ID, master/shared data, repository schema hoặc Google Drive synchronization.
- Option động phải loại trùng và sắp xếp label tiếng Việt A→Z; enum nghiệp vụ hiện hữu tiếp tục là nguồn dữ liệu hợp lệ.
- OR giữa các giá trị cùng nhóm; AND giữa các nhóm, date range, boolean và search.
- `Set` rỗng không giới hạn kết quả; “Tất cả” không được lưu hoặc tính vào badge.
- Totals/summary phải tính từ rows sau filter và search.
- Panel không đóng khi tick; applied state chỉ đổi khi Apply/reset, còn Cancel/click ngoài bỏ draft.
- Giữ giao diện CardFlow compact, label click được, list dài có `max-height` và vertical scroll.

## Review Focus

- Applied `Set` chứa value không còn trong option động: UI vẫn mở được, filter vẫn an toàn và reset xóa được stale value.
- Nhóm không có option: “Tất cả” không checked/indeterminate và không làm tăng active count.
- Tab Đánh đơn và Chi tiêu cá nhân: filter state không rò qua nhau khi đổi tab.
- Search có dấu/không dấu theo hành vi hiện hữu: multi-filter không được thay đổi normalization hoặc thứ tự search hiện tại.
- Totals ở Giao dịch và Thanh toán thẻ: dữ liệu search + filter rỗng phải tạo đúng tổng 0, không quay về tổng nguồn.

---

### Task 1: Multi-filter State và Matching Core

**Files:**
- Create: `services/multi-filter.js`
- Create: `tests/multi-filter.test.mjs`

**Interfaces:**
- Consumes: arrays/sets/scalars do UI và predicate truyền vào.
- Produces: `toFilterSet(value)`, `cloneFilterState(state)`, `clearFilterState(state)`, `matchesMultiFilter(value, selectedValues)`, `activeFilterValueCount(state)`, `selectAllState(options, selectedValues)`, `toggleAllFilterValues(options, checked)`.

- [ ] **Step 1: Viết test RED cho state, matching và Review Focus stale/empty option**

Trong `tests/multi-filter.test.mjs`, kiểm tra literal:

- `toFilterSet("")` rỗng; array/Set được clone.
- một value match; hai value cùng nhóm dùng OR; Set rỗng luôn match.
- hai nhóm ghép bằng `&&` chỉ nhận row thỏa cả hai.
- clone không chia sẻ Set với nguồn; clear trả Set rỗng, chuỗi rỗng và boolean `false` đúng kiểu.
- count cộng số phần tử từng Set, mỗi date string/boolean active là 1.
- stale value vẫn được count/reset; option rỗng cho `{checked:false, indeterminate:false}`.
- Select All đủ/partial/rỗng và toggle all không chứa pseudo-value `all`.

- [ ] **Step 2: Chạy test và xác nhận RED**

Run: `node tests/multi-filter.test.mjs`

Expected: FAIL vì `services/multi-filter.js` chưa tồn tại.

- [ ] **Step 3: Implement các interface thuần trong `services/multi-filter.js`**

Không mutate state/Set đầu vào. `clearFilterState` bảo toàn shape theo kiểu hiện có: Set → Set rỗng, boolean → `false`, scalar → `""`.

- [ ] **Step 4: Chạy test GREEN**

Run: `node tests/multi-filter.test.mjs`

Expected: `multi-filter tests passed`.

- [ ] **Step 5: Commit**

```bash
git add services/multi-filter.js tests/multi-filter.test.mjs
git commit -m "feat: add reusable multi-filter state helpers"
```

### Task 2: Reusable Checkbox Group Renderer

**Files:**
- Create: `services/multi-filter-ui.js`
- Create: `tests/multi-filter-ui.test.mjs`
- Modify: `styles.css:116-118,258-259`

**Interfaces:**
- Consumes: Task 1 `toFilterSet()` và `selectAllState()`.
- Produces: `renderMultiFilterGroup({key,label,options,selectedValues,escape})`, `readMultiFilterDraft(root, selector, baseState)`, `syncMultiFilterSelectAll(group)`, `wireMultiFilterGroups(root)`.

- [ ] **Step 1: Viết test RED cho markup compact và option động**

Test phải xác nhận HTML có button `aria-expanded`, checkbox “Tất cả”, checkbox option với label click được, selected values checked, không render duplicate pseudo-option và giữ thứ tự options đầu vào. Thêm fixture empty options để khóa Review Focus nhóm rỗng.

- [ ] **Step 2: Chạy test và xác nhận RED**

Run: `node tests/multi-filter-ui.test.mjs`

Expected: FAIL vì module chưa tồn tại.

- [ ] **Step 3: Implement renderer và DOM wiring tối thiểu**

`wireMultiFilterGroups(root)` chỉ mở/đóng dropdown nhóm và đồng bộ option/Select All; không Apply, không render bảng và không đóng panel cha. `syncMultiFilterSelectAll(group)` đặt DOM property `indeterminate`, không dùng HTML attribute.

- [ ] **Step 4: Thêm CSS dùng chung**

Tạo `.multi-filter-group`, trigger, menu, option label và action “Tất cả”; menu dùng `max-height` + `overflow-y:auto`, desktop/mobile nằm trong panel hiện hữu. Không đổi palette button.

- [ ] **Step 5: Chạy test GREEN và CSS regression hiện hữu**

Run: `node tests/multi-filter-ui.test.mjs; node tests/filter-options.test.mjs`

Expected: cả hai PASS.

- [ ] **Step 6: Commit**

```bash
git add services/multi-filter-ui.js tests/multi-filter-ui.test.mjs styles.css
git commit -m "feat: add reusable checkbox filter groups"
```

### Task 3: Predicate Nghiệp vụ Nhận `Set`

**Files:**
- Modify: `services/transaction-filter.js:3-12`
- Modify: `services/fee-target-model.js:50-56`
- Modify: `services/payment-statement.js:196-220`
- Modify: `tests/transaction-card-fee-status.test.mjs`
- Modify: `tests/fee-target-model.test.mjs`
- Modify: `tests/payment-statement.test.mjs`

**Interfaces:**
- Consumes: Task 1 `matchesMultiFilter(value, selectedValues)`.
- Produces: các API hiện hữu `matchesTransactionFilters`, `feeTargetMatchesFilters`, `buildStatementPaymentRows` chấp nhận `Set` cho thuộc tính multi-select và giữ date/scalar compatibility trong lúc chuyển đổi.

- [ ] **Step 1: Viết test RED cho OR/AND và backward compatibility**

Thêm case:

- Transaction có `cardId` thuộc một trong hai card và status thuộc một trong hai status; row sai một nhóm bị loại.
- Fee target match hai bank/card values nhưng vẫn AND với fee type.
- Payment rows match nhiều bank/status và trả rỗng khi không row nào thỏa.
- Scalar cũ vẫn hoạt động để không tạo regression trong quá trình migration từng màn hình.

- [ ] **Step 2: Chạy ba test và xác nhận RED đúng Set comparison**

Run: `node tests/transaction-card-fee-status.test.mjs; node tests/fee-target-model.test.mjs; node tests/payment-statement.test.mjs`

Expected: ít nhất case multi-value FAIL trước implementation.

- [ ] **Step 3: Thay equality guard bằng `matchesMultiFilter`**

Giữ nguyên status normalization, host resolver, date comparison, statement row derivation và mọi phép tính tiền.

- [ ] **Step 4: Chạy ba test GREEN**

Run: lặp lại lệnh Step 2.

Expected: cả ba PASS.

- [ ] **Step 5: Commit**

```bash
git add services/transaction-filter.js services/fee-target-model.js services/payment-statement.js tests/transaction-card-fee-status.test.mjs tests/fee-target-model.test.mjs tests/payment-statement.test.mjs
git commit -m "feat: support multi-value table predicates"
```

### Task 4: Bốn Panel Chính trong `app.js`

**Files:**
- Modify: `app.js:71-86,656-703,663-675,841-878,1178-1195,2121-2205,2509-2525`
- Create: `tests/multi-filter-app-ui.test.mjs`
- Modify: `tests/card-table-summary.test.mjs`
- Modify: `tests/transaction-child-tabs.test.mjs`

**Interfaces:**
- Consumes: Task 1 state/count/matching helpers; Task 2 renderer/wiring/draft reader; Task 3 Set-aware predicates.
- Produces: multi-checkbox applied/draft workflow cho Thẻ, Giao dịch, Phí thẻ và Thanh toán thẻ.

- [ ] **Step 1: Viết test RED cho filter state và UI wiring**

`tests/multi-filter-app-ui.test.mjs` kiểm tra bốn panel render group checkbox thay select, filter badge dùng `activeFilterValueCount`, Apply đọc draft, clear dùng `clearFilterState`, Cancel/click ngoài không clear applied state và panel gọi `wireMultiFilterGroups`.

- [ ] **Step 2: Viết regression RED cho search + filter + totals**

- Card fixture: search chỉ giữ một row trong hai row đã match multi-bank.
- Transaction fixture/helper: multi-card + multi-status rồi search; `transactionMonthlyTotals(rows)` dùng chính kết quả cuối và empty rows trả các tổng 0.
- Payment fixture: filters trả subset và summary lấy subset đó, không lấy `allRows`.
- Tab order/personal có hai Set object độc lập và đổi tab không mutate state còn lại.

- [ ] **Step 3: Chạy test và xác nhận RED**

Run: `node tests/multi-filter-app-ui.test.mjs; node tests/card-table-summary.test.mjs; node tests/transaction-child-tabs.test.mjs`

Expected: FAIL ở state string/select markup hiện hữu.

- [ ] **Step 4: Chuyển bốn filter state sang Set + scalar date**

Card/fee/payment chỉ có Set. Transaction giữ `dateFrom`/`dateTo` là string; các field còn lại là Set. Dùng `activeFilterValueCount` cho badge.

- [ ] **Step 5: Thay select markup bằng `renderMultiFilterGroup`**

Giữ nguyên option sources và `sortedUniqueFilterOptions`; chỉ thay presentation. Đổi copy nút thành `Xóa bộ lọc` nhất quán.

- [ ] **Step 6: Hợp nhất Apply/Cancel/reset qua helper hiện hữu**

Mỗi lần mở tạo draft clone từ applied state. Tick không render toàn trang. Apply đọc draft, đóng panel, clear row selection và render; Cancel/click ngoài bỏ draft; reset xóa applied state và render full dataset.

- [ ] **Step 7: Đổi card predicate inline sang `matchesMultiFilter` và xác nhận totals dùng filtered rows**

Không di chuyển hoặc viết lại calculation logic. Review Focus search normalization, empty result totals và tab isolation phải được test ở Step 2.

- [ ] **Step 8: Chạy test GREEN**

Run: lặp lại lệnh Step 3, sau đó `node tests/transaction-fee-ui.test.mjs; node tests/card-payment-population-color.test.mjs`.

Expected: tất cả PASS.

- [ ] **Step 9: Commit**

```bash
git add app.js tests/multi-filter-app-ui.test.mjs tests/card-table-summary.test.mjs tests/transaction-child-tabs.test.mjs
git commit -m "feat: add multi-checkbox filters to core tables"
```

### Task 5: Theo dõi đơn

**Files:**
- Modify: `services/tracking-matrix-ui.js:1-70`
- Create: `tests/tracking-multi-filter-ui.test.mjs`
- Modify: `tests/tracking-targets-deadline.test.mjs`

**Interfaces:**
- Consumes: Task 1 helpers và Task 2 renderer/wiring.
- Produces: Set-based filters cho card, brand, program, status; boolean `actionable` giữ nguyên.

- [ ] **Step 1: Viết test RED cho tracking OR/AND, Select All và state preservation**

Fixture có hai card/brand/status được chọn trong cùng nhóm và một program group khác; xác nhận OR nội nhóm, AND liên nhóm, actionable kết hợp AND, badge đếm từng selected value + boolean, Apply giữ state khi draw lại và Cancel không đổi applied state.

- [ ] **Step 2: Chạy test và xác nhận RED**

Run: `node tests/tracking-multi-filter-ui.test.mjs`

Expected: FAIL vì tracking đang dùng select/scalar.

- [ ] **Step 3: Chuyển tracking filter state/predicate/render sang helper dùng chung**

Giữ nguyên matrix engine, reminder overview, legend, resize, modal và status calculation. Option tiếp tục lấy từ `rowsFor`/model data rồi loại trùng/sort.

- [ ] **Step 4: Chạy test GREEN và regression tracking**

Run: `node tests/tracking-multi-filter-ui.test.mjs; node tests/tracking-targets-deadline.test.mjs; node tests/mb-platinum-tracking-special.test.mjs`

Expected: tất cả PASS.

- [ ] **Step 5: Commit**

```bash
git add services/tracking-matrix-ui.js tests/tracking-multi-filter-ui.test.mjs tests/tracking-targets-deadline.test.mjs
git commit -m "feat: add multi-checkbox tracking filters"
```

### Task 6: Lời nhắc

**Files:**
- Modify: `app.js:2400-2420`
- Modify: `tests/reminders-ui.test.mjs`
- Modify: `tests/reminders.test.mjs`

**Interfaces:**
- Consumes: Task 1 helpers và Task 2 renderer/wiring.
- Produces: panel applied/draft cho `cardId`/`status` Set và `dateFrom`/`dateTo` string.

- [ ] **Step 1: Viết test RED cho reminder multi-filter và panel lifecycle**

Test một/nhiều card, hai status OR, AND với date range/search, filter count, reset, mở lại giữ applied state và Cancel bỏ draft. Bao phủ row không match tạo danh sách rỗng thay vì bỏ filter.

- [ ] **Step 2: Chạy test và xác nhận RED**

Run: `node tests/reminders.test.mjs; node tests/reminders-ui.test.mjs`

Expected: FAIL vì reminder dùng select/scalar và toolbar trực tiếp.

- [ ] **Step 3: Implement reminder panel theo workflow dùng chung**

Giữ nguyên `getReminderState`, active reminder logic, overlap date semantics, CRUD và dashboard reminder. Search tiếp tục qua `filteredRows`, sau đó AND với multi-filter/date hoặc ngược lại miễn rows/totals quan sát được giống nhau.

- [ ] **Step 4: Chạy test GREEN**

Run: lặp lại lệnh Step 2 và `node tests/tracking-targets-deadline.test.mjs`.

Expected: tất cả PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/reminders-ui.test.mjs tests/reminders.test.mjs
git commit -m "feat: add multi-checkbox reminder filters"
```

### Task 7: Integration và Full Regression

**Files:**
- Modify if required by a proven failure only: owning production/test pair.

**Interfaces:**
- Consumes: toàn bộ Tasks 1-6.
- Produces: bằng chứng build/syntax/test cho feature hoàn chỉnh.

- [ ] **Step 1: Chạy syntax checks**

Run:

```powershell
node --check app.js
Get-ChildItem services -Filter '*.js' | ForEach-Object { node --check $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

Expected: exit 0.

- [ ] **Step 2: Chạy toàn bộ test suite**

Run:

```powershell
$tests = Get-ChildItem tests -Filter '*.test.mjs' | Sort-Object Name
foreach ($test in $tests) { node $test.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

Expected: tất cả test PASS, không bỏ qua failure ngoài phạm vi.

- [ ] **Step 3: Kiểm tra thủ công sáu khu vực ở desktop và mobile width**

Với dữ liệu hiện có, xác nhận: checkbox label click được; panel không đóng khi tick; Select All/partial indeterminate; Apply/Cancel/click ngoài; mở lại giữ state; badge đúng; clear phục hồi full rows; search AND filters; totals đổi theo filtered rows; list dài scroll được.

- [ ] **Step 4: Kiểm tra diff và ràng buộc phạm vi**

Run: `git diff --check; git status --short; git diff --stat`

Expected: không đổi schema, repository/Drive, cashback, MB Platinum hoặc calculation code ngoài predicate lọc đã lên kế hoạch.

- [ ] **Step 5: Commit integration fix nếu có**

Chỉ commit khi Step 1-4 chứng minh cần sửa; không tạo empty commit.

```bash
git add <owning-production-file> <owning-test-file>
git commit -m "test: verify multi-checkbox filter workflow"
```
