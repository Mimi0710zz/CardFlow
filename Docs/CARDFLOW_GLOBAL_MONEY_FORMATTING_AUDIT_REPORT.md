# Báo cáo audit chuẩn hóa định dạng tiền toàn app

## 1. File tạo mới

- `services/money.js`
- `Docs/CARDFLOW_GLOBAL_MONEY_FORMATTING_AUDIT_REPORT.md`

## 2. File đã chỉnh sửa

- `app.js`
- `services/local-repository.js`

## 3. API money utility dùng chung

Module chuẩn: `services/money.js`

- `formatMoneyInput(value, options)`: định dạng cho ô nhập, ví dụ `4087000` -> `4.087.000`.
- `formatMoneyDisplay(value, options)`: định dạng hiển thị, ví dụ `4087000` -> `4.087.000 đ`.
- `parseMoney(value, options)`: parse chuỗi tiền về number/null theo semantic field.
- `normalizeMoney(value, options)`: normalize giá trị tiền trước khi lưu vào state/data.

Utility dùng một `Intl.NumberFormat("vi-VN")` duy nhất, không thêm dependency ngoài.

## 4. Các field tiền đã tìm thấy

- Credit Card: `groupLimit`, `annualFee`.
- Transaction: `amount`, `backAmount`.
- Payment: `amount`.
- Cashback Program: `max`, `eligibleTarget`, `totalTarget`.
- Dashboard/KPI/table/reminder: tổng tiền đơn, tiền Back, đang chờ Back, chênh lệch, cashback, lợi nhuận, dư nợ, còn hạn mức, chỉ tiêu còn thiếu.
- Setup wizard: hạn mức thẻ.
- Excel import: `TIỀN ĐƠN (VND)`, `TIỀN BACK (VND)`.
- Excel export: giữ dữ liệu số hiện có, không chuyển sang chuỗi có dấu chấm.

## 5. Field đã migrate sang utility chung

- Form Thẻ tín dụng: `Hạn mức nhóm (VND)`, `Phí thường niên (VNĐ)`.
- Form Giao dịch: `Tiền đơn (VND)`, `Tiền Back (VND)`.
- Form Thanh toán thẻ: `Số tiền thanh toán`.
- Form Cashback: `Max CB (VND)`, `Chi nhóm để max`, `Chỉ tiêu tổng`.
- Tất cả output tiền trong dashboard, bảng thẻ, bảng cashback, bảng giao dịch, bảng thanh toán, nhắc nhở và setup wizard.
- Canonicalize dữ liệu: cards, cashbackPrograms, transactions, payments.
- Excel import tiền giao dịch.

## 6. Helper trùng lặp đã bỏ

Đã bỏ khỏi `app.js`:

- `money()`
- `moneyInput()`
- `moneyInputValue()`
- `formatMoneyInputText()`
- `parseMoney()` cục bộ

Không giữ helper tiền cũ nào ngoài `services/money.js`.

## 7. Null/zero behavior

- `annualFee`: rỗng -> `null`; `0` vẫn là `0`.
- `groupLimit`: rỗng/không hợp lệ -> `0`.
- `transaction.amount`: rỗng/không hợp lệ -> `0`, giữ behavior hiện có.
- `transaction.backAmount`: rỗng/không hợp lệ -> `0`; `0` hợp lệ.
- `payment.amount`: rỗng/không hợp lệ -> `0`.
- `cashback max/eligibleTarget/totalTarget`: rỗng/không hợp lệ -> `0`.
- Dashboard/output tính toán: `null/undefined` hiển thị an toàn là `0 đ`, trừ `annualFee` bảng thẻ hiển thị `Chưa thiết lập`.

## 8. Negative value behavior

- `formatMoneyDisplay()` hỗ trợ số âm cho giá trị tính toán, ví dụ `-150000` -> `-150.000 đ`.
- Editable money inputs không bật negative input vì các field nhập hiện tại không có business rule cho số âm.

## 9. Import/export impact

- Excel import dùng `normalizeMoney()` cho `TIỀN ĐƠN (VND)` và `TIỀN BACK (VND)`, nên đọc được cả số thuần và chuỗi như `4.087.000 đ`.
- Excel export vẫn ghi numeric data hiện có, không xuất tiền dưới dạng chuỗi dot-formatted.
- Cấu trúc sheet/export không đổi.

## 10. Google Drive/data compatibility

- Không đổi OAuth, sync, revision/conflict logic, backup, file name hoặc schema version.
- `cardflow-data.json` tiếp tục lưu giá trị tiền là number hoặc `null` với `annualFee`.
- Canonicalize chỉ normalize dữ liệu tiền về number/null, không ghi chuỗi format vào data.

## 11. Tests executed/results

- `node --check app.js` passed.
- `node --check services/money.js` passed.
- `node --check services/local-repository.js` passed.
- Money utility matrix passed với: `0`, `1`, `999`, `1000`, `10000`, `1000000`, `4087000`, `82000000`, `999999999999`, `-150000`, `null`, `undefined`, `""`, `"4.087.000"`, `"4 087 000"`, `"4,087,000"`, `"4.087.000 đ"`, mixed non-digit input.
- Roundtrip `parseMoney(formatMoneyInput(value))` passed cho các giá trị whole-VND hợp lệ.
- Canonical money data smoke test passed cho card limit, annual fee, cashback targets, transaction amount/backAmount, payment amount.
- Static source audit passed: không còn helper tiền cục bộ trong `app.js`; money formatter tập trung ở `services/money.js`.

## 12. Remaining manual runtime checks

- [Chưa xác minh] Add/Edit Credit Card: hạn mức và phí thường niên.
- [Chưa xác minh] Add/Edit Transaction: tiền đơn và tiền Back.
- [Chưa xác minh] Add/Edit Payment: số tiền thanh toán.
- [Chưa xác minh] Add/Edit Cashback: Max CB, chi nhóm để max, chỉ tiêu tổng.
- [Chưa xác minh] Dashboard KPI/table/reminder bằng browser thật.
- [Chưa xác minh] Import/Export Excel bằng file thật.
- [Chưa xác minh] Google Drive sync sau khi lưu.
- [Chưa xác minh] GitHub Pages production URL.

## 13. Field không migrate có chủ đích

- `rate`, `%`, `progress`: không phải tiền.
- `mcc`, statement day, year, month, revision, counts, IDs, bank code, Card ID: không phải tiền.
- `lastSyncTime.toLocaleString("vi-VN")`: định dạng ngày giờ, không phải tiền.
