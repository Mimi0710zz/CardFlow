# CARDFLOW ANNUAL FEE PROGRESS IMPLEMENTATION REPORT

## Files modified

- `index.html`
- `app.js`
- `styles.css`
- `services/default-data.js`
- `services/local-repository.js`
- `services/sync-service.js`
- `services/fee-target.js`
- `Docs/CARDFLOW_ANNUAL_FEE_PROGRESS_IMPLEMENTATION_REPORT.md`

## New schema and migration

The top-level dataset now includes `feeTargets: []`. Each record stores only source configuration: ID, Card ID, fee/condition types, fee and target amounts, cycle dates, MCC selection, channel, reminder preference, and notes. Eligible spending, remaining amount, progress, days left, status, severity, and reminder text are derived and never persisted.

Old datasets receive an empty collection during canonicalization. Normalization is idempotent and preserves unrelated fields. Existing Sacombank Card ID migration also updates `feeTargets.cardId` atomically.

## CRUD implementation

The new sidebar view `Tiến độ hoàn phí thường niên` uses existing toolbar, modal, validation, money input, multi-select, selection, save, dirty-state, and delete patterns. It supports Add/Edit/Delete, status filtering, Card ID search, and per-row actions.

IDs are generated as `FEE-<CARD_ID>-<TYPE>-<YEAR>`. Duplicate bases receive numeric suffixes starting at `-2`. IDs are hidden from the form and preserved on Edit.

## Eligible-spend formula

A transaction contributes its existing numeric `amount` when all conditions pass:

- `transaction.cardId === feeTarget.cardId`
- `periodStart <= transaction.date <= periodEnd`
- target is `allMcc`, or the transaction resolves to a selected stable MCC category ID
- target channel is `all`, or transaction channel matches case-insensitively
- status is not `Hủy`

Deleted transactions do not exist in `state.transactions` and therefore cannot contribute. Other existing statuses remain eligible because the current Dashboard transaction aggregation does not define a broader invalid-status exclusion.

This calculation does not reference credit limit, debt, remaining limit, cashback program, or shared cap.

## MCC, channel, and date filtering

MCC options reuse `state.mccCategories`; no MCC names/codes are copied into fee targets. `Tất cả` is exclusive through the same compact multi-select behavior used by Cashback Programs. Dates are stored as `YYYY-MM-DD` and displayed through the shared `DD-MM-YYYY` formatter.

## Progress, status, and warnings

Derived metrics:

```text
remainingAmount = max(targetAmount - eligibleSpend, 0)
progressPercent = targetAmount > 0 ? min(eligibleSpend / targetAmount * 100, 100) : 0
daysLeft = max(calendarDays(today, periodEnd), 0)
```

Progress displays one Vietnamese decimal digit and is visually clamped to 100% while eligible spending retains its true value.

Statuses:

- `Đã đạt`: eligible spending reaches the target.
- `Hết hạn`: cycle ended before achievement.
- `Sắp đạt`: remaining amount is at most 30%.
- `Đang theo dõi`: otherwise.

Warning severity chooses the highest applicable level: achieved/green; at most 30% remaining/yellow; at most 15%/orange; at most 10% or at most 30 days/red.

## Dashboard reminders

Dashboard contains a compact `Nhắc nhở hoàn phí thường niên` block with up to five enabled reminders. It prioritizes red, orange, yellow, then nearest deadline. Reminder text is generated dynamically and formatted with the shared money utility. Items and the CTA open the new view.

## Credit and Debit support

Every card in `state.cards` can own one or multiple fee targets. Debit rows reuse the approved mint accent. Calculations use Card ID and transactions only, so Debit requires no credit limit/debt fields.

## Referential integrity

Card deletion is blocked with a clear message when any fee target references that Card ID. Fee target deletion does not affect cards or transactions.

## Import, export, persistence, and Google Drive

Excel export includes a `FeeTargets` sheet. Drive JSON persistence automatically carries the new top-level collection through the existing repository and sync paths. Sync material-change counts now include fee targets. OAuth, revision, backup, and conflict behavior were not replaced.

Excel import reads the exported `FeeTargets` sheet, updates existing records by stable ID, and appends new records whose Card ID exists locally. The existing transaction-sheet import remains unchanged.

## Responsive changes

Desktop uses the requested table. Tablet/Smartphone reuse `.mobile-card-table`, converting records to stacked cards with labels. Card ID appears first; progress, remaining amount, days, status, and actions remain readable. Debit target rows retain the soft mint identity.

## Tests executed/results

- Missing `feeTargets` migrates to `[]`: passed.
- Canonicalization idempotency: passed.
- Legacy Card ID reference migration: passed.
- All-MCC, specific-MCC, channel, date-range, unrelated-card, and cancelled-status filtering: passed.
- Eligible spend `112.500.000`, remaining `37.500.000`, progress `75,0%`: passed.
- Over-target progress clamps to `100,0%`, remaining stays `0`: passed.
- Achieved and expired statuses/days: passed.
- Readable ID generation and duplicate suffix: passed.
- JavaScript syntax and `git diff --check`: passed.

## Remaining runtime/manual checks

- Signed-in browser Add/Edit/Delete for Credit and Debit targets: `[Chưa xác minh]`.
- Dashboard CTA/reminder interaction: `[Chưa xác minh]`.
- Desktop/Tablet/Smartphone visual QA: `[Chưa xác minh]`.
- Google Drive upload/download/conflict roundtrip with actual account data: `[Chưa xác minh]`.
