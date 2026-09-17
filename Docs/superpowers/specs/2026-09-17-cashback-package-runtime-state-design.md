# Cashback Package Runtime State Design

## Mục tiêu

Bổ sung trạng thái vận hành theo kỳ cho mọi chương trình cashback có `packages[]`: chọn gói ban đầu, xem gói hiện tại, đổi gói có giới hạn, xem lịch sử và phân loại giao dịch theo đúng gói tại thời điểm giao dịch. Chương trình legacy không có package giữ nguyên hành vi.

## Phạm vi

- Mở rộng `services/cashback-packages.js` thành nguồn sự thật duy nhất cho package runtime.
- Dùng lại `getCashbackPeriodForCard()` để xác định kỳ tháng hoặc kỳ sao kê.
- Cập nhật evaluation để phân loại bằng timestamp giao dịch.
- Thêm runtime card compact trong tab `Chương trình cashback`, tách khỏi modal cấu hình rule.
- Giữ persistence trong `cashbackProgramGroups[].packageHistory` để localStorage và Google Drive dùng chung luồng canonical hiện tại.
- Không hard-code ngân hàng, thẻ hoặc package cụ thể.

## Data model

Mỗi packaged program có thể chứa:

```js
packageHistory: [{
  id,
  periodKey,
  packageId,
  effectiveFrom,
  effectiveTo
}]
```

- `periodKey`: `${period.type}:${period.startDate}:${period.endDate}`.
- `effectiveFrom` và `effectiveTo`: local ISO datetime `YYYY-MM-DDTHH:mm:ss`; `effectiveTo` là exclusive.
- Các record được sắp xếp tăng dần theo `effectiveFrom` khi đọc nhưng không sửa/xóa record lịch sử trong switch thông thường.
- Lịch sử không hợp lệ hoặc tham chiếu package đã bị xóa được loại khỏi canonical data theo cơ chế normalize hiện có.

Schema giữ ở version 17 vì field mở `packageHistory` đã tồn tại trong schema hiện hành. Normalization sẽ nâng record cũ chỉ có ngày thành timestamp đầu ngày và suy ra `periodKey` từ card period khi có card context; không làm mất package/rule hiện có.

## Service API và nguồn sự thật

`cashback-packages.js` cung cấp:

- `cashbackPackagePeriodKey(period)`
- `cashbackTransactionTimestamp(transaction)`
- `getPackageHistoryForPeriod(program, period)`
- `getActiveCashbackPackage(program, period, referenceTimestamp)`
- `getPackageSwitchCount(program, period)`
- `getRemainingPackageSwitches(program, period)`
- `initializePeriodPackage(program, packageId, period)`
- `switchCashbackPackage(program, packageId, effectiveTimestamp, card)`
- `resolvePackageForTransaction(program, transaction, card)`

Không helper nào fallback sang `packages[0]` khi chưa từng chọn package.

### Chọn ban đầu

`initializePeriodPackage()` tạo record đầu tiên với:

- `periodKey` của kỳ.
- `effectiveFrom = period.startDate + T00:00:00`.
- `effectiveTo = null`.

Record đầu tiên không phải transition nên switch count bằng 0. Nếu kỳ đã có history hoặc package không hợp lệ, service trả lỗi.

### Đổi gói

`switchCashbackPackage()`:

1. Xác định kỳ từ card và timestamp hiện tại.
2. Kiểm tra package đích tồn tại và khác package active.
3. Kiểm tra switch count nhỏ hơn `packageSwitchLimit`.
4. Clone history hiện tại.
5. Đóng record active bằng timestamp đổi.
6. Thêm record mới cùng timestamp, `effectiveTo = null`.

Service kiểm tra giới hạn độc lập với UI nên không thể bypass qua lời gọi trực tiếp.

### Kế thừa kỳ mới

Khi kỳ hiện tại chưa có history:

- Tìm record active tại cuối kỳ liền trước.
- Tạo record khởi đầu cho kỳ mới với package đó và thời điểm bắt đầu kỳ.
- Record kế thừa là initial state, không tính switch.
- Nếu không có trạng thái kỳ trước, UI yêu cầu người dùng chọn ban đầu.

