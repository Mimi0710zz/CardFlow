# SDD ledger — plan: Docs/superpowers/plans/2026-09-23-mb-platinum-cashback-refactor.md

Setup ruling: triển khai trực tiếp trên nhánh main — người dùng yêu cầu làm trực tiếp trên source code hiện tại và đã duyệt kế hoạch — chi phí nếu hiểu sai: các commit tính năng nằm trực tiếp trên main thay vì worktree riêng.
Setup ruling: script sdd-workspace/task-start không chạy vì môi trường Windows không có bash — dùng workspace/ledger thủ công cùng định dạng — chi phí nếu sai: mất tự động sinh brief và ghi test log, không ảnh hưởng mã sản phẩm.
Pre-flight: Task 1 produces MB constants/config consumed by Tasks 2, 3, 6 — names are consistent.
Pre-flight: Task 2 produces flat programs/config/transaction assignments consumed by Tasks 3–7 — names are consistent.
Pre-flight: Task 3 produces rotation/eligibility/slot APIs consumed by Tasks 4–5 — names are consistent.
Pre-flight: Task 4 extends evaluation result consumed by current summaries/tracking — compatibility shape must be preserved.
Pre-flight: Task 5 persists assignment fields consumed by Task 4 and Task 7 — names are consistent.
Pre-flight: Task 6 edits cashbackCardConfigs exported by Task 7 — names are consistent.
Task 1: complete (commit cacceb0, tests: node tests/mb-platinum-cashback-config.test.mjs → PASS)
Task 2: complete (commit 6121671, tests: cashback-program-migration + mb-platinum-persistence + drive-conflict-safety → PASS)
Task 3: complete (commit c5e2571, tests: mb-platinum-cashback-slots + cashback-period + payment-statement → PASS)
Task 4: Ruling: flat migration must preserve legacy totalTarget/notes aliases — prior normalizer supplied this behavior and the spec requires lossless migration — cost if wrong: legacy total-spend rule or note could be lost.
Task 4: complete (commit fed8b43, tests: mb-platinum evaluation + normal regressions + tracking → PASS)
Task 5: complete (commit 0f8b586, tests: app syntax + MB transaction form + personal/time/tabs regressions → PASS)
Task 6: complete (commit 5547d9f, tests: app syntax + cashback config/editor/form/workflow/method → PASS)
Task 7: complete (commit 953131a, tests: app syntax + normal/MB Excel round-trip → PASS)

Task 8: complete in continuation session (39/39 test files PASS; app.js and all services/*.js syntax checks PASS). Git diff/status verification unavailable because uploaded ZIP contains no .git repository.
