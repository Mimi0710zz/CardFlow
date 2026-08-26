# CARDFLOW RULE PROGRESS FIX REPORT

## Root cause

`programMetrics()` previously calculated every cashback rule's progress from the card-level monthly spend:

```text
progress = totalCardSpend / totalTarget
```

Because multiple MCC rules reference the same card, spending in `Di chuyển` increased the progress shown for `Siêu thị / Tạp hóa`, even when that rule's eligible spending was zero. Shared-cap grouping was not the direct cause; it only made the affected rules appear together.

## Formula before and after

Before:

```text
progress = clamp(totalCardSpend / totalTarget, 0, 1)
```

After, when `eligibleTarget > 0`:

```text
progress = clamp(ruleEligibleSpend / eligibleTarget, 0, 1)
```

When a program has no `eligibleTarget`, the existing card-level target remains supported:

```text
progress = clamp(totalCardSpend / totalTarget, 0, 1)
```

If a program explicitly sets `requiresTotalTarget: true` or `progressRequiresTotalTarget: true`, both conditions contribute and progress is the lower of the eligible-target and total-target ratios. Existing programs are not implicitly treated as requiring both conditions.

## Fields used

Rule eligible spending is calculated from transactions matching:

- `transaction.cardId === program.cardId`
- the program's channel condition
- `allMcc`, or the program's selected `mccCategoryIds`

Card total spend remains the sum of all selected-month transactions sharing `program.cardId`. It is still displayed in `Tổng chi` and used for `remainTotal`, but it no longer drives MCC-rule progress when `eligibleTarget` exists.

## Shared-cap interaction

Shared cap continues to affect only cashback aggregation/display. It does not alter `eligible`, `total`, or `progress`. The approved repeated shared cashback display remains available on member rows, while aggregate totals still count the shared amount once.

## SACOM-CASHBACK test results

- `Siêu thị / Tạp hóa`: eligible `0`, eligible target `10.000.000` -> progress `0%`: passed.
- `Di chuyển`: eligible `4.087.000`, eligible target `4.047.619` -> clamped progress `100%`: passed.
- Both rules may share the same displayed cashback amount without sharing progress: passed.
- Fallback program with no eligible target uses `total / totalTarget`: passed.
- Explicit two-condition program uses the lower progress ratio: passed.

Browser visual verification with the user's signed-in runtime dataset: `[Chưa xác minh]`.