Carry-forward định nghĩa chương trình tiếp tục sao chép packages/groups/conditions nhưng tạo history mới theo quy tắc trên, không copy nguyên lịch sử kỳ trước.

## Phân loại giao dịch

Timestamp giao dịch được tạo từ:

```text
transaction.date + transaction.transactionTime
```

Nếu giao dịch legacy không có giờ, dùng `00:00:00`. Evaluation thực hiện:

1. Xác định cashback period của card.
2. Chỉ đọc history có cùng `periodKey`.
3. Tìm record thỏa `effectiveFrom <= timestamp < effectiveTo`, hoặc record mở.
4. Chỉ đưa giao dịch vào Groups của package tương ứng.

Giao dịch không resolve được package sẽ không được tự động gán vào package đầu tiên và không sinh cashback package cho đến khi có initial state hợp lệ.

## Runtime UI

Tab `Chương trình cashback` hiển thị runtime card compact cho packaged program đang chọn:

- `GÓI HOÀN TIỀN HIỆN TẠI`
- Gói hiện tại hoặc `Chưa thiết lập`
- Hiệu lực từ, định dạng `DD/MM/YYYY HH:mm`
- Đã đổi gói `X / Y lần`
- Nút `Chọn gói ban đầu` hoặc `Đổi gói`
- `<details>` chứa bảng lịch sử `Gói | Từ | Đến`

Khi đạt giới hạn, `Đổi gói` bị disable và hiển thị thông báo đã dùng hết lượt. Card dùng typography, spacing, border và button helpers hiện có; mobile xếp dọc tự nhiên.

### Modal chọn ban đầu

- Select package.
- Hủy/Xác nhận.
- Không cho xác nhận package không tồn tại.
- Service đặt hiệu lực từ đầu kỳ.

### Modal đổi gói

- Hiển thị package hiện tại.
- Select chỉ gồm package khác package hiện tại.
- Thời điểm hiệu lực là local time hiện tại, chỉ đọc.
- Hiển thị switch count và cảnh báo giao dịch cũ giữ package cũ.
- Xác nhận gọi trực tiếp service switch.

## Persistence và tương thích

- `normalizeCashbackPackageProgram()` giữ và chuẩn hóa history.
- `local-repository.js` truyền card context khi normalize để suy ra period cho record cũ.
- Save/reload và Drive sync không có kho runtime riêng; cùng serialize `cashbackProgramGroups`.
- Legacy program không có `packages` không tạo `packageHistory` và tiếp tục gọi nhánh evaluation cũ.
- Packaged program chưa có history mở an toàn với trạng thái `Chưa thiết lập`.

## Kiểm thử

Thực hiện TDD theo thứ tự:

1. Initial selection tạo một record đúng period/timestamp và switch count 0.
2. Switch đóng record cũ, mở record mới và count tăng 1.
3. Switch thứ hai bị từ chối khi limit bằng 1.
4. Transaction trước/sau switch resolve đúng package bằng date + time.
5. Statement period và monthly period tạo `periodKey` đúng.
6. Kỳ mới kế thừa package cuối kỳ trước và count reset 0.
7. Legacy evaluation không đổi.
8. Canonical save/reload giữ nguyên timestamp, periodKey và history.
9. UI source/DOM test xác nhận runtime card, trạng thái chưa thiết lập, nút disable và bảng history.

Cuối cùng chạy toàn bộ `tests/*.test.mjs`, `node --check` cho các file JavaScript thay đổi và kiểm tra trực quan desktop/mobile cho runtime card.

## File dự kiến thay đổi

- `services/cashback-packages.js`
- `services/cashback-evaluation.js`
- `services/cashback-period.js` nếu cần adapter carry-forward
- `services/local-repository.js`
- `app.js`
- `styles.css`
- `tests/cashback-packages.test.mjs`
- Một test UI Cashback hiện có hoặc test mới có phạm vi hẹp

Không thay đổi các tab không liên quan và không tạo model package runtime thứ hai.
